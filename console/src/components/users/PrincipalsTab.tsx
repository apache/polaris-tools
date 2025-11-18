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
import { formatDistanceToNow } from "date-fns"
import { MoreVertical, Plus, RefreshCw, Search, User, Shield } from "lucide-react"
import { principalsApi } from "@/api/management/principals"
import { getErrorMessage } from "@/lib/errorHandler"
import type { Principal, PrincipalWithCredentials } from "@/types/api"
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
import { EditPrincipalModal } from "@/components/forms/EditPrincipalModal"
import { CredentialsModal } from "@/components/forms/CredentialsModal"
import { PrincipalDetailsModal } from "@/components/users/PrincipalDetailsModal"

const columnHelper = createColumnHelper<Principal>()

// Component to display principal roles with loading state
function PrincipalRolesCell({ principalName }: { principalName: string }) {
  const rolesQuery = useQuery({
    queryKey: ["principals", principalName, "principal-roles"],
    queryFn: () => principalsApi.listPrincipalRoles(principalName),
    retry: 1,
  })

  if (rolesQuery.isLoading) {
    return <span className="text-muted-foreground text-xs">...</span>
  }

  if (rolesQuery.isError) {
    return <span className="text-muted-foreground text-xs">Error</span>
  }

  const roles = rolesQuery.data || []
  
  if (roles.length === 0) {
    return <span className="text-muted-foreground text-sm">No roles</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Badge
          key={role.name}
          variant="secondary"
          className="text-xs flex items-center gap-1"
        >
          <Shield className="h-3 w-3" />
          {role.name}
        </Badge>
      ))}
    </div>
  )
}

export function PrincipalsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [principalToDelete, setPrincipalToDelete] = useState<Principal | null>(null)
  const [principalToEdit, setPrincipalToEdit] = useState<Principal | null>(null)
  const [principalToView, setPrincipalToView] = useState<Principal | null>(null)
  const [principalToReset, setPrincipalToReset] = useState<Principal | null>(null)
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false)
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    clientId: string
    clientSecret: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const principalsQuery = useQuery({
    queryKey: ["principals"],
    queryFn: principalsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => principalsApi.delete(name),
    onSuccess: () => {
      toast.success("Principal deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      setPrincipalToDelete(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to delete principal",
        "principal",
        "delete this principal"
      )
      setErrorMessage(errorMsg)
      setPrincipalToDelete(null)
      toast.error("Failed to delete principal", {
        description: errorMsg,
      })
    },
  })

  const rotateMutation = useMutation({
    mutationFn: (principalName: string) =>
      principalsApi.rotateCredentials(principalName),
    onSuccess: (data: PrincipalWithCredentials) => {
      toast.success("Credentials rotated successfully")
      // API returns PrincipalWithCredentials with clientId and clientSecret
      setGeneratedCredentials({
        clientId: data.credentials.clientId,
        clientSecret: data.credentials.clientSecret,
      })
      setIsCredentialsModalOpen(true)
      queryClient.invalidateQueries({ queryKey: ["principals"] })
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to rotate credentials",
        "credentials",
        "rotate credentials"
      )
      toast.error("Failed to rotate credentials", {
        description: errorMsg,
      })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (principalName: string) => principalsApi.reset(principalName),
    onSuccess: (data: PrincipalWithCredentials) => {
      toast.success("Credentials reset successfully")
      // API returns PrincipalWithCredentials with clientId and clientSecret
      setGeneratedCredentials({
        clientId: data.credentials.clientId,
        clientSecret: data.credentials.clientSecret,
      })
      setIsCredentialsModalOpen(true)
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      setPrincipalToReset(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to reset credentials",
        "credentials",
        "reset credentials"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to reset credentials", {
        description: errorMsg,
      })
    },
  })

  const filtered = useMemo(() => {
    const items = principalsQuery.data ?? []
    let filtered = items

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q))
    }

    return filtered
  }, [principalsQuery.data, search])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: () => (
          <div className="flex items-center gap-1 cursor-pointer select-none">
            <span>Name</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      }),
      columnHelper.display({
        id: "created",
        header: () => <span>Created</span>,
        cell: ({ row }) => {
          // Try to get timestamp from properties or use a fallback
          // Note: createTimestamp may be present in API response but not in Principal type
          const principal = row.original as Principal & { createTimestamp?: number }
          const timestamp =
            principal.createTimestamp ||
            (typeof principal.properties?.createTimestamp === "string"
              ? parseInt(principal.properties.createTimestamp, 10)
              : typeof principal.properties?.createTimestamp === "number"
              ? principal.properties.createTimestamp
              : undefined)
          return (
            <span className="text-muted-foreground text-sm">
              {timestamp
                ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
                : "-"}
            </span>
          )
        },
      }),
      columnHelper.display({
        id: "roles",
        header: () => <span>Roles</span>,
        cell: ({ row }) => <PrincipalRolesCell principalName={row.original.name} />,
        enableSorting: false,
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
              <DropdownMenuItem onClick={() => setPrincipalToView(row.original)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPrincipalToEdit(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => rotateMutation.mutate(row.original.name)}
              >
                Rotate Credentials
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPrincipalToReset(row.original)}>
                Reset Credentials
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setPrincipalToDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      }),
    ],
    [rotateMutation]
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
              placeholder="Search principals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => principalsQuery.refetch()}
              disabled={principalsQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setPrincipalToEdit({ name: "" })}>
              <Plus className="mr-2 h-4 w-4" />
              Principal
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <p className="text-sm text-muted-foreground">
            {principalsQuery.isLoading
              ? "Loading principals..."
              : `${filtered.length} principal${filtered.length === 1 ? "" : "s"}`}
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
              {principalsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-3 text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-3 text-sm">
                    No principals found
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
        open={!!principalToDelete}
        onOpenChange={(open) => !open && setPrincipalToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Principal</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              principal <span className="font-medium">{principalToDelete?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrincipalToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                principalToDelete && deleteMutation.mutate(principalToDelete.name)
              }
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Credentials Confirmation Dialog */}
      <Dialog
        open={!!principalToReset}
        onOpenChange={(open) => !open && setPrincipalToReset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Credentials</DialogTitle>
            <DialogDescription>
              This will reset the credentials for{" "}
              <span className="font-medium">{principalToReset?.name}</span>. The new
              credentials will be displayed after reset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrincipalToReset(null)}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                principalToReset && resetMutation.mutate(principalToReset.name)
              }
              disabled={resetMutation.isPending}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {principalToEdit && (
        <EditPrincipalModal
          open={!!principalToEdit}
          onOpenChange={(open) => !open && setPrincipalToEdit(null)}
          principal={principalToEdit}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["principals"] })
            queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
            setPrincipalToEdit(null)
          }}
        />
      )}

      {/* View Details Modal */}
      {principalToView && (
        <PrincipalDetailsModal
          open={!!principalToView}
          onOpenChange={(open) => !open && setPrincipalToView(null)}
          principal={principalToView}
        />
      )}

      {/* Credentials Modal */}
      <CredentialsModal
        open={isCredentialsModalOpen}
        onOpenChange={setIsCredentialsModalOpen}
        credentials={generatedCredentials}
      />

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

