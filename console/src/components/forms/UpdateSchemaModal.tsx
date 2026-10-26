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

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { tablesApi } from "@/api/catalog/tables"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, TriangleAlert } from "lucide-react"
import type { TableMetadata } from "@/types/api"
import {
  COMPLEX_TYPES,
  type ComplexType,
  type SchemaFieldState,
  convertFieldToApi,
  fieldFromJson,
  getNextFieldId,
} from "./schemaFieldUtils"
import { SchemaFieldEditor } from "./SchemaFieldEditor"

interface UpdateSchemaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  tableName: string
  tableMetadata: TableMetadata
}

function hasEmptyName(fields: SchemaFieldState[]): boolean {
  for (const field of fields) {
    if (!field.name.trim()) return true
    if (field.nestedFields && hasEmptyName(field.nestedFields)) return true
  }
  return false
}

export function UpdateSchemaModal({
  open,
  onOpenChange,
  catalogName,
  namespace,
  tableName,
  tableMetadata,
}: UpdateSchemaModalProps) {
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<SchemaFieldState[]>([])
  const [nextFieldId, setNextFieldId] = useState(1)
  const [initialFieldIds, setInitialFieldIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) {
      const currentSchema = tableMetadata.schemas.find(
        (s) => s["schema-id"] === tableMetadata["current-schema-id"]
      )
      if (currentSchema) {
        const parsed = currentSchema.fields.map(fieldFromJson)
        setFields(parsed)
        setNextFieldId(getNextFieldId(parsed))
        setInitialFieldIds(new Set(parsed.map((f) => f.id)))
      } else {
        setFields([])
        setNextFieldId(1)
        setInitialFieldIds(new Set())
      }
    }
  }, [open, tableMetadata])

  const removedCount = useMemo(() => {
    return [...initialFieldIds].filter((id) => !fields.some((f) => f.id === id)).length
  }, [fields, initialFieldIds])

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
      required: false,
    }

    setter([...targetFields, newField])
    setNextFieldId(nextFieldId + 1)
  }

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

  const currentSchemaId = tableMetadata["current-schema-id"]
  const currentSchema = tableMetadata.schemas.find((s) => s["schema-id"] === currentSchemaId)

  const updateMutation = useMutation({
    mutationFn: async () => {
      const schemaFields = fields.map(convertFieldToApi)
      const identifierFieldIds = currentSchema?.["identifier-field-ids"]
      return tablesApi.updateSchema(
        catalogName,
        namespace,
        tableName,
        schemaFields,
        currentSchemaId,
        identifierFieldIds
      )
    },
    onSuccess: () => {
      toast.success("Schema updated successfully")
      queryClient.invalidateQueries({
        queryKey: ["table", catalogName, namespace.join("."), tableName],
      })
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to update schema"
      toast.error("Failed to update schema", { description: msg })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fields.length === 0) {
      toast.error("Schema must have at least one field")
      return
    }
    if (hasEmptyName(fields)) {
      toast.error("All fields must have a name")
      return
    }
    updateMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Schema</DialogTitle>
          <DialogDescription>
            Modify the schema for <strong>{tableName}</strong>. Existing field IDs are preserved.
            Removing a field will drop that column from the schema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {removedCount > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {removedCount} field{removedCount !== 1 ? "s" : ""} will be permanently removed
                  from the schema. Existing data in those columns will become inaccessible.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => addField()}>
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
                No fields defined. Add a field to get started.
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Schema"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
