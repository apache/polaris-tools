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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreVertical, Plus, RefreshCw, Search, Shield, Database } from "lucide-react"
import { privilegesApi } from "@/api/management/privileges"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { catalogsApi } from "@/api/management/catalogs"
import type { GrantResource, CatalogRole } from "@/types/api"
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
import { GrantPrivilegeModal } from "@/components/forms/GrantPrivilegeModal"
import { RevokePrivilegeDialog } from "@/components/forms/RevokePrivilegeDialog"
import { ViewGrantDetailsModal } from "@/components/forms/ViewGrantDetailsModal"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Extended grant type with metadata for display
type GrantWithMetadata = GrantResource & {
  catalogName: string
  catalogRoleName: string
}

const columnHelper = createColumnHelper<GrantWithMetadata>()

// Helper function to format entity path
function formatEntityPath(grant: GrantResource): string {
  switch (grant.type) {
    case "catalog":
      return "(catalog)"
    case "namespace":
      return grant.namespace.length > 0 ? grant.namespace.join(".") : "(root)"
    case "table":
      return grant.namespace.length > 0
        ? `${grant.namespace.join(".")}.${grant.tableName}`
        : grant.tableName
    case "view":
      return grant.namespace.length > 0
        ? `${grant.namespace.join(".")}.${grant.viewName}`
        : grant.viewName
    case "policy":
      return grant.namespace.length > 0
        ? `${grant.namespace.join(".")}.${grant.policyName}`
        : grant.policyName
  }
}

// Helper function to get privilege name (for display)
function getPrivilegeName(privilege: string): string {
  // Return as-is for now, can be formatted later
  return privilege
}

// Helper function to get privilege description
function getPrivilegeDescription(privilege: string): string {
  const descriptions: Record<string, string> = {
    CATALOG_MANAGE_ACCESS: "Manage access control for the catalog",
    CATALOG_MANAGE_CONTENT: "Manage catalog content (tables, views, namespaces)",
    CATALOG_MANAGE_METADATA: "Manage catalog metadata and properties",
    CATALOG_READ_PROPERTIES: "Read catalog properties",
    CATALOG_WRITE_PROPERTIES: "Modify catalog properties",
    NAMESPACE_CREATE: "Create new namespaces",
    NAMESPACE_DROP: "Delete namespaces",
    NAMESPACE_LIST: "List namespaces",
    NAMESPACE_READ_PROPERTIES: "Read namespace properties",
    NAMESPACE_WRITE_PROPERTIES: "Modify namespace properties",
    NAMESPACE_FULL_METADATA: "Full access to namespace metadata",
    TABLE_CREATE: "Create new tables",
    TABLE_DROP: "Delete tables",
    TABLE_LIST: "List tables",
    TABLE_READ_PROPERTIES: "Read table properties",
    TABLE_WRITE_PROPERTIES: "Modify table properties",
    TABLE_READ_DATA: "Read data from tables",
    TABLE_WRITE_DATA: "Write data to tables",
    TABLE_FULL_METADATA: "Full access to table metadata",
    TABLE_ATTACH_POLICY: "Attach policies to tables",
    TABLE_DETACH_POLICY: "Detach policies from tables",
    TABLE_ASSIGN_UUID: "Assign UUID to tables",
    TABLE_UPGRADE_FORMAT_VERSION: "Upgrade table format version",
    TABLE_ADD_SCHEMA: "Add schemas to tables",
    TABLE_SET_CURRENT_SCHEMA: "Set current schema for tables",
    TABLE_ADD_PARTITION_SPEC: "Add partition specifications",
    TABLE_ADD_SORT_ORDER: "Add sort orders",
    TABLE_SET_DEFAULT_SORT_ORDER: "Set default sort order",
    TABLE_ADD_SNAPSHOT: "Add snapshots",
    TABLE_SET_SNAPSHOT_REF: "Set snapshot references",
    TABLE_REMOVE_SNAPSHOTS: "Remove snapshots",
    TABLE_REMOVE_SNAPSHOT_REF: "Remove snapshot references",
    TABLE_SET_LOCATION: "Set table location",
    TABLE_SET_PROPERTIES: "Set table properties",
    TABLE_REMOVE_PROPERTIES: "Remove table properties",
    TABLE_SET_STATISTICS: "Set table statistics",
    TABLE_REMOVE_STATISTICS: "Remove table statistics",
    TABLE_REMOVE_PARTITION_SPECS: "Remove partition specifications",
    TABLE_MANAGE_STRUCTURE: "Manage table structure",
    VIEW_CREATE: "Create new views",
    VIEW_DROP: "Delete views",
    VIEW_LIST: "List views",
    VIEW_READ_PROPERTIES: "Read view properties",
    VIEW_WRITE_PROPERTIES: "Modify view properties",
    VIEW_FULL_METADATA: "Full access to view metadata",
    POLICY_CREATE: "Create new policies",
    POLICY_DROP: "Delete policies",
    POLICY_LIST: "List policies",
    POLICY_READ: "Read policy details",
    POLICY_WRITE: "Modify policies",
    POLICY_FULL_METADATA: "Full access to policy metadata",
    POLICY_ATTACH: "Attach policies to resources",
    POLICY_DETACH: "Detach policies from resources",
    CATALOG_ATTACH_POLICY: "Attach policies to catalog",
    CATALOG_DETACH_POLICY: "Detach policies from catalog",
    NAMESPACE_ATTACH_POLICY: "Attach policies to namespaces",
    NAMESPACE_DETACH_POLICY: "Detach policies from namespaces",
  }
  return descriptions[privilege] || "Privilege description not available"
}

