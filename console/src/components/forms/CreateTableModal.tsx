/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { tablesApi } from "@/api/catalog/tables"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, X } from "lucide-react"
import type { CreateTableRequest, SchemaField } from "@/types/api"
import {
  COMPLEX_TYPES,
  type ComplexType,
  type SchemaFieldState,
  convertFieldToApi,
  fieldFromJson,
  getNextFieldId,
} from "./schemaFieldUtils"
import { SchemaFieldEditor } from "./SchemaFieldEditor"

const schema = z.object({
  name: z
    .string()
    .min(1, "Table name is required")
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "Table name must start with a letter or underscore and contain only alphanumeric characters and underscores"
    ),
  location: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true
        const urlPattern = /^(s3|https?|file|gs|azure|abfss?):\/\//i
        const absolutePathPattern = /^\/[^/]/
        return urlPattern.test(val.trim()) || absolutePathPattern.test(val.trim())
      },
      {
        message: "Location must be a valid URL (s3://, https://, file://, etc.) or absolute path",
      }
    ),
  schemaJson: z.string().optional(),
  properties: z
    .array(
      z.object({
        key: z.string().min(1, "Key is required"),
        value: z.string(),
      })
    )
    .optional(),
})

type FormValues = z.infer<typeof schema>

interface CreateTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  onCreated?: () => void
}

