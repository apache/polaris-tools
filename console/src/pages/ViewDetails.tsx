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
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, RefreshCw, Eye, Trash2 } from "lucide-react"
import { viewsApi } from "@/api/catalog/views"
import { catalogsApi } from "@/api/management/catalogs"
import { namespacesApi } from "@/api/catalog/namespaces"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SchemaViewer } from "@/components/table/SchemaViewer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function ViewDetails() {
  const {
    catalogName,
    namespace: namespaceParam,
    viewName,
  } = useParams<{
    catalogName: string
    namespace: string
    viewName: string
  }>()

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const namespaceArray = namespaceParam?.split(".") || []

  const catalogQuery = useQuery({
    queryKey: ["catalog", catalogName],
    queryFn: () => catalogsApi.get(catalogName!),
    enabled: !!catalogName,
  })

  const namespaceQuery = useQuery({
    queryKey: ["namespace", catalogName, namespaceArray],
    queryFn: () => namespacesApi.get(catalogName!, namespaceArray),
    enabled: !!catalogName && namespaceArray.length > 0,
  })

  const viewQuery = useQuery({
    queryKey: ["view", catalogName, namespaceArray.join("."), viewName],
    queryFn: () => viewsApi.get(catalogName!, namespaceArray, viewName!),
    enabled: !!catalogName && namespaceArray.length > 0 && !!viewName,
  })

  // Modals
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => viewsApi.delete(catalogName!, namespaceArray, viewName!),
    onSuccess: () => {
      toast.success("View deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["views", catalogName, namespaceArray] })
      queryClient.invalidateQueries({ queryKey: ["namespace", catalogName, namespaceArray] })
      navigate(
        `/catalogs/${encodeURIComponent(catalogName!)}/namespaces/${encodeURIComponent(namespaceParam!)}`
      )
    },
    onError: (error: Error) => {
      toast.error("Failed to delete view", {
        description: error.message || "An error occurred",
      })
    },
  })

  if (!catalogName || !namespaceParam || !viewName) {
    return <div>Catalog, namespace, and view name are required</div>
  }

  const nsPath = namespaceArray.join(".")
  const refreshDisabled =
    viewQuery.isFetching || namespaceQuery.isFetching || catalogQuery.isFetching

  const viewData = viewQuery.data

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  const currentSchema =
    viewData?.metadata?.schemas?.find(
      (s) => s["schema-id"] === viewData.metadata["current-version-id"]
    ) || viewData?.metadata?.schemas?.[0]

  const currentVersion = viewData?.metadata?.versions?.find(
    (v) => v["version-id"] === viewData.metadata["current-version-id"]
  )

  const currentSql = currentVersion?.representations?.find((r) => r.type === "sql")

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                `/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespaceParam)}`
              )
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{viewName}</h1>
            </div>
            <p className="text-muted-foreground">
              <Link
                to={`/catalogs/${encodeURIComponent(catalogName)}`}
                className="underline-offset-2 hover:underline"
              >
                {catalogQuery.data?.name || catalogName}
              </Link>
              <span className="mx-1">/</span>
              <Link
                to={`/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespaceParam)}`}
                className="underline-offset-2 hover:underline"
              >
                {nsPath}
              </Link>
              <span className="mx-1">/</span>
              <span className="font-medium">{viewName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              viewQuery.refetch()
              namespaceQuery.refetch()
              catalogQuery.refetch()
            }}
            disabled={refreshDisabled}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!viewData}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {viewQuery.isLoading ? (
        <div>Loading view details...</div>
      ) : viewQuery.error ? (
        <div className="text-red-600">Error loading view: {viewQuery.error.message}</div>
      ) : !viewData ? (
        <div>View not found</div>
      ) : (
        <>
          {/* View Information */}
          <Card>
            <CardHeader>
              <CardTitle>View Information</CardTitle>
              <CardDescription>Core metadata for this Iceberg view</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">UUID</label>
                    <p className="mt-1 text-sm font-mono">{viewData.metadata["view-uuid"]}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Format Version
                    </label>
                    <p className="mt-1 text-sm">{viewData.metadata["format-version"]}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Current Version ID
                    </label>
                    <p className="mt-1 text-sm">{viewData.metadata["current-version-id"]}</p>
                  </div>
                  {currentSql && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        SQL Dialect
                      </label>
                      <p className="mt-1 text-sm">{currentSql.dialect}</p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p className="mt-1 text-sm font-mono break-all">{viewData.metadata.location}</p>
                  </div>
                  {viewData["metadata-location"] && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Metadata Location
                      </label>
                      <p className="mt-1 text-sm font-mono break-all">
                        {viewData["metadata-location"]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SQL Query */}
          {currentSql && (
            <Card>
              <CardHeader>
                <CardTitle>SQL Query</CardTitle>
                <CardDescription>The SQL definition of this view</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                  {currentSql.sql}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Schema */}
          {currentSchema && (
            <Card>
              <CardHeader>
                <CardTitle>Schema</CardTitle>
                <CardDescription>Output schema of this view</CardDescription>
              </CardHeader>
              <CardContent>
                <SchemaViewer schema={currentSchema} />
              </CardContent>
            </Card>
          )}

          {/* Properties */}
          {viewData.metadata.properties && Object.keys(viewData.metadata.properties).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>View properties</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Key</th>
                        <th className="px-3 py-2 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(viewData.metadata.properties).map(([key, value]) => (
                        <tr key={key} className="hover:bg-muted/50">
                          <td className="px-3 py-2 font-mono text-xs">{key}</td>
                          <td className="px-3 py-2 text-xs break-all">{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          {viewData.metadata.versions && viewData.metadata.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
                <CardDescription>All versions of this view</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {viewData.metadata.versions.map((version) => {
                    const sqlRep = version.representations?.find((r) => r.type === "sql")
                    const isCurrent =
                      version["version-id"] === viewData.metadata["current-version-id"]
                    return (
                      <div
                        key={version["version-id"]}
                        className={`border rounded-md p-3 ${isCurrent ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-2">
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
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      {viewData && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete view</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{viewName}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default ViewDetails
