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
import { useQuery } from "@tanstack/react-query"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function TableDetails() {
  const { catalogName, namespace: namespaceParam, tableName } = useParams<{
    catalogName: string
    namespace: string
    tableName: string
  }>()

  const navigate = useNavigate()

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

  const tableQuery = useQuery({
    queryKey: ["table", catalogName, namespaceArray.join("."), tableName],
    queryFn: () => tablesApi.get(catalogName!, namespaceArray, tableName!),
    enabled: !!catalogName && namespaceArray.length > 0 && !!tableName,
  })

  // Modals
  const [renameOpen, setRenameOpen] = useState(false)
  const [editPropsOpen, setEditPropsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!catalogName || !namespaceParam || !tableName) {
    return <div>Catalog, namespace, and table name are required</div>
  }

  const nsPath = namespaceArray.join(".")
  const refreshDisabled = tableQuery.isFetching || namespaceQuery.isFetching || catalogQuery.isFetching

  const tableData = tableQuery.data
  const currentSchema = tableData?.metadata.schemas.find(
    (s) => s["schema-id"] === tableData.metadata["current-schema-id"]
  )

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
          <Button variant="outline" onClick={() => setRenameOpen(true)} disabled={!tableData}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </Button>
          <Button variant="outline" onClick={() => setEditPropsOpen(true)} disabled={!tableData}>
            Edit Properties
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!tableData}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {tableQuery.isLoading ? (
        <div>Loading table details...</div>
      ) : tableQuery.error ? (
        <div className="text-red-600">Error loading table: {tableQuery.error.message}</div>
      ) : !tableData ? (
        <div>Table not found</div>
      ) : (
        <>
          {/* Table Information */}
          <Card>
            <CardHeader>
              <CardTitle>Table Information</CardTitle>
              <CardDescription>Core metadata for this table</CardDescription>
            </CardHeader>
            <CardContent>
              <MetadataViewer metadata={tableData.metadata} metadataLocation={tableData["metadata-location"]} />
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
                catalogName={catalogName}
                namespace={namespaceArray}
                tableName={tableName}
                metadata={tableData.metadata}
              />
            </CardContent>
          </Card>

          {/* Modals */}
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
            properties={tableData.metadata.properties}
          />

          {/* Delete Confirmation */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete table</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{tableName}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await tablesApi.delete(catalogName, namespaceArray, tableName)
                    navigate(`/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespaceParam)}`)
                  }}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

export default TableDetails