export function CreateTableModal({
  open,
  onOpenChange,
  catalogName,
  namespace,
  onCreated,
}: CreateTableModalProps) {
  const [schemaMode, setSchemaMode] = useState<"manual" | "json">("manual")
  const [fields, setFields] = useState<SchemaFieldState[]>([])
  const [nextFieldId, setNextFieldId] = useState(1)
  const [properties, setProperties] = useState<Array<{ key: string; value: string }>>([])
  const [partitionFields, setPartitionFields] = useState<
    Array<{ sourceColumn: string; transform: string }>
  >([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      location: "",
      schemaJson: "",
      properties: [],
    },
  })

  const schemaJson = watch("schemaJson")

  // Add a new field to the schema
  const addField = (
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => {
    const targetFields = parentFields !== undefined ? parentFields : fields
    const setter = parentSetter !== undefined ? parentSetter : setFields

    const newField: SchemaFieldState = {
      id: nextFieldId,
      name: "",
      type: "string",
      typeCategory: "primitive",
      required: true,
    }

    setter([...targetFields, newField])
    setNextFieldId(nextFieldId + 1)
  }

  // Remove a field from the schema
  const removeField = (
    index: number,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => {
    const targetFields = parentFields !== undefined ? parentFields : fields
    const setter = parentSetter !== undefined ? parentSetter : setFields

    setter(targetFields.filter((_, i) => i !== index))
  }

  const updateField = (
    index: number,
    updates: Partial<SchemaFieldState>,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => {
    const targetFields = parentFields !== undefined ? parentFields : fields
    const setter = parentSetter !== undefined ? parentSetter : setFields

    const updated = [...targetFields]
    updated[index] = { ...updated[index], ...updates }
    setter(updated)
  }

  const changeFieldType = (
    index: number,
    newType: string,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => {
    const targetFields = parentFields !== undefined ? parentFields : fields
    const setter = parentSetter !== undefined ? parentSetter : setFields

    const updated = [...targetFields]
    const field = updated[index]

    if (COMPLEX_TYPES.includes(newType as ComplexType)) {
      field.typeCategory = "complex"
      field.type = newType

      // Initialize complex type properties
      if (newType === "struct") {
        field.nestedFields = []
      } else if (newType === "list") {
        field.elementType = "string"
        field.elementRequired = true
        field.elementId = nextFieldId
        setNextFieldId(nextFieldId + 1)
      } else if (newType === "map") {
        field.keyType = "string"
        field.valueType = "string"
        field.valueRequired = true
        field.keyId = nextFieldId
        field.valueId = nextFieldId + 1
        setNextFieldId(nextFieldId + 2)
      }
    } else {
      field.typeCategory = "primitive"
      field.type = newType

      // Clear complex type properties
      delete field.nestedFields
      delete field.elementType
      delete field.elementRequired
      delete field.elementId
      delete field.keyType
      delete field.valueType
      delete field.keyRequired
      delete field.valueRequired
      delete field.keyId
      delete field.valueId
    }

    setter(updated)
  }

  const parseJsonSchema = () => {
    if (!schemaJson) {
      toast.error("Please provide a JSON schema")
      return
    }

    try {
      const parsed = JSON.parse(schemaJson)

      if (!parsed.type || parsed.type !== "struct") {
        toast.error("Schema must be a struct type with a fields array")
        return
      }

      if (!Array.isArray(parsed.fields)) {
        toast.error("Schema must have a fields array")
        return
      }

      const parsedFields = parsed.fields.map(fieldFromJson)
      setFields(parsedFields)

      // Update next field ID
      setNextFieldId(getNextFieldId(parsedFields))

      toast.success("Schema imported successfully")
      setSchemaMode("manual")
    } catch (error) {
      toast.error("Invalid JSON schema", {
        description: error instanceof Error ? error.message : "Failed to parse JSON",
      })
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let schemaFields: SchemaField[]

      if (schemaMode === "json" && values.schemaJson) {
        const parsed = JSON.parse(values.schemaJson)
        schemaFields = parsed.fields
      } else {
        if (fields.length === 0) {
          throw new Error("At least one schema field is required")
        }
        schemaFields = fields.map(convertFieldToApi)
      }

      const request: CreateTableRequest = {
        name: values.name,
        schema: {
          type: "struct",
          fields: schemaFields,
        },
        properties: {},
      }

      if (values.location && values.location.trim()) {
        request.properties!.location = values.location.trim()
      }

      // Add custom properties
      if (values.properties && values.properties.length > 0) {
        values.properties.forEach((prop) => {
          if (prop.key.trim()) {
            request.properties![prop.key.trim()] = prop.value || ""
          }
        })
      }

      // Add partition spec if configured
      if (partitionFields.length > 0) {
        request.partitionSpec = {
          fields: partitionFields.map((pf, idx) => ({
            "source-id": fields.find((f) => f.name === pf.sourceColumn)?.id || 0,
            "field-id": 1000 + idx,
            name: `${pf.sourceColumn}_${pf.transform}`,
            transform: pf.transform,
          })),
        }
      }

      return tablesApi.create(catalogName, namespace, request)
    },
    onSuccess: () => {
      toast.success("Table created successfully")
      onOpenChange(false)
      reset()
      setFields([])
      setProperties([])
      setPartitionFields([])
      setNextFieldId(1)
      onCreated?.()
    },
    onError: (error: Error) => {
      toast.error("Failed to create table", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  useEffect(() => {
    if (!open) {
      reset()
      setFields([])
      setProperties([])
      setPartitionFields([])
      setNextFieldId(1)
      setSchemaMode("manual")
    }
  }, [open, reset])

  useEffect(() => {
    const nonEmpty = properties.filter((p) => p.key.trim().length > 0)
    setValue("properties", nonEmpty, { shouldValidate: true })
  }, [properties, setValue])

  const addProperty = () => {
    setProperties([...properties, { key: "", value: "" }])
  }

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index))
  }

  const updateProperty = (index: number, field: "key" | "value", value: string) => {
    const updated = [...properties]
    updated[index] = { ...updated[index], [field]: value }
    setProperties(updated)
  }

  const addPartitionField = () => {
    setPartitionFields([...partitionFields, { sourceColumn: "", transform: "identity" }])
  }

  const removePartitionField = (index: number) => {
    setPartitionFields(partitionFields.filter((_, i) => i !== index))
  }

  const updatePartitionField = (
    index: number,
    field: "sourceColumn" | "transform",
    value: string
  ) => {
    const updated = [...partitionFields]
    updated[index] = { ...updated[index], [field]: value }
    setPartitionFields(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Iceberg Table</DialogTitle>
          <DialogDescription>
            Create a new Iceberg table in the namespace "{namespace.join(".")}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Table Name *</Label>
              <Input id="name" placeholder="my_table" {...register("name")} />
              {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="s3://bucket/path/to/table"
                {...register("location")}
              />
              {errors.location && <p className="text-sm text-red-600">{errors.location.message}</p>}
              <p className="text-xs text-muted-foreground">
                Storage location for this table. Must be within the catalog's allowed locations.
              </p>
            </div>
          </div>

          {/* Schema Definition */}
          <div className="space-y-2">
            <Label>Table Schema *</Label>
            <Tabs value={schemaMode} onValueChange={(v) => setSchemaMode(v as "manual" | "json")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Editor</TabsTrigger>
                <TabsTrigger value="json">JSON Schema</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Define your table schema by adding fields
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => addField()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                      No fields defined. Click "Add Field" to start building your schema.
                    </div>
                  ) : (
                    <SchemaFieldEditor
                      fields={fields}
                      setFields={setFields}
                      updateField={updateField}
                      removeField={removeField}
                      changeFieldType={changeFieldType}
                      addField={addField}
                      nextFieldId={nextFieldId}
                      setNextFieldId={setNextFieldId}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="json" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="schemaJson">Schema JSON</Label>
                  <Textarea
                    id="schemaJson"
                    placeholder={`{
  "type": "struct",
  "fields": [
    {
      "id": 1,
      "name": "id",
      "type": "long",
      "required": true
    },
    {
      "id": 2,
      "name": "name",
      "type": "string",
      "required": true
    }
  ]
}`}
                    className="min-h-[300px] font-mono text-sm"
                    {...register("schemaJson")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your Iceberg table schema in JSON format
                  </p>
                  <Button type="button" variant="secondary" onClick={parseJsonSchema}>
                    Import & Validate
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Advanced Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advanced Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Partition Spec */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Partition Spec (optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPartitionField}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Partition
                  </Button>
                </div>
                {partitionFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No partitions configured. Table will be unpartitioned.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {partitionFields.map((pf, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Select
                          value={pf.sourceColumn}
                          onValueChange={(value) =>
                            updatePartitionField(index, "sourceColumn", value)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name || `field_${field.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={pf.transform}
                          onValueChange={(value) => updatePartitionField(index, "transform", value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="identity">Identity</SelectItem>
                            <SelectItem value="year">Year</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="hour">Hour</SelectItem>
                            <SelectItem value="bucket[16]">Bucket[16]</SelectItem>
                            <SelectItem value="truncate[10]">Truncate[10]</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePartitionField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Properties */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Table Properties (optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addProperty}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Property
                  </Button>
                </div>
                {properties.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No properties added.</p>
                ) : (
                  <div className="space-y-2">
                    {properties.map((prop, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Input
                          placeholder="Key"
                          value={prop.key}
                          onChange={(e) => updateProperty(index, "key", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={prop.value}
                          onChange={(e) => updateProperty(index, "value", e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProperty(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
