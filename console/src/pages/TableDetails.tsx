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
import { ArrowLeft, RefreshCw, Table as TableIcon, Pencil, Trash2 } from "lucide-react"
import { tablesApi } from "@/api/catalog/tables"
import { catalogsApi } from "@/api/management/catalogs"
import { namespacesApi } from "@/api/catalog/namespaces"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableDDLDisplay } from "@/components/catalog/TableDDLDisplay"
import { SchemaViewer } from "@/components/table/SchemaViewer"
import { MetadataViewer } from "@/components/table/MetadataViewer"
import { RenameTableModal } from "@/components/forms/RenameTableModal"
import { EditTablePropertiesModal } from "@/components/forms/EditTablePropertiesModal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type {
  LoadGenericTableResponse,
  GenericTable,
  LoadTableResult,
  TableSchema,
} from "@/types/api"

export function TableDetails() {
  const {
    catalogName,
    namespace: namespaceParam,
    tableName,
  } = useParams<{
    catalogName: string
    namespace: string
    tableName: string
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

  const tableQuery = useQuery<LoadTableResult | LoadGenericTableResponse>({
    queryKey: ["table", catalogName, namespaceArray.join("."), tableName],
    queryFn: async () => {
      // Try to fetch as an Iceberg table first
      try {
        return await tablesApi.get(catalogName!, namespaceArray, tableName!)
      } catch (icebergError) {
        // If that fails, try to fetch as a generic table
        try {
          return await tablesApi.getGeneric(catalogName!, namespaceArray, tableName!)
        } catch {
          // If both fail, throw the original Iceberg error
          throw icebergError
        }
      }
    },
    enabled: !!catalogName && namespaceArray.length > 0 && !!tableName,
  })

  // Modals
  const [renameOpen, setRenameOpen] = useState(false)
  const [editPropsOpen, setEditPropsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const nsPath = namespaceArray.join(".")
  const refreshDisabled =
    tableQuery.isFetching || namespaceQuery.isFetching || catalogQuery.isFetching

  const tableData = tableQuery.data

  // Type guards
  const isGenericTable = tableData ? "table" in tableData : false
  const genericTableData: GenericTable | null =
    isGenericTable && tableData ? (tableData as LoadGenericTableResponse).table : null
  const icebergTableData: LoadTableResult | null =
    !isGenericTable && tableData ? (tableData as LoadTableResult) : null

  // Delete mutations
  const deleteIcebergMutation = useMutation({
    mutationFn: () => tablesApi.delete(catalogName!, namespaceArray, tableName!),
    onSuccess: () => {
      toast.success("Table deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["tables", catalogName, namespaceArray] })
      queryClient.invalidateQueries({ queryKey: ["namespace", catalogName, namespaceArray] })
      navigate(
        `/catalogs/${encodeURIComponent(catalogName!)}/namespaces/${encodeURIComponent(namespaceParam!)}`
      )
    },
    onError: (error: Error) => {
      toast.error("Failed to delete table", {
        description: error.message || "An error occurred",
      })
    },
  })

  const deleteGenericMutation = useMutation({
    mutationFn: () => tablesApi.deleteGeneric(catalogName!, namespaceArray, tableName!),
    onSuccess: () => {
      toast.success("Generic table deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["generic-tables", catalogName, namespaceArray] })
      queryClient.invalidateQueries({ queryKey: ["namespace", catalogName, namespaceArray] })
      navigate(
        `/catalogs/${encodeURIComponent(catalogName!)}/namespaces/${encodeURIComponent(namespaceParam!)}`
      )
    },
    onError: (error: Error) => {
      toast.error("Failed to delete generic table", {
        description: error.message || "An error occurred",
      })
    },
  })

  if (!catalogName || !namespaceParam || !tableName) {
    return <div>Catalog, namespace, and table name are required</div>
  }

  const handleDelete = () => {
    if (isGenericTable) {
      deleteGenericMutation.mutate()
    } else {
      deleteIcebergMutation.mutate()
    }
  }

  const currentSchema: TableSchema | undefined = icebergTableData?.metadata?.schemas?.find(
    (s) => s["schema-id"] === icebergTableData.metadata["current-schema-id"]
  )

  // Render helpers for different states
  const renderLoading = () => <div>Loading table details...</div>

  const renderError = () => (
    <div className="text-red-600">Error loading table: {tableQuery.error?.message}</div>
  )

  const renderNotFound = () => <div>Table not found</div>

  const renderGenericTable = () => {
    if (!genericTableData) return null

    return (
      <>
        {/* Generic Table Information */}
        <Card>
          <CardHeader>
            <CardTitle>Generic Table Information</CardTitle>
            <CardDescription>Metadata for this {genericTableData.format} table</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="mt-1 text-sm font-mono">{genericTableData.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Format</label>
                  <p className="mt-1 text-sm">{genericTableData.format}</p>
                </div>
                {genericTableData["base-location"] && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Base Location
                    </label>
                    <p className="mt-1 text-sm font-mono break-all">
                      {genericTableData["base-location"]}
                    </p>
                  </div>
                )}
                {genericTableData.doc && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="mt-1 text-sm">{genericTableData.doc}</p>
                  </div>
                )}
              </div>
              {genericTableData.properties &&
                Object.keys(genericTableData.properties).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Properties</label>
                    <div className="mt-2 border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Key</th>
                            <th className="px-3 py-2 text-left font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {Object.entries(genericTableData.properties).map(([key, value]) => (
                            <tr key={key} className="hover:bg-muted/50">
                              <td className="px-3 py-2 font-mono text-xs">{key}</td>
                              <td className="px-3 py-2 text-xs break-all">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  const renderIcebergTable = () => {
    if (!icebergTableData) return null

    return (
      <>
        {/* Iceberg Table Information */}
        <Card>
          <CardHeader>
            <CardTitle>Table Information</CardTitle>
            <CardDescription>Core metadata for this table</CardDescription>
          </CardHeader>
          <CardContent>
            <MetadataViewer
              metadata={icebergTableData.metadata}
              metadataLocation={icebergTableData["metadata-location"]}
            />
          </CardContent>
        </Card>

        {/* Schema */}
        {currentSchema && (
          <Card>
            <CardHeader>
              <CardTitle>Schema</CardTitle>
              <CardDescription>Current schema (id {currentSchema["schema-id"]})</CardDescription>
            </CardHeader>
            <CardContent>
              <SchemaViewer schema={currentSchema} />
            </CardContent>
          </Card>
        )}

        {/* Properties and Partition Specs are shown inside MetadataViewer */}

        {/* DDL */}
        <Card>
          <CardHeader>
            <CardTitle>DDL</CardTitle>
            <CardDescription>Generate a CREATE TABLE statement</CardDescription>
          </CardHeader>
          <CardContent>
            <TableDDLDisplay
              catalogName={catalogName!}
              namespace={namespaceArray}
              tableName={tableName!}
              metadata={icebergTableData.metadata}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  const renderTableContent = () => {
    if (tableQuery.isLoading) return renderLoading()
    if (tableQuery.error) return renderError()
    if (!tableData) return renderNotFound()
    if (isGenericTable) return renderGenericTable()
    return renderIcebergTable()
  }

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
              <TableIcon className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{tableName}</h1>
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
              <span className="font-medium">{tableName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              tableQuery.refetch()
              namespaceQuery.refetch()
              catalogQuery.refetch()
            }}
            disabled={refreshDisabled}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {!isGenericTable && (
            <>
              <Button variant="outline" onClick={() => setRenameOpen(true)} disabled={!tableData}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditPropsOpen(true)}
                disabled={!tableData}
              >
                Edit Properties
              </Button>
            </>
          )}
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!tableData}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {renderTableContent()}

      {/* Modals - shown for Iceberg tables only */}
      {icebergTableData && (
        <>
          <RenameTableModal
            open={renameOpen}
            onOpenChange={setRenameOpen}
            catalogName={catalogName}
            namespace={namespaceArray}
            currentName={tableName}
            onRenamed={(newName) => {
              navigate(
                `/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespaceParam)}/tables/${encodeURIComponent(newName)}`
              )
            }}
          />

          <EditTablePropertiesModal
            open={editPropsOpen}
            onOpenChange={setEditPropsOpen}
            catalogName={catalogName}
            namespace={namespaceArray}
            tableName={tableName}
            properties={icebergTableData.metadata.properties}
          />
        </>
      )}

      {/* Delete Confirmation - shown for both Iceberg and Generic tables */}
      {tableData && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {isGenericTable ? "generic table" : "table"}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{tableName}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteIcebergMutation.isPending || deleteGenericMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteIcebergMutation.isPending || deleteGenericMutation.isPending}
              >
                {deleteIcebergMutation.isPending || deleteGenericMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default TableDetails
