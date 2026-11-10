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

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import { ALL_TYPE_OPTIONS, NESTED_TYPE_OPTIONS, type SchemaFieldState } from "./schemaFieldUtils"

// Predefined Tailwind classes for nesting levels (avoids dynamic class generation)
const LEVEL_INDENT: Record<number, string> = {
  0: "",
  1: "ml-5",
  2: "ml-10",
  3: "ml-[60px]",
  4: "ml-[80px]",
}

export interface SchemaFieldEditorProps {
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

export function SchemaFieldEditor({
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
  const mlClass = LEVEL_INDENT[Math.min(level, 4)]

  return (
    <div className={`space-y-2 ${mlClass}`}>
      {fields.map((field, index) => (
        <div key={field.id} className="border rounded-lg p-3">
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
                  {ALL_TYPE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Required Checkbox */}
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                checked={field.required}
                onCheckedChange={(checked) =>
                  updateField(index, { required: !!checked }, fields, setFields)
                }
              />
              <label className="text-sm">Required</label>
            </div>

            {/* Doc/Comment */}
            <div className="col-span-3">
              <Input
                placeholder="Description (optional)"
                value={field.comment ?? ""}
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
                value={field.decimalPrecision ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  updateField(
                    index,
                    { decimalPrecision: isNaN(n) ? undefined : n },
                    fields,
                    setFields
                  )
                }}
              />
              <Input
                type="number"
                placeholder="Scale"
                value={field.decimalScale ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  updateField(index, { decimalScale: isNaN(n) ? undefined : n }, fields, setFields)
                }}
              />
            </div>
          )}

          {field.type === "fixed" && (
            <div className="mt-2">
              <Input
                type="number"
                placeholder="Length"
                value={field.fixedLength ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  updateField(index, { fixedLength: isNaN(n) ? undefined : n }, fields, setFields)
                }}
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
                          { elementType: { type: "struct", fields: [] } },
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
                      {NESTED_TYPE_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.elementRequired ?? true}
                      onCheckedChange={(checked) =>
                        updateField(index, { elementRequired: !!checked }, fields, setFields)
                      }
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
                          { elementType: { type: "struct", fields: [...structFields, newField] } },
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
                            { elementType: { type: "struct", fields: newFields } },
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
                      {NESTED_TYPE_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
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
                      {NESTED_TYPE_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={field.valueRequired ?? true}
                  onCheckedChange={(checked) =>
                    updateField(index, { valueRequired: !!checked }, fields, setFields)
                  }
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
