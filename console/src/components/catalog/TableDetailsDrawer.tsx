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

import { useQuery } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { tablesApi } from "@/api/catalog/tables"
import { Loader2 } from "lucide-react"
import { TableSchemaDisplay } from "./TableSchemaDisplay"
import type { LoadGenericTableResponse } from "@/types/api"
import { TableDDLDisplay } from "./TableDDLDisplay"

interface TableDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  tableName: string
}

export function TableDetailsDrawer({
  open,
  onOpenChange,
  catalogName,
  namespace,
  tableName,
}: TableDetailsDrawerProps) {
  const tableQuery = useQuery({
    queryKey: ["table", catalogName, namespace.join("."), tableName],
    queryFn: async () => {
      // Try to fetch as an Iceberg table first
      try {
        return await tablesApi.get(catalogName, namespace, tableName)
      } catch (icebergError) {
        // If that fails, try to fetch as a generic table
        try {
          return await tablesApi.getGeneric(catalogName, namespace, tableName)
        } catch {
          // If both fail, throw the original Iceberg error
          throw icebergError
        }
      }
    },
    enabled: open && !!catalogName && namespace.length > 0 && !!tableName,
  })

  const tableData = tableQuery.data

  // Check if this is a generic table (has 'table' property) or Iceberg table (has 'metadata' property)
  const isGenericTable = tableData && 'table' in tableData
  const genericTableData = isGenericTable ? (tableData as LoadGenericTableResponse).table : null

  const currentSchema = !isGenericTable && tableData?.metadata?.schemas?.find(
    (s) => s["schema-id"] === tableData.metadata["current-schema-id"]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">
            {tableName}
          </SheetTitle>
          <SheetDescription>
            {namespace.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {catalogName}.{namespace.join(".")}.{tableName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {catalogName}.{tableName}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {tableQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {tableQuery.isError && (
          <div className="py-12">
            <div className="text-sm text-destructive">
              Failed to load table details
            </div>
          </div>
        )}

        {tableData && isGenericTable && genericTableData && (
          <div className="mt-6 space-y-6">
            {/* Generic Table Info */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Generic Table Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-mono text-xs">
                    {genericTableData.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{genericTableData.format}</span>
                </div>
                {genericTableData["base-location"] && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Location:</span>
                    <span className="font-mono text-xs break-all">
                      {genericTableData["base-location"]}
                    </span>
                  </div>
                )}
                {genericTableData.doc && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="text-xs break-all">
                      {genericTableData.doc}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Properties */}
            {genericTableData.properties &&
              Object.keys(genericTableData.properties).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Properties</h3>
                  <div className="border rounded-md">
                    <div className="divide-y">
                      {Object.entries(genericTableData.properties).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="px-3 py-2 flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono text-xs break-all">
                              {String(value)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {tableData && !isGenericTable && (
          <div className="mt-6 space-y-6">
            {/* Iceberg Table Info */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Table Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UUID:</span>
                  <span className="font-mono text-xs">
                    {tableData.metadata["table-uuid"]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format Version:</span>
                  <span>{tableData.metadata["format-version"]}</span>
                </div>
                {tableData.metadata.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-mono text-xs break-all">
                      {tableData.metadata.location}
                    </span>
                  </div>
                )}
                {tableData["metadata-location"] && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Metadata Location:
                    </span>
                    <span className="font-mono text-xs break-all">
                      {tableData["metadata-location"]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Schema */}
            {currentSchema && (
              <TableSchemaDisplay schema={currentSchema} />
            )}

            {/* Properties */}
            {tableData.metadata.properties &&
              Object.keys(tableData.metadata.properties).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Properties</h3>
                  <div className="border rounded-md">
                    <div className="divide-y">
                      {Object.entries(tableData.metadata.properties).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="px-3 py-2 flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono text-xs break-all">
                              {String(value)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* Partition Specs */}
            {tableData.metadata["partition-specs"] &&
              tableData.metadata["partition-specs"].length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    Partition Specifications
                  </h3>
                  <div className="space-y-2">
                    {tableData.metadata["partition-specs"].map((spec) => (
                      <div
                        key={spec["spec-id"]}
                        className="border rounded-md p-3 text-sm"
                      >
                        <div className="font-medium mb-2">
                          Spec ID: {spec["spec-id"]}
                          {spec["spec-id"] ===
                            tableData.metadata["default-spec-id"] && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (default)
                            </span>
                          )}
                        </div>
                        {spec.fields.length > 0 ? (
                          <div className="space-y-1">
                            {spec.fields.map((field, fieldIdx) => (
                              <div key={fieldIdx} className="text-xs">
                                <span className="font-mono">{field.name}</span>{" "}
                                <span className="text-muted-foreground">
                                  {field.transform}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            No partition fields
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* DDL */}
            <TableDDLDisplay
              catalogName={catalogName}
              namespace={namespace}
              tableName={tableName}
              metadata={tableData.metadata}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

