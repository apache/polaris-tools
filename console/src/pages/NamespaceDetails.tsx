import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Folder, Table as TableIcon, RefreshCw, Trash2, Plus } from "lucide-react"
import { namespacesApi } from "@/api/catalog/namespaces"
import { tablesApi } from "@/api/catalog/tables"
import { catalogsApi } from "@/api/management/catalogs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"

export function NamespaceDetails() {
  const { catalogName, namespace: namespaceParam } = useParams<{
    catalogName: string
    namespace: string
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Parse namespace from URL (e.g., "accounting.tax" -> ["accounting", "tax"])
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

  const tablesQuery = useQuery({
    queryKey: ["tables", catalogName, namespaceArray],
    queryFn: () => tablesApi.list(catalogName!, namespaceArray),
    enabled: !!catalogName && namespaceArray.length > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: () => namespacesApi.delete(catalogName!, namespaceArray),
    onSuccess: () => {
      toast.success("Namespace deleted successfully")
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["namespaces", catalogName] })
      queryClient.invalidateQueries({ queryKey: ["catalog", catalogName] })
      // Navigate back to catalog details
      navigate(`/catalogs/${encodeURIComponent(catalogName!)}`)
    },
    onError: (error: Error) => {
      toast.error("Failed to delete namespace", {
        description: error.message || "An error occurred",
      })
    },
  })

  const catalog = catalogQuery.data
  const namespace = namespaceQuery.data
  const tables = tablesQuery.data ?? []

  const handleTableClick = (tableName: string) => {
    if (!catalogName || !namespaceParam) return
    navigate(
      `/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(namespaceParam)}/tables/${encodeURIComponent(tableName)}`
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  if (!catalogName || !namespaceParam) {
    return <div>Catalog name and namespace are required</div>
  }

  const namespacePath = namespaceArray.join(".")
  const location = namespace?.properties?.location || "Not set"

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/catalogs/${encodeURIComponent(catalogName)}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Folder className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{namespacePath}</h1>
            </div>
            <p className="text-muted-foreground">
              Namespace in catalog: <span className="font-medium">{catalog?.name || catalogName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              namespaceQuery.refetch()
              tablesQuery.refetch()
              catalogQuery.refetch()
            }}
            disabled={namespaceQuery.isFetching || tablesQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={!namespace || deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {namespaceQuery.isLoading ? (
        <div>Loading namespace details...</div>
      ) : namespaceQuery.error ? (
        <div className="text-red-600">
          Error loading namespace: {namespaceQuery.error.message}
        </div>
      ) : !namespace ? (
        <div>Namespace not found</div>
      ) : (
        <>
          {/* Namespace Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Namespace Information</CardTitle>
              <CardDescription>Details about this namespace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Path</label>
                  <p className="mt-1 font-mono">{namespacePath}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="mt-1 font-mono text-sm">{location}</p>
                </div>
                {namespace.properties && Object.keys(namespace.properties).length > 0 && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Properties</label>
                    <div className="mt-2 rounded-md border p-3">
                      <dl className="space-y-1">
                        {Object.entries(namespace.properties).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <dt className="font-mono text-sm text-muted-foreground">{key}:</dt>
                            <dd className="font-mono text-sm">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tables Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tables</CardTitle>
                  <CardDescription>Tables in this namespace</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    // TODO: Open create table modal (future implementation)
                    console.log("Create table - to be implemented")
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Table
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tablesQuery.isLoading ? (
                <div>Loading tables...</div>
              ) : tablesQuery.error ? (
                <div className="text-red-600">
                  Error loading tables: {tablesQuery.error.message}
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No tables found in this namespace.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.map((table, idx) => {
                        const tableNamespace = table.namespace.join(".")
                        return (
                          <TableRow
                            key={idx}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleTableClick(table.name)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TableIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{table.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground text-sm">{tableNamespace}</span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTableClick(table.name)
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete namespace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the namespace "{namespacePath}"?
              {tables.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This namespace contains {tables.length} table(s). The namespace must be empty to be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
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
    </div>
  )
}

