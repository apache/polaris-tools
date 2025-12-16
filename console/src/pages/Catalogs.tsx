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
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Database, MoreVertical, Plus, RefreshCw, Search } from "lucide-react"
import { catalogsApi } from "@/api/management/catalogs"
import type { Catalog } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  useReactTable,
} from "@tanstack/react-table"
import type { SortingState } from "@tanstack/react-table"
import { CreateCatalogModal } from "@/components/forms/CreateCatalogModal"
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

const columnHelper = createColumnHelper<Catalog>()

export function Catalogs() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [catalogToDelete, setCatalogToDelete] = useState<Catalog | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedCatalogName, setSelectedCatalogName] = useState<string>()

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => catalogsApi.delete(name),
    onSuccess: () => {
      toast.success("Catalog deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["catalogs"] })
      setCatalogToDelete(null)
    },
    onError: (error: Error) => {
      toast.error("Failed to delete catalog", {
        description: error.message || "An error occurred",
      })
    },
  })

  const filtered = useMemo(() => {
    const items = catalogsQuery.data ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((c) => c.name.toLowerCase().includes(q))
  }, [catalogsQuery.data, search])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: () => (
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <span>Name</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => navigate(`/catalogs/${encodeURIComponent(row.original.name)}`)}
              className="font-medium hover:underline text-left"
            >
              {row.original.name}
            </button>
          </div>
        ),
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      }),
      columnHelper.accessor("type", {
        header: () => <span>Type</span>,
        cell: (ctx) => (
          <Badge variant={ctx.getValue() === "EXTERNAL" ? "secondary" : "success"}>
            {ctx.getValue()}
          </Badge>
        ),
        sortingFn: (a, b) => a.original.type.localeCompare(b.original.type),
      }),
      columnHelper.accessor("createTimestamp", {
        header: () => <span>Created</span>,
        cell: (ctx) => {
          const ts = ctx.getValue()
          return (
            <span className="text-muted-foreground">
              {typeof ts === "number"
                ? formatDistanceToNow(new Date(ts), { addSuffix: true })
                : "-"}
            </span>
          )
        },
        sortingFn: (a, b) => {
          const av = a.original.createTimestamp ?? 0
          const bv = b.original.createTimestamp ?? 0
          return av - bv
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/catalogs/${encodeURIComponent(row.original.name)}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/catalogs/${encodeURIComponent(row.original.name)}`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => setCatalogToDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      }),
    ],
    [navigate]
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
    <div className="flex h-full overflow-hidden">
      {/* Catalog Explorer - Left Sidebar */}
      <CatalogExplorer
        selectedCatalogName={selectedCatalogName}
        onSelectCatalog={setSelectedCatalogName}
      />

      {/* Main Content - Right Side */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Catalogs</h1>
              </div>
              <p className="text-muted-foreground">
                Manage your Iceberg catalogs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 w-56"
                  placeholder="Search catalogs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={() => catalogsQuery.refetch()} disabled={catalogsQuery.isFetching}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Catalog
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {catalogsQuery.isLoading ? "Loading catalogs..." : `${filtered.length} catalog${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} onClick={header.column.getToggleSortingHandler()} className={header.column.getCanSort() ? "cursor-pointer select-none" : undefined}>
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" && <span>▲</span>}
                            {header.column.getIsSorted() === "desc" && <span>▼</span>}
                          </div>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {catalogsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No catalogs found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(
                        selectedCatalogName === row.original.name &&
                          "bg-primary/10 hover:bg-primary/20"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
          </Table>
          </div>

          <Dialog open={!!catalogToDelete} onOpenChange={(open) => !open && setCatalogToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete catalog</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete
                  the catalog <span className="font-medium">{catalogToDelete?.name}</span>.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCatalogToDelete(null)} disabled={deleteMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => catalogToDelete && deleteMutation.mutate(catalogToDelete.name)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <CreateCatalogModal
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onCreated={() => catalogsQuery.refetch()}
          />
        </div>
      </div>
    </div>
  )
}

