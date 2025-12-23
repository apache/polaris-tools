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
import { viewsApi } from "@/api/catalog/views"
import { Loader2 } from "lucide-react"
import { TableSchemaDisplay } from "./TableSchemaDisplay"

interface ViewDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  viewName: string
}

export function ViewDetailsDrawer({
  open,
  onOpenChange,
  catalogName,
  namespace,
  viewName,
}: ViewDetailsDrawerProps) {
  const viewQuery = useQuery({
    queryKey: ["view", catalogName, namespace.join("."), viewName],
    queryFn: () => viewsApi.get(catalogName, namespace, viewName),
    enabled: open && !!catalogName && namespace.length > 0 && !!viewName,
  })

  const viewData = viewQuery.data

  const currentVersion = viewData?.metadata?.versions?.find(
    (v) => v["version-id"] === viewData?.metadata?.["current-version-id"]
  )

  const currentSchema = viewData?.metadata?.schemas?.find(
    (s) => s["schema-id"] === currentVersion?.["schema-id"]
  ) || viewData?.metadata?.schemas?.[0]

  const currentSql = currentVersion?.representations?.find(
    (r) => r.type === "sql"
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">
            {viewName}
          </SheetTitle>
          <SheetDescription>
            {namespace.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {catalogName}.{namespace.join(".")}.{viewName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {catalogName}.{viewName}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {viewQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {viewQuery.isError && (
          <div className="py-12">
            <div className="text-sm text-destructive">
              Failed to load view details
            </div>
          </div>
        )}

        {viewData && (
          <div className="mt-6 space-y-6">
            {/* View Info */}
            <div>
              <h3 className="text-sm font-semibold mb-2">View Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UUID:</span>
                  <span className="font-mono text-xs">
                    {viewData.metadata["view-uuid"]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format Version:</span>
                  <span>{viewData.metadata["format-version"]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Version:</span>
                  <span>{viewData.metadata["current-version-id"]}</span>
                </div>
                {currentSql && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SQL Dialect:</span>
                    <span>{currentSql.dialect}</span>
                  </div>
                )}
                {viewData.metadata.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-mono text-xs break-all">
                      {viewData.metadata.location}
                    </span>
                  </div>
                )}
                {viewData["metadata-location"] && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Metadata Location:
                    </span>
                    <span className="font-mono text-xs break-all">
                      {viewData["metadata-location"]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SQL Query */}
            {currentSql && (
              <div>
                <h3 className="text-sm font-semibold mb-2">SQL Query</h3>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                  {currentSql.sql}
                </pre>
              </div>
            )}

            {/* Schema */}
            {currentSchema && (
              <TableSchemaDisplay schema={currentSchema} />
            )}

            {/* Properties */}
            {viewData.metadata.properties &&
              Object.keys(viewData.metadata.properties).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Properties</h3>
                  <div className="border rounded-md">
                    <div className="divide-y">
                      {Object.entries(viewData.metadata.properties).map(
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

            {/* Version History */}
            {viewData.metadata.versions && viewData.metadata.versions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Version History</h3>
                <div className="space-y-2">
                  {viewData.metadata.versions.map((version) => {
                    const sqlRep = version.representations?.find((r) => r.type === "sql")
                    const isCurrent = version["version-id"] === viewData.metadata["current-version-id"]
                    return (
                      <div
                        key={version["version-id"]}
                        className={`border rounded-md p-3 text-sm ${isCurrent ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            Version {version["version-id"]}
                            {isCurrent && (
                              <span className="ml-2 text-xs text-primary">(current)</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(version["timestamp-ms"]).toLocaleString()}
                          </span>
                        </div>
                        {sqlRep && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Dialect:</span> {sqlRep.dialect}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