export function PrivilegesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedCatalog, setSelectedCatalog] = useState<string>("all")
  const [selectedCatalogRole, setSelectedCatalogRole] = useState<string>("all")
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "catalogRoleName", desc: false },
  ])
  const [grantToView, setGrantToView] = useState<GrantWithMetadata | null>(null)
  const [grantToRevoke, setGrantToRevoke] = useState<GrantWithMetadata | null>(null)
  const [showGrantModal, setShowGrantModal] = useState(false)

  // Fetch catalogs
  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  // Fetch catalog roles for selected catalog
  const catalogRolesQuery = useQuery({
    queryKey: ["catalog-roles", selectedCatalog],
    queryFn: async () => {
      if (selectedCatalog === "all") {
        const catalogs = catalogsQuery.data || []
        const allRoles: CatalogRole[] = []
        for (const catalog of catalogs) {
          try {
            const roles = await catalogRolesApi.list(catalog.name)
            allRoles.push(...roles.map((role) => ({ ...role, catalogName: catalog.name })))
          } catch (error) {
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

  // Fetch grants for all catalog roles (or filtered)
  const grantsQuery = useQuery({
    queryKey: ["grants", selectedCatalog, selectedCatalogRole],
    queryFn: async () => {
      const roles = catalogRolesQuery.data || []
      let rolesToFetch = roles

      // Filter by catalog role if selected
      if (selectedCatalogRole !== "all") {
        rolesToFetch = roles.filter((role) => role.name === selectedCatalogRole)
      }

      const allGrants: GrantWithMetadata[] = []
      for (const role of rolesToFetch) {
        if (!role.catalogName) continue
        try {
          const grants = await privilegesApi.listGrants(role.catalogName, role.name)
          allGrants.push(
            ...grants.map((grant) => ({
              ...grant,
              catalogName: role.catalogName!,
              catalogRoleName: role.name,
            }))
          )
        } catch (error) {
          console.error(
            `Failed to fetch grants for role ${role.name} in catalog ${role.catalogName}:`,
            error
          )
        }
      }
      return allGrants
    },
    enabled: catalogRolesQuery.isSuccess,
  })

  const filtered = useMemo(() => {
    const items = grantsQuery.data ?? []
    let filtered = items

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (g) =>
          g.catalogRoleName.toLowerCase().includes(q) ||
          g.catalogName.toLowerCase().includes(q) ||
          formatEntityPath(g).toLowerCase().includes(q)
      )
    }

    // Filter by entity type
    if (selectedEntityType !== "all") {
      filtered = filtered.filter((g) => g.type === selectedEntityType)
    }

    return filtered
  }, [grantsQuery.data, search, selectedEntityType])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "catalogRoleName",
        header: () => (
          <div className="flex items-center gap-1 cursor-pointer select-none">
            <span>Catalog Role</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{row.original.catalogRoleName}</span>
          </div>
        ),
        sortingFn: (a, b) =>
          a.original.catalogRoleName.localeCompare(b.original.catalogRoleName),
      }),
      columnHelper.display({
        id: "catalog",
        header: () => <span>Catalog</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{row.original.catalogName}</span>
          </div>
        ),
        sortingFn: (a, b) => a.original.catalogName.localeCompare(b.original.catalogName),
      }),
      columnHelper.display({
        id: "entityType",
        header: () => <span>Entity Type</span>,
        cell: ({ row }) => {
          const type = row.original.type
          const badgeColors: Record<string, string> = {
            catalog: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            namespace: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            table: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
            view: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
            policy: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
          }
          return (
            <Badge
              variant="secondary"
              className={badgeColors[type] || "bg-gray-100 text-gray-800"}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
          )
        },
        sortingFn: (a, b) => a.original.type.localeCompare(b.original.type),
      }),
      columnHelper.display({
        id: "entityPath",
        header: () => <span>Entity Path</span>,
        cell: ({ row }) => (
          <span className="text-sm font-mono">{formatEntityPath(row.original)}</span>
        ),
        sortingFn: (a, b) =>
          formatEntityPath(a.original).localeCompare(formatEntityPath(b.original)),
      }),
      columnHelper.display({
        id: "privilege",
        header: () => <span>Privilege</span>,
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  {getPrivilegeName(row.original.privilege)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  <strong>{row.original.privilege}</strong>
                  <br />
                  {getPrivilegeDescription(row.original.privilege)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
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
              <DropdownMenuItem onClick={() => setGrantToView(row.original)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setGrantToRevoke(row.original)}
              >
                Revoke
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

  // Get unique catalog roles for filter dropdown
  const availableCatalogRoles = useMemo(() => {
    const roles = catalogRolesQuery.data || []
    const unique = new Map<string, string>()
    roles.forEach((role) => {
      unique.set(role.name, role.name)
    })
    return Array.from(unique.values()).sort()
  }, [catalogRolesQuery.data])

  // Reset catalog role filter when catalog changes
  const handleCatalogChange = (value: string) => {
    setSelectedCatalog(value)
    setSelectedCatalogRole("all")
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalogs"] })
    queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
    queryClient.invalidateQueries({ queryKey: ["grants"] })
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-center">
          <div className="w-full max-w-4xl flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search privileges..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={grantsQuery.isFetching || catalogRolesQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${grantsQuery.isFetching || catalogRolesQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button onClick={() => setShowGrantModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Grant Privilege
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl flex items-center gap-4 flex-wrap">
          <Select value={selectedCatalog} onValueChange={handleCatalogChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Catalogs" />
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

          <Select
            value={selectedCatalogRole}
            onValueChange={setSelectedCatalogRole}
            disabled={selectedCatalog === "all" && availableCatalogRoles.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Catalog Roles</SelectItem>
              {availableCatalogRoles.map((roleName) => (
                <SelectItem key={roleName} value={roleName}>
                  {roleName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="catalog">Catalog</SelectItem>
              <SelectItem value="namespace">Namespace</SelectItem>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <p className="text-sm text-muted-foreground">
            {grantsQuery.isLoading
              ? "Loading privileges..."
              : `${filtered.length} privilege${filtered.length === 1 ? "" : "s"}`}
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
                        header.column.getCanSort() ? "cursor-pointer select-none" : ""
                      } h-9 px-3 py-2 text-xs font-medium`}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && (
                            <span className="text-xs">▲</span>
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <span className="text-xs">▼</span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {grantsQuery.isLoading ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    <TableCell colSpan={6} className="py-3">
                      <div className="flex items-center gap-4">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : grantsQuery.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive">
                        Failed to load privileges
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grantsQuery.error instanceof Error
                          ? grantsQuery.error.message
                          : "An error occurred while fetching privileges. Please try refreshing."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => grantsQuery.refetch()}
                        className="mt-2"
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-3 text-sm"
                  >
                    {grantsQuery.data && grantsQuery.data.length === 0
                      ? "No privileges granted. Click '+ Grant Privilege' to get started."
                      : "No privileges match your filters. Try adjusting your search criteria."}
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

      {/* View Details Modal */}
      <ViewGrantDetailsModal
        open={!!grantToView}
        onOpenChange={(open) => !open && setGrantToView(null)}
        grant={grantToView}
        onRevoke={() => {
          if (grantToView) {
            setGrantToRevoke(grantToView)
            setGrantToView(null)
          }
        }}
      />

      {/* Revoke Dialog */}
      <RevokePrivilegeDialog
        open={!!grantToRevoke}
        onOpenChange={(open) => !open && setGrantToRevoke(null)}
        grant={grantToRevoke}
        onSuccess={() => {
          handleRefresh()
        }}
      />

      {/* Grant Privilege Modal */}
      <GrantPrivilegeModal
        open={showGrantModal}
        onOpenChange={setShowGrantModal}
        onSuccess={() => {
          handleRefresh()
        }}
      />
      </div>
    </TooltipProvider>
  )
}

