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

import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MoreVertical, Plus, RefreshCw, Search, Shield, Database } from "lucide-react"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { catalogsApi } from "@/api/management/catalogs"
import { getErrorMessage } from "@/lib/errorHandler"
import type { CatalogRole, PrincipalRole } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  useReactTable,
} from "@tanstack/react-table"
import type { SortingState } from "@tanstack/react-table"
import { CreateCatalogRoleModal } from "@/components/forms/CreateCatalogRoleModal"
import { GrantCatalogRoleModal } from "@/components/forms/GrantCatalogRoleModal"

const columnHelper = createColumnHelper<CatalogRole & { principalRolesCount?: number }>()

export function CatalogRolesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedCatalog, setSelectedCatalog] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [roleToDelete, setRoleToDelete] = useState<CatalogRole | null>(null)
  const [roleToEdit, setRoleToEdit] = useState<CatalogRole | null>(null)
  const [roleToView, setRoleToView] = useState<CatalogRole | null>(null)
  const [roleToGrant, setRoleToGrant] = useState<CatalogRole | null>(null)
  const [roleToRevoke, setRoleToRevoke] = useState<{
    role: CatalogRole
    principalRole: PrincipalRole
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  // Fetch catalog roles for all catalogs or selected catalog
  const catalogRolesQueries = useQuery({
    queryKey: ["catalog-roles", selectedCatalog],
    queryFn: async () => {
      if (selectedCatalog === "all") {
        // Fetch roles from all catalogs
        const catalogs = catalogsQuery.data || []
        const allRoles: CatalogRole[] = []
        for (const catalog of catalogs) {
          try {
            const roles = await catalogRolesApi.list(catalog.name)
            allRoles.push(...roles.map((role) => ({ ...role, catalogName: catalog.name })))
          } catch (error) {
            // Ignore errors for individual catalogs
            console.error(`Failed to fetch roles for catalog ${catalog.name}:`, error)
          }
        }
        return allRoles
      } else {
        const roles = await catalogRolesApi.list(selectedCatalog)
        return roles.map((role) => ({ ...role, catalogName: selectedCatalog }))
      }
    },
    enabled: catalogsQuery.isSuccess,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ catalogName, roleName }: { catalogName: string; roleName: string }) =>
      catalogRolesApi.delete(catalogName, roleName),
    onSuccess: () => {
      toast.success("Catalog role deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      setRoleToDelete(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to delete catalog role",
        "catalog role",
        "delete this catalog role"
      )
      setErrorMessage(errorMsg)
      setRoleToDelete(null)
      toast.error("Failed to delete catalog role", {
        description: errorMsg,
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({
      catalogName,
      catalogRoleName,
      principalRoleName,
    }: {
      catalogName: string
      catalogRoleName: string
      principalRoleName: string
    }) => catalogRolesApi.revokeFromPrincipalRole(catalogName, catalogRoleName, principalRoleName),
    onSuccess: () => {
      toast.success("Catalog role revoked successfully")
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      setRoleToRevoke(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to revoke catalog role",
        "catalog role",
        "revoke this catalog role"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to revoke catalog role", {
        description: errorMsg,
      })
    },
  })

  const filtered = useMemo(() => {
    const items = catalogRolesQueries.data ?? []
    let filtered = items

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.catalogName && r.catalogName.toLowerCase().includes(q))
      )
    }

    return filtered
  }, [catalogRolesQueries.data, search])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: () => (
          <div className="flex items-center gap-1 cursor-pointer select-none">
            <span>Role Name</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      }),
      columnHelper.display({
        id: "catalog",
        header: () => <span>Catalog</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{row.original.catalogName || "-"}</span>
          </div>
        ),
        sortingFn: (a, b) =>
          (a.original.catalogName || "").localeCompare(b.original.catalogName || ""),
      }),
      columnHelper.display({
        id: "principalRolesCount",
        header: () => <span>Principal Roles</span>,
        cell: ({ row }) => {
          return (
            <PrincipalRoleCountCell
              catalogName={row.original.catalogName || ""}
              roleName={row.original.name}
            />
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Actions">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRoleToView(row.original)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleToEdit(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleToGrant(row.original)}>
                Grant to Principal Role
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setRoleToDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      }),
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCatalog} onValueChange={setSelectedCatalog}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by catalog" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Catalogs</SelectItem>
                {catalogsQuery.data?.map((catalog) => (
                  <SelectItem key={catalog.name} value={catalog.name}>
                    {catalog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              onClick={() => catalogRolesQueries.refetch()}
              disabled={catalogRolesQueries.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => setRoleToEdit({ name: "", catalogName: selectedCatalog !== "all" ? selectedCatalog : "" } as CatalogRole)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Role
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <p className="text-sm text-muted-foreground">
            {catalogRolesQueries.isLoading
              ? "Loading roles..."
              : `${filtered.length} role${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`${
                        header.column.getCanSort()
                          ? "cursor-pointer select-none"
                          : ""
                      } h-9 px-3 py-2 text-xs font-medium`}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() === "asc" && <span className="text-xs">▲</span>}
                          {header.column.getIsSorted() === "desc" && <span className="text-xs">▼</span>}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {catalogRolesQueries.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-3 text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-3 text-sm">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2 px-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Catalog Role</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              catalog role <span className="font-medium">{roleToDelete?.name}</span> from catalog{" "}
              <span className="font-medium">{roleToDelete?.catalogName}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                roleToDelete &&
                deleteMutation.mutate({
                  catalogName: roleToDelete.catalogName || "",
                  roleName: roleToDelete.name,
                })
              }
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      {roleToView && (
        <CatalogRoleDetailsDialog
          open={!!roleToView}
          onOpenChange={(open) => !open && setRoleToView(null)}
          role={roleToView}
          onRevoke={(principalRole) => setRoleToRevoke({ role: roleToView, principalRole })}
        />
      )}

      {/* Edit Modal */}
      {roleToEdit && (
        <CreateCatalogRoleModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setRoleToEdit(null)
          }}
          catalogRole={roleToEdit}
          defaultCatalogName={roleToEdit.catalogName}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
            setRoleToEdit(null)
          }}
        />
      )}

      {/* Grant Role Modal */}
      {roleToGrant && (
        <GrantCatalogRoleModal
          open={!!roleToGrant}
          onOpenChange={(open) => !open && setRoleToGrant(null)}
          catalogRole={roleToGrant}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
            setRoleToGrant(null)
          }}
        />
      )}

      {/* Revoke Role Confirmation Dialog */}
      <Dialog
        open={!!roleToRevoke}
        onOpenChange={(open) => !open && setRoleToRevoke(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Catalog Role</DialogTitle>
            <DialogDescription>
              This will revoke the catalog role{" "}
              <span className="font-medium">{roleToRevoke?.role.name}</span> from catalog{" "}
              <span className="font-medium">{roleToRevoke?.role.catalogName}</span> from principal
              role <span className="font-medium">{roleToRevoke?.principalRole.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleToRevoke(null)}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                roleToRevoke &&
                revokeMutation.mutate({
                  catalogName: roleToRevoke.role.catalogName || "",
                  catalogRoleName: roleToRevoke.role.name,
                  principalRoleName: roleToRevoke.principalRole.name,
                })
              }
              disabled={revokeMutation.isPending}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={!!errorMessage} onOpenChange={(open) => !open && setErrorMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setErrorMessage(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Component to display principal roles with loading state
function PrincipalRoleCountCell({
  catalogName,
  roleName,
}: {
  catalogName: string
  roleName: string
}) {
  const principalRolesQuery = useQuery({
    queryKey: ["catalog-roles", catalogName, roleName, "principal-roles"],
    queryFn: () => catalogRolesApi.listPrincipalRoles(catalogName, roleName),
    retry: 1,
  })

  if (principalRolesQuery.isLoading) {
    return <span className="text-muted-foreground text-xs">...</span>
  }

  if (principalRolesQuery.isError) {
    return <span className="text-muted-foreground text-xs">Error</span>
  }

  const principalRoles = principalRolesQuery.data || []
  
  if (principalRoles.length === 0) {
    return <span className="text-muted-foreground text-sm">No roles</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {principalRoles.map((principalRole) => (
        <Badge
          key={principalRole.name}
          variant="secondary"
          className="text-xs flex items-center gap-1"
        >
          <Shield className="h-3 w-3" />
          {principalRole.name}
        </Badge>
      ))}
    </div>
  )
}

// Component to show role details with list of assigned principal roles
function CatalogRoleDetailsDialog({
  open,
  onOpenChange,
  role,
  onRevoke,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: CatalogRole
  onRevoke: (principalRole: PrincipalRole) => void
}) {
  const principalRolesQuery = useQuery({
    queryKey: ["catalog-roles", role.catalogName, role.name, "principal-roles"],
    queryFn: () => catalogRolesApi.listPrincipalRoles(role.catalogName || "", role.name),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Catalog Role Details</DialogTitle>
          <DialogDescription>
            View details and manage principal roles assigned to this catalog role.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Role Name</h3>
            <p className="text-sm">{role.name}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Catalog</h3>
            <p className="text-sm">{role.catalogName || "-"}</p>
          </div>

          {role.properties && Object.keys(role.properties).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Properties</h3>
              <div className="rounded-md border p-3 space-y-1">
                {Object.entries(role.properties).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-mono font-medium">{key}:</span>{" "}
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Assigned Principal Roles</h3>
            {principalRolesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading principal roles...</p>
            ) : principalRolesQuery.data && principalRolesQuery.data.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Principal Role Name</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {principalRolesQuery.data.map((principalRole) => (
                      <TableRow key={principalRole.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span>{principalRole.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRevoke(principalRole)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No principal roles assigned to this catalog role.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

