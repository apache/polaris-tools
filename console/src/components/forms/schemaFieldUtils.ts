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

import type { SchemaField } from "@/types/api"

export const COMPLEX_TYPES = ["struct", "list", "map"] as const

export type ComplexType = (typeof COMPLEX_TYPES)[number]
export type FieldTypeCategory = "primitive" | "complex"

export const PRIMITIVE_TYPE_OPTIONS = [
  { value: "string", label: "String" },
  { value: "int", label: "Int" },
  { value: "long", label: "Long" },
  { value: "float", label: "Float" },
  { value: "double", label: "Double" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "timestamp", label: "Timestamp" },
  { value: "timestamptz", label: "Timestamp TZ" },
  { value: "uuid", label: "UUID" },
  { value: "binary", label: "Binary" },
  { value: "decimal", label: "Decimal" },
  { value: "fixed", label: "Fixed" },
] as const

export const ALL_TYPE_OPTIONS = [
  ...PRIMITIVE_TYPE_OPTIONS,
  { value: "struct", label: "Struct" },
  { value: "list", label: "List" },
  { value: "map", label: "Map" },
] as const

// Types valid for list element / map value (excludes parameterized decimal/fixed for nested contexts
// and excludes list/map to avoid unbounded nesting complexity in the UI — struct is supported)
export const NESTED_TYPE_OPTIONS = [
  { value: "string", label: "String" },
  { value: "int", label: "Int" },
  { value: "long", label: "Long" },
  { value: "float", label: "Float" },
  { value: "double", label: "Double" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "timestamp", label: "Timestamp" },
  { value: "timestamptz", label: "Timestamp TZ" },
  { value: "uuid", label: "UUID" },
  { value: "binary", label: "Binary" },
  { value: "struct", label: "Struct" },
] as const

export interface FieldTypeObject {
  type: string
  fields?: Array<SchemaFieldState | SchemaField>
  [key: string]: unknown
}

export interface SchemaFieldState extends Omit<SchemaField, "type"> {
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

/**
 * Returns the next available field ID (max across all field IDs + 1).
 */
export function getNextFieldId(fields: SchemaFieldState[]): number {
  let maxId = 0

  const scan = (fs: SchemaFieldState[]) => {
    for (const field of fs) {
      if (field.id > maxId) maxId = field.id
      if (field.elementId && field.elementId > maxId) maxId = field.elementId
      if (field.keyId && field.keyId > maxId) maxId = field.keyId
      if (field.valueId && field.valueId > maxId) maxId = field.valueId
      if (field.nestedFields && field.nestedFields.length > 0) scan(field.nestedFields)
    }
  }

  scan(fields)
  return maxId + 1
}

/**
 * Converts a SchemaFieldState (UI state) to a SchemaField (API format).
 */
export function convertFieldToApi(field: SchemaFieldState): SchemaField {
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
            fields: (field.elementType.fields as SchemaFieldState[]).map(convertFieldToApi),
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
    ...(field.comment && { doc: field.comment }),
  }
}

/**
 * Converts a raw JSON schema field (from API or paste) to SchemaFieldState.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fieldFromJson(jsonField: any): SchemaFieldState {
  let fieldType: string
  let typeCategory: FieldTypeCategory = "primitive"
  let decimalPrecision: number | undefined
  let decimalScale: number | undefined
  let fixedLength: number | undefined

  if (typeof jsonField.type === "string") {
    fieldType = jsonField.type

    const decimalMatch = fieldType.match(/^decimal\((\d+),(\d+)\)$/)
    if (decimalMatch) {
      fieldType = "decimal"
      decimalPrecision = parseInt(decimalMatch[1])
      decimalScale = parseInt(decimalMatch[2])
    }

    const fixedMatch = fieldType.match(/^fixed\[(\d+)\]$/)
    if (fixedMatch) {
      fieldType = "fixed"
      fixedLength = parseInt(fixedMatch[1])
    }
  } else {
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
      baseField.nestedFields = jsonField.type.fields.map(fieldFromJson)
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
