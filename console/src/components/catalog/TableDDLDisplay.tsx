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

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TableMetadata, SchemaField } from "@/types/api"

interface TableDDLDisplayProps {
  catalogName: string
  namespace: string[]
  tableName: string
  metadata: TableMetadata
}

export function TableDDLDisplay({
  catalogName,
  namespace,
  tableName,
  metadata,
}: TableDDLDisplayProps) {
  const [copied, setCopied] = useState(false)
  const ddl = generateDDL(catalogName, namespace, tableName, metadata)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ddl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">DDL</h3>
        <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 px-2">
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="border rounded-md bg-muted/30 p-3">
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
          <code>{ddl}</code>
        </pre>
      </div>
    </div>
  )
}

function generateDDL(
  catalogName: string,
  namespace: string[],
  tableName: string,
  metadata: TableMetadata
): string {
  const lines: string[] = []

  // CREATE TABLE statement
  lines.push(
    `CREATE TABLE ${catalogName}.${namespace.length > 0 ? namespace.join(".") + "." : ""}${tableName} (`
  )

  // Schema fields
  const currentSchema = metadata.schemas.find(
    (s) => s["schema-id"] === metadata["current-schema-id"]
  )

  if (currentSchema?.fields && currentSchema.fields.length > 0) {
    const fieldDefs = currentSchema.fields.map((field) => {
      const typeStr = formatFieldTypeForDDL(field)
      const nullable = field.required ? "NOT NULL" : ""
      return `  ${field.name} ${typeStr}${nullable ? " " + nullable : ""}`
    })
    lines.push(fieldDefs.join(",\n"))
  }

  lines.push(")")

  const partitionBy = formatPartitionClause(metadata, currentSchema?.fields)
  if (partitionBy) {
    lines.push(partitionBy)
  }

  // Properties
  if (metadata.properties && Object.keys(metadata.properties).length > 0) {
    lines.push("TBLPROPERTIES (")
    const propEntries = Object.entries(metadata.properties).map(
      ([key, value]) => `  '${key}' = '${value}'`
    )
    lines.push(propEntries.join(",\n"))
    lines.push(")")
  }

  // Location
  if (metadata.location) {
    lines.push(`LOCATION '${metadata.location}'`)
  }

  return lines.join("\n")
}

function formatPartitionClause(
  metadata: TableMetadata,
  schemaFields: SchemaField[] | undefined
): string | null {
  const specs = metadata["partition-specs"]
  if (!specs || specs.length === 0) {
    return null
  }

  const specId = metadata["default-spec-id"]
  const spec =
    specId === undefined ? specs[0] : (specs.find((item) => item["spec-id"] === specId) ?? specs[0])
  if (!spec.fields || spec.fields.length === 0) {
    return null
  }

  const parts = spec.fields.map((field) => {
    const source = schemaFields?.find((item) => item.id === field["source-id"])
    const sourceName = source?.name ?? field.name
    return formatPartitionTransform(field.transform, sourceName)
  })
  return `PARTITIONED BY (${parts.join(", ")})`
}

function formatPartitionTransform(transform: string, sourceName: string): string {
  if (transform === "identity") {
    return sourceName
  }

  const bucket = /^bucket\[(\d+)\]$/.exec(transform)
  if (bucket) {
    return `bucket(${bucket[1]}, ${sourceName})`
  }

  const truncate = /^truncate\[(\d+)\]$/.exec(transform)
  if (truncate) {
    return `truncate(${truncate[1]}, ${sourceName})`
  }

  const temporal: Record<string, string> = {
    year: "years",
    month: "months",
    day: "days",
    hour: "hours",
  }
  const functionName = temporal[transform] ?? transform
  return `${functionName}(${sourceName})`
}

function formatFieldTypeForDDL(
  field: SchemaField | { type: string | { type: string; [key: string]: unknown } }
): string {
  if (typeof field.type === "string") {
    // Handle primitive types
    return field.type.toUpperCase()
  }

  if (typeof field.type === "object" && field.type !== null) {
    if (field.type.type === "list") {
      const element = (
        field.type as { element?: string | { type: string; [key: string]: unknown } }
      ).element
      const elementType = formatFieldTypeForDDL({
        type: element || "unknown",
      } as SchemaField)
      return `ARRAY<${elementType}>`
    }

    if (field.type.type === "map") {
      const key = (field.type as { key?: string | { type: string; [key: string]: unknown } }).key
      const value = (field.type as { value?: string | { type: string; [key: string]: unknown } })
        .value
      const keyType = formatFieldTypeForDDL({
        type: key || "unknown",
      } as SchemaField)
      const valueType = formatFieldTypeForDDL({
        type: value || "unknown",
      } as SchemaField)
      return `MAP<${keyType}, ${valueType}>`
    }

    if (field.type.type === "struct") {
      const structFields =
        (
          field.type as {
            fields?: Array<{
              name: string
              type: string | { type: string; [key: string]: unknown }
            }>
          }
        ).fields || []
      const fieldDefs = structFields.map(
        (f) => `${f.name}: ${formatFieldTypeForDDL({ type: f.type } as SchemaField)}`
      )
      return `STRUCT<${fieldDefs.join(", ")}>`
    }
  }

  return "STRING"
}
