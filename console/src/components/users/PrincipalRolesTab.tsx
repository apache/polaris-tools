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
import { MoreVertical, Plus, RefreshCw, Search, Shield, User } from "lucide-react"
import { principalRolesApi } from "@/api/management/principal-roles"
import { principalsApi } from "@/api/management/principals"
import { getErrorMessage } from "@/lib/errorHandler"
import type { PrincipalRole, Principal } from "@/types/api"
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
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  useReactTable,
} from "@tanstack/react-table"
import type { SortingState } from "@tanstack/react-table"
import { CreatePrincipalRoleModal } from "@/components/forms/CreatePrincipalRoleModal"
import { GrantRoleModal } from "@/components/forms/GrantRoleModal"

const columnHelper = createColumnHelper<PrincipalRole & { principalsCount?: number }>()

export function PrincipalRolesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [roleToDelete, setRoleToDelete] = useState<PrincipalRole | null>(null)
  const [roleToEdit, setRoleToEdit] = useState<PrincipalRole | null>(null)
  const [roleToView, setRoleToView] = useState<PrincipalRole | null>(null)
  const [roleToGrant, setRoleToGrant] = useState<PrincipalRole | null>(null)
  const [roleToRevoke, setRoleToRevoke] = useState<{
    role: PrincipalRole
    principal: Principal
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rolesQuery = useQuery({
    queryKey: ["principal-roles"],
    queryFn: principalRolesApi.list,
  })

  // Fetch principals count for each role
  const rolesWithCounts = useMemo(() => {
    if (!rolesQuery.data) return []
    return rolesQuery.data.map((role) => ({
      ...role,
      principalsCount: undefined as number | undefined,
    }))
  }, [rolesQuery.data])

  const deleteMutation = useMutation({
    mutationFn: (name: string) => principalRolesApi.delete(name),
    onSuccess: () => {
      toast.success("Principal role deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      setRoleToDelete(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to delete principal role",
        "principal role",
        "delete this principal role"
      )
      setErrorMessage(errorMsg)
      setRoleToDelete(null)
      toast.error("Failed to delete principal role", {
        description: errorMsg,
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({
      principalName,
      roleName,
    }: {
      principalName: string
      roleName: string
    }) => principalsApi.revokePrincipalRole(principalName, roleName),
    onSuccess: () => {
      toast.success("Principal role revoked successfully")
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      setRoleToRevoke(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to revoke principal role",
        "principal role",
        "revoke this principal role"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to revoke principal role", {
        description: errorMsg,
      })
    },
  })

  const filtered = useMemo(() => {
    const items = rolesWithCounts ?? []
    let filtered = items

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(q))
    }

    return filtered
  }, [rolesWithCounts, search])

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
        id: "principalsCount",
        header: () => <span>Principals</span>,
        cell: ({ row }) => {
          // We'll fetch this dynamically when needed
          return (
            <PrincipalCountCell
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
                Grant to Principal
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
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
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
            <Button
              variant="secondary"
              onClick={() => rolesQuery.refetch()}
              disabled={rolesQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setRoleToEdit({ name: "" })}>
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
            {rolesQuery.isLoading
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
              {rolesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-3 text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-3 text-sm">
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
            <DialogTitle>Delete Principal Role</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              principal role <span className="font-medium">{roleToDelete?.name}</span>.
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
                roleToDelete && deleteMutation.mutate(roleToDelete.name)
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
        <PrincipalRoleDetailsDialog
          open={!!roleToView}
          onOpenChange={(open) => !open && setRoleToView(null)}
          role={roleToView}
          onRevoke={(principal) => setRoleToRevoke({ role: roleToView, principal })}
        />
      )}

      {/* Edit Modal */}
      {roleToEdit && (
        <CreatePrincipalRoleModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setRoleToEdit(null)
          }}
          principalRole={roleToEdit}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
            setRoleToEdit(null)
          }}
        />
      )}

      {/* Grant Role Modal */}
      {roleToGrant && (
        <GrantRoleModal
          open={!!roleToGrant}
          onOpenChange={(open) => !open && setRoleToGrant(null)}
          principalRole={roleToGrant}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
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
            <DialogTitle>Revoke Role</DialogTitle>
            <DialogDescription>
              This will revoke the role{" "}
              <span className="font-medium">{roleToRevoke?.role.name}</span> from
              principal <span className="font-medium">{roleToRevoke?.principal.name}</span>.
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
                  principalName: roleToRevoke.principal.name,
                  roleName: roleToRevoke.role.name,
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

// Component to display principals with loading state
function PrincipalCountCell({ roleName }: { roleName: string }) {
  const principalsQuery = useQuery({
    queryKey: ["principal-roles", roleName, "principals"],
    queryFn: () => principalRolesApi.listPrincipals(roleName),
    retry: 1,
  })

  if (principalsQuery.isLoading) {
    return <span className="text-muted-foreground text-xs">...</span>
  }

  if (principalsQuery.isError) {
    return <span className="text-muted-foreground text-xs">Error</span>
  }

  const principals = principalsQuery.data || []
  
  if (principals.length === 0) {
    return <span className="text-muted-foreground text-sm">No principals</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {principals.map((principal) => (
        <Badge
          key={principal.name}
          variant="secondary"
          className="text-xs flex items-center gap-1"
        >
          <User className="h-3 w-3" />
          {principal.name}
        </Badge>
      ))}
    </div>
  )
}

// Component to show role details with list of assigned principals
function PrincipalRoleDetailsDialog({
  open,
  onOpenChange,
  role,
  onRevoke,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: PrincipalRole
  onRevoke: (principal: Principal) => void
}) {
  const principalsQuery = useQuery({
    queryKey: ["principal-roles", role.name, "principals"],
    queryFn: () => principalRolesApi.listPrincipals(role.name),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Principal Role Details</DialogTitle>
          <DialogDescription>
            View details and manage principals assigned to this role.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Role Name</h3>
            <p className="text-sm">{role.name}</p>
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
            <h3 className="text-sm font-medium">Assigned Principals</h3>
            {principalsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading principals...</p>
            ) : principalsQuery.data && principalsQuery.data.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Principal Name</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {principalsQuery.data.map((principal) => (
                      <TableRow key={principal.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{principal.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRevoke(principal)}
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
                No principals assigned to this role.
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

