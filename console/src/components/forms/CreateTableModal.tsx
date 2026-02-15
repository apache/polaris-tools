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

const COMPLEX_TYPES = ["struct", "list", "map"] as const

type ComplexType = (typeof COMPLEX_TYPES)[number]
type FieldTypeCategory = "primitive" | "complex"

interface SchemaFieldState extends Omit<SchemaField, "type"> {
  type: string | FieldTypeObject
  typeCategory: FieldTypeCategory
  // For parameterized types
  decimalPrecision?: number
  decimalScale?: number
  fixedLength?: number
  // For complex types
  nestedFields?: SchemaFieldState[] // for struct
  elementType?: string | FieldTypeObject // for list
  elementRequired?: boolean
  elementId?: number
  keyType?: string | FieldTypeObject // for map
  valueType?: string | FieldTypeObject
  keyRequired?: boolean
  valueRequired?: boolean
  keyId?: number
  valueId?: number
  // UI state
  expanded?: boolean
}

interface FieldTypeObject {
  type: string
  fields?: SchemaFieldState[] | SchemaField[]
  [key: string]: unknown
}

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

  // Helper function to get next available ID recursively
  const getNextId = (currentId: number, fieldsToCheck: SchemaFieldState[]): number => {
    let maxId = currentId

    for (const field of fieldsToCheck) {
      if (field.id > maxId) maxId = field.id
      if (field.elementId && field.elementId > maxId) maxId = field.elementId
      if (field.keyId && field.keyId > maxId) maxId = field.keyId
      if (field.valueId && field.valueId > maxId) maxId = field.valueId

      if (field.nestedFields && field.nestedFields.length > 0) {
        maxId = getNextId(maxId, field.nestedFields)
      }
    }

    return maxId + 1
  }

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

  const convertFieldToApi = (field: SchemaFieldState): SchemaField => {
    let fieldType: string | FieldTypeObject

    if (field.typeCategory === "complex") {
      if (field.type === "struct" && field.nestedFields) {
        fieldType = {
          type: "struct",
          fields: field.nestedFields.map(convertFieldToApi),
        }
      } else if (field.type === "list" && field.elementType) {
        let elementType: string | FieldTypeObject

        if (typeof field.elementType === "object") {
          if (field.elementType.type === "struct" && field.elementType.fields) {
            elementType = {
              type: "struct",
              fields: field.elementType.fields.map(convertFieldToApi),
            }
          } else {
            elementType = field.elementType
          }
        } else {
          elementType = field.elementType
        }

        fieldType = {
          type: "list",
          "element-id": field.elementId!,
          element: elementType,
          "element-required": field.elementRequired ?? true,
        }
      } else if (field.type === "map" && field.keyType && field.valueType) {
        fieldType = {
          type: "map",
          "key-id": field.keyId!,
          key: field.keyType,
          "value-id": field.valueId!,
          value: field.valueType,
          "value-required": field.valueRequired ?? true,
        }
      } else {
        fieldType = String(field.type)
      }
    } else {
      // Handle parameterized primitives
      if (field.type === "decimal" && field.decimalPrecision && field.decimalScale !== undefined) {
        fieldType = `decimal(${field.decimalPrecision},${field.decimalScale})`
      } else if (field.type === "fixed" && field.fixedLength) {
        fieldType = `fixed[${field.fixedLength}]`
      } else {
        fieldType = String(field.type)
      }
    }

    return {
      id: field.id,
      name: field.name,
      type: fieldType,
      required: field.required,
      ...(field.comment && { comment: field.comment }),
    }
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

      // Convert parsed JSON to SchemaFieldState
      const convertFromJson = (jsonField: Record<string, unknown>): SchemaFieldState => {
        let fieldType: string
        let typeCategory: FieldTypeCategory = "primitive"
        let decimalPrecision: number | undefined
        let decimalScale: number | undefined
        let fixedLength: number | undefined

        // Parse the type
        if (typeof jsonField.type === "string") {
          fieldType = jsonField.type

          // Check for parameterized types
          // decimal(10,2)
          const decimalMatch = fieldType.match(/^decimal\((\d+),(\d+)\)$/)
          if (decimalMatch) {
            fieldType = "decimal"
            decimalPrecision = parseInt(decimalMatch[1])
            decimalScale = parseInt(decimalMatch[2])
          }

          // fixed[16]
          const fixedMatch = fieldType.match(/^fixed\[(\d+)\]$/)
          if (fixedMatch) {
            fieldType = "fixed"
            fixedLength = parseInt(fixedMatch[1])
          }
        } else {
          // Complex type
          fieldType = jsonField.type.type
          typeCategory = "complex"
        }

        const baseField: SchemaFieldState = {
          id: jsonField.id,
          name: jsonField.name,
          type: fieldType,
          typeCategory,
          required: jsonField.required,
          comment: jsonField.doc || jsonField.comment,
          ...(decimalPrecision !== undefined && { decimalPrecision }),
          ...(decimalScale !== undefined && { decimalScale }),
          ...(fixedLength !== undefined && { fixedLength }),
        }

        if (typeof jsonField.type === "object") {
          if (jsonField.type.type === "struct") {
            baseField.nestedFields = jsonField.type.fields.map(convertFromJson)
          } else if (jsonField.type.type === "list") {
            baseField.elementType = jsonField.type.element
            baseField.elementRequired = jsonField.type["element-required"]
            baseField.elementId = jsonField.type["element-id"]
          } else if (jsonField.type.type === "map") {
            baseField.keyType = jsonField.type.key
            baseField.valueType = jsonField.type.value
            baseField.valueRequired = jsonField.type["value-required"]
            baseField.keyId = jsonField.type["key-id"]
            baseField.valueId = jsonField.type["value-id"]
          }
        }

        return baseField
      }

      const parsedFields = parsed.fields.map(convertFromJson)
      setFields(parsedFields)

      // Update next field ID
      const maxId = getNextId(0, parsedFields)
      setNextFieldId(maxId)

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

// Schema Field Editor Component
interface SchemaFieldEditorProps {
  fields: SchemaFieldState[]
  setFields: (fields: SchemaFieldState[]) => void
  updateField: (
    index: number,
    updates: Partial<SchemaFieldState>,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => void
  removeField: (
    index: number,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => void
  changeFieldType: (
    index: number,
    newType: string,
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => void
  addField: (
    parentFields?: SchemaFieldState[],
    parentSetter?: (fields: SchemaFieldState[]) => void
  ) => void
  nextFieldId: number
  setNextFieldId: (id: number) => void
  level?: number
}

function SchemaFieldEditor({
  fields,
  setFields,
  updateField,
  removeField,
  changeFieldType,
  addField,
  nextFieldId,
  setNextFieldId,
  level = 0,
}: SchemaFieldEditorProps) {
  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="border rounded-lg p-3"
          style={{ marginLeft: `${level * 20}px` }}
        >
          <div className="grid grid-cols-12 gap-2 items-start">
            {/* Field Name */}
            <div className="col-span-3">
              <Input
                placeholder="Field name"
                value={field.name}
                onChange={(e) => updateField(index, { name: e.target.value }, fields, setFields)}
              />
            </div>

            {/* Field Type */}
            <div className="col-span-3">
              <Select
                value={String(field.type)}
                onValueChange={(value) => changeFieldType(index, value, fields, setFields)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="int">Int</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="float">Float</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="timestamp">Timestamp</SelectItem>
                  <SelectItem value="timestamptz">Timestamp TZ</SelectItem>
                  <SelectItem value="uuid">UUID</SelectItem>
                  <SelectItem value="binary">Binary</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="struct">Struct</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="map">Map</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Required Checkbox */}
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  updateField(index, { required: e.target.checked }, fields, setFields)
                }
                className="h-4 w-4"
              />
              <label className="text-sm">Required</label>
            </div>

            {/* Doc/Comment */}
            <div className="col-span-3">
              <Input
                placeholder="Description (optional)"
                value={field.comment || ""}
                onChange={(e) => updateField(index, { comment: e.target.value }, fields, setFields)}
              />
            </div>

            {/* Remove Button */}
            <div className="col-span-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeField(index, fields, setFields)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Parameterized Type Configuration */}
          {field.type === "decimal" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input
                type="number"
                placeholder="Precision"
                value={field.decimalPrecision || ""}
                onChange={(e) =>
                  updateField(
                    index,
                    { decimalPrecision: parseInt(e.target.value) || undefined },
                    fields,
                    setFields
                  )
                }
              />
              <Input
                type="number"
                placeholder="Scale"
                value={field.decimalScale || ""}
                onChange={(e) =>
                  updateField(
                    index,
                    { decimalScale: parseInt(e.target.value) || undefined },
                    fields,
                    setFields
                  )
                }
              />
            </div>
          )}

          {field.type === "fixed" && (
            <div className="mt-2">
              <Input
                type="number"
                placeholder="Length"
                value={field.fixedLength || ""}
                onChange={(e) =>
                  updateField(
                    index,
                    { fixedLength: parseInt(e.target.value) || undefined },
                    fields,
                    setFields
                  )
                }
              />
            </div>
          )}

          {/* Complex Type Configuration */}
          {field.type === "struct" && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Nested Fields</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nestedFields = field.nestedFields || []
                    const newNestedField: SchemaFieldState = {
                      id: nextFieldId,
                      name: "",
                      type: "string",
                      typeCategory: "primitive",
                      required: true,
                    }
                    updateField(
                      index,
                      { nestedFields: [...nestedFields, newNestedField] },
                      fields,
                      setFields
                    )
                    setNextFieldId(nextFieldId + 1)
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Nested Field
                </Button>
              </div>
              {field.nestedFields && field.nestedFields.length > 0 && (
                <SchemaFieldEditor
                  fields={field.nestedFields}
                  setFields={(newNestedFields) =>
                    updateField(index, { nestedFields: newNestedFields }, fields, setFields)
                  }
                  updateField={updateField}
                  removeField={removeField}
                  changeFieldType={changeFieldType}
                  addField={addField}
                  nextFieldId={nextFieldId}
                  setNextFieldId={setNextFieldId}
                  level={level + 1}
                />
              )}
            </div>
          )}

          {field.type === "list" && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">Element Type</Label>
                  <Select
                    value={
                      typeof field.elementType === "object"
                        ? field.elementType.type
                        : String(field.elementType || "string")
                    }
                    onValueChange={(value) => {
                      if (value === "struct") {
                        updateField(
                          index,
                          {
                            elementType: { type: "struct", fields: [] },
                          },
                          fields,
                          setFields
                        )
                      } else {
                        updateField(index, { elementType: value }, fields, setFields)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="int">Int</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="float">Float</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                      <SelectItem value="struct">Struct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.elementRequired ?? true}
                      onChange={(e) =>
                        updateField(index, { elementRequired: e.target.checked }, fields, setFields)
                      }
                      className="h-4 w-4"
                    />
                    <label className="text-sm">Element Required</label>
                  </div>
                </div>
              </div>

              {/* Nested fields for struct element type */}
              {typeof field.elementType === "object" && field.elementType.type === "struct" && (
                <div className="space-y-2 border-l-2 border-muted pl-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Struct Fields</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const structFields =
                          (typeof field.elementType === "object" && field.elementType.fields) || []
                        const newField: SchemaFieldState = {
                          id: nextFieldId,
                          name: "",
                          type: "string",
                          typeCategory: "primitive",
                          required: true,
                        }
                        updateField(
                          index,
                          {
                            elementType: {
                              type: "struct",
                              fields: [...structFields, newField],
                            },
                          },
                          fields,
                          setFields
                        )
                        setNextFieldId(nextFieldId + 1)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field
                    </Button>
                  </div>
                  {typeof field.elementType === "object" &&
                    field.elementType.fields &&
                    field.elementType.fields.length > 0 && (
                      <SchemaFieldEditor
                        fields={field.elementType.fields as SchemaFieldState[]}
                        setFields={(newFields) =>
                          updateField(
                            index,
                            {
                              elementType: {
                                type: "struct",
                                fields: newFields,
                              },
                            },
                            fields,
                            setFields
                          )
                        }
                        updateField={updateField}
                        removeField={removeField}
                        changeFieldType={changeFieldType}
                        addField={addField}
                        nextFieldId={nextFieldId}
                        setNextFieldId={setNextFieldId}
                        level={level + 1}
                      />
                    )}
                </div>
              )}
            </div>
          )}

          {field.type === "map" && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">Key Type</Label>
                  <Select
                    value={String(field.keyType || "string")}
                    onValueChange={(value) =>
                      updateField(index, { keyType: value }, fields, setFields)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="int">Int</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="uuid">UUID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Value Type</Label>
                  <Select
                    value={String(field.valueType || "string")}
                    onValueChange={(value) =>
                      updateField(index, { valueType: value }, fields, setFields)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="int">Int</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.valueRequired ?? true}
                  onChange={(e) =>
                    updateField(index, { valueRequired: e.target.checked }, fields, setFields)
                  }
                  className="h-4 w-4"
                />
                <label className="text-sm">Value Required</label>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
