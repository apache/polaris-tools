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

import type { TableSchema, SchemaField } from "@/types/api"

interface TableSchemaDisplayProps {
  schema: TableSchema
}

export function TableSchemaDisplay({ schema }: TableSchemaDisplayProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Schema</h3>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-center font-medium">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {schema.fields && schema.fields.length > 0 ? (
              schema.fields.map((field, idx) => (
                <tr key={idx} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{field.name}</td>
                  <td className="px-3 py-2 text-xs">{formatFieldType(field)}</td>
                  <td className="px-3 py-2 text-center">
                    {field.required ? (
                      <span className="text-xs text-destructive">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm text-muted-foreground italic text-center">
                  No fields defined
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatFieldType(field: SchemaField | { type: string | { type: string; [key: string]: unknown } }): string {
  if (typeof field.type === "string") {
    return field.type
  }
  
  if (typeof field.type === "object" && field.type !== null) {
    // Handle nested types like list, map, struct
    if (field.type.type === "list") {
      const element = (field.type as { element?: string | { type: string; [key: string]: unknown } }).element
      const elementType = formatFieldType({
        type: element || "unknown",
      } as SchemaField)
      return `list<${elementType}>`
    }
    
    if (field.type.type === "map") {
      const key = (field.type as { key?: string | { type: string; [key: string]: unknown } }).key
      const value = (field.type as { value?: string | { type: string; [key: string]: unknown } }).value
      const keyType = formatFieldType({
        type: key || "unknown",
      } as SchemaField)
      const valueType = formatFieldType({
        type: value || "unknown",
      } as SchemaField)
      return `map<${keyType}, ${valueType}>`
    }
    
    if (field.type.type === "struct") {
      const fields = (field.type as { fields?: Array<{ name: string; type: string | { type: string; [key: string]: unknown } }> })
        .fields || []
      const fieldTypes = fields.map((f) => `${f.name}: ${formatFieldType({ type: f.type } as SchemaField)}`)
      return `struct<${fieldTypes.join(", ")}>`
    }
    
    return JSON.stringify(field.type)
  }
  
  return "unknown"
}

