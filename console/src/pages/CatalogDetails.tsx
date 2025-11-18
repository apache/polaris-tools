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

import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, ArrowLeft, Edit, Plus, Folder, RefreshCw } from "lucide-react"
import { catalogsApi } from "@/api/management/catalogs"
import { namespacesApi } from "@/api/catalog/namespaces"
import type { Namespace } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"
import { EditCatalogModal } from "@/components/forms/EditCatalogModal"
import { CreateNamespaceModal } from "@/components/forms/CreateNamespaceModal"

export function CatalogDetails() {
  const { catalogName } = useParams<{ catalogName: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCreateNamespaceOpen, setIsCreateNamespaceOpen] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ["catalog", catalogName],
    queryFn: () => catalogsApi.get(catalogName!),
    enabled: !!catalogName,
  })

  const namespacesQuery = useQuery({
    queryKey: ["namespaces", catalogName],
    queryFn: () => namespacesApi.list(catalogName!),
    enabled: !!catalogName,
  })

  if (!catalogName) {
    return <div>Catalog name is required</div>
  }

  const catalog = catalogQuery.data
  const namespaces = namespacesQuery.data ?? []

  const handleNamespaceClick = (namespace: Namespace) => {
    const namespacePath = namespace.namespace.join(".")
    navigate(`/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespacePath)}`)
  }

  const defaultBaseLocation = catalog?.properties?.["default-base-location"] || "Not set"

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/catalogs")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{catalog?.name || catalogName}</h1>
            </div>
            <p className="text-muted-foreground">
              Catalog details and configuration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              catalogQuery.refetch()
              namespacesQuery.refetch()
            }}
            disabled={catalogQuery.isFetching || namespacesQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            disabled={!catalog}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {catalogQuery.isLoading ? (
        <div>Loading catalog details...</div>
      ) : catalogQuery.error ? (
        <div className="text-red-600">
          Error loading catalog: {catalogQuery.error.message}
        </div>
      ) : !catalog ? (
        <div>Catalog not found</div>
      ) : (
        <>
          {/* Catalog Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Catalog Information</CardTitle>
              <CardDescription>Basic details about this catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="mt-1">{catalog.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <div className="mt-1">
                    <Badge variant={catalog.type === "EXTERNAL" ? "secondary" : "default"}>
                      {catalog.type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Default Base Location</label>
                  <p className="mt-1 font-mono text-sm">{defaultBaseLocation}</p>
                </div>
                {catalog.createTimestamp && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="mt-1">
                      {formatDistanceToNow(new Date(catalog.createTimestamp), { addSuffix: true })}
                    </p>
                  </div>
                )}
              </div>

              {/* Properties */}
              {catalog.properties && Object.keys(catalog.properties).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Properties</label>
                  <div className="mt-2 rounded-md border p-3">
                    <dl className="space-y-1">
                      {Object.entries(catalog.properties).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="font-mono text-sm text-muted-foreground">{key}:</dt>
                          <dd className="font-mono text-sm">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}

              {/* Storage Configuration */}
              {catalog.storageConfigInfo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Storage Configuration</label>
                  <div className="mt-2 rounded-md border p-3 space-y-2">
                    <div className="flex gap-2">
                      <span className="font-mono text-sm text-muted-foreground">Storage Type:</span>
                      <span className="font-mono text-sm">{catalog.storageConfigInfo.storageType}</span>
                    </div>
                    {catalog.storageConfigInfo.allowedLocations && catalog.storageConfigInfo.allowedLocations.length > 0 && (
                      <div>
                        <span className="font-mono text-sm text-muted-foreground">Allowed Locations:</span>
                        <ul className="mt-1 ml-4 list-disc space-y-1">
                          {catalog.storageConfigInfo.allowedLocations.map((loc, idx) => (
                            <li key={idx} className="font-mono text-sm">{loc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {catalog.storageConfigInfo.storageType === "S3" && (
                      <div className="space-y-1 pt-2 border-t">
                        <div className="flex gap-2">
                          <span className="font-mono text-sm text-muted-foreground">Region:</span>
                          <span className="font-mono text-sm">{catalog.storageConfigInfo.region || "Not set"}</span>
                        </div>
                        {catalog.storageConfigInfo.roleArn && (
                          <div className="flex gap-2">
                            <span className="font-mono text-sm text-muted-foreground">Role ARN:</span>
                            <span className="font-mono text-sm">{catalog.storageConfigInfo.roleArn}</span>
                          </div>
                        )}
                        {catalog.storageConfigInfo.endpoint && (
                          <div className="flex gap-2">
                            <span className="font-mono text-sm text-muted-foreground">Endpoint:</span>
                            <span className="font-mono text-sm">{catalog.storageConfigInfo.endpoint}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {catalog.storageConfigInfo.storageType === "AZURE" && (
                      <div className="space-y-1 pt-2 border-t">
                        {catalog.storageConfigInfo.tenantId && (
                          <div className="flex gap-2">
                            <span className="font-mono text-sm text-muted-foreground">Tenant ID:</span>
                            <span className="font-mono text-sm">{catalog.storageConfigInfo.tenantId}</span>
                          </div>
                        )}
                        {catalog.storageConfigInfo.multiTenantAppName && (
                          <div className="flex gap-2">
                            <span className="font-mono text-sm text-muted-foreground">Multi-tenant App Name:</span>
                            <span className="font-mono text-sm">{catalog.storageConfigInfo.multiTenantAppName}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {catalog.storageConfigInfo.storageType === "GCS" && (
                      <div className="space-y-1 pt-2 border-t">
                        {catalog.storageConfigInfo.gcsServiceAccount && (
                          <div className="flex gap-2">
                            <span className="font-mono text-sm text-muted-foreground">Service Account:</span>
                            <span className="font-mono text-sm">{catalog.storageConfigInfo.gcsServiceAccount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Connection Configuration (for EXTERNAL catalogs) */}
              {catalog.type === "EXTERNAL" && catalog.connectionConfigInfo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Connection Configuration</label>
                  <div className="mt-2 rounded-md border p-3">
                    <div className="flex gap-2">
                      <span className="font-mono text-sm text-muted-foreground">Connection Type:</span>
                      <span className="font-mono text-sm">{catalog.connectionConfigInfo.connectionType}</span>
                    </div>
                    {catalog.connectionConfigInfo.uri && (
                      <div className="flex gap-2 mt-2">
                        <span className="font-mono text-sm text-muted-foreground">URI:</span>
                        <span className="font-mono text-sm">{catalog.connectionConfigInfo.uri}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Namespaces Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Namespaces</CardTitle>
                  <CardDescription>Namespaces in this catalog</CardDescription>
                </div>
                <Button onClick={() => setIsCreateNamespaceOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Namespace
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {namespacesQuery.isLoading ? (
                <div>Loading namespaces...</div>
              ) : namespacesQuery.error ? (
                <div className="text-red-600">
                  Error loading namespaces: {namespacesQuery.error.message}
                </div>
              ) : namespaces.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No namespaces found. Create a namespace to get started.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {namespaces.map((namespace, idx) => {
                        const namespacePath = namespace.namespace.join(".")
                        return (
                          <TableRow
                            key={idx}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleNamespaceClick(namespace)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{namespacePath}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground font-mono text-sm">
                                {namespace.properties?.location || "Not set"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNamespaceClick(namespace)
                                }}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EditCatalogModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        catalog={catalog}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["catalog", catalogName] })
        }}
      />

      <CreateNamespaceModal
        open={isCreateNamespaceOpen}
        onOpenChange={setIsCreateNamespaceOpen}
        catalogName={catalogName}
        onCreated={(namespace) => {
          // Refresh namespaces list
          queryClient.invalidateQueries({ queryKey: ["namespaces", catalogName] })
          // Navigate to the newly created namespace
          const namespacePath = namespace.join(".")
          navigate(`/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespacePath)}`)
        }}
      />
    </div>
  )
}

