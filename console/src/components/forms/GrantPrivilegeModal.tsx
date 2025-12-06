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

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { privilegesApi } from "@/api/management/privileges"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { catalogsApi } from "@/api/management/catalogs"
import { getErrorMessage } from "@/lib/errorHandler"
import type {
  GrantResource,
  CatalogPrivilege,
  NamespacePrivilege,
  TablePrivilege,
  ViewPrivilege,
  PolicyPrivilege,
} from "@/types/api"

// Helper to get valid privileges for each entity type
function getPrivilegesForEntityType(
  entityType: string
): Array<{ value: string; label: string; category: string }> {
  const allPrivileges: Record<
    string,
    Array<{ value: string; label: string; category: string }>
  > = {
    catalog: [
      { value: "CATALOG_MANAGE_ACCESS", label: "CATALOG_MANAGE_ACCESS", category: "Access Control" },
      { value: "CATALOG_MANAGE_CONTENT", label: "CATALOG_MANAGE_CONTENT", category: "Content Management" },
      { value: "CATALOG_MANAGE_METADATA", label: "CATALOG_MANAGE_METADATA", category: "Content Management" },
      { value: "CATALOG_READ_PROPERTIES", label: "CATALOG_READ_PROPERTIES", category: "Properties" },
      { value: "CATALOG_WRITE_PROPERTIES", label: "CATALOG_WRITE_PROPERTIES", category: "Properties" },
      { value: "NAMESPACE_CREATE", label: "NAMESPACE_CREATE", category: "Namespace Operations" },
      { value: "TABLE_CREATE", label: "TABLE_CREATE", category: "Table Operations" },
      { value: "VIEW_CREATE", label: "VIEW_CREATE", category: "View Operations" },
      { value: "NAMESPACE_DROP", label: "NAMESPACE_DROP", category: "Namespace Operations" },
      { value: "TABLE_DROP", label: "TABLE_DROP", category: "Table Operations" },
      { value: "VIEW_DROP", label: "VIEW_DROP", category: "View Operations" },
      { value: "NAMESPACE_LIST", label: "NAMESPACE_LIST", category: "Namespace Operations" },
      { value: "TABLE_LIST", label: "TABLE_LIST", category: "Table Operations" },
      { value: "VIEW_LIST", label: "VIEW_LIST", category: "View Operations" },
      { value: "NAMESPACE_READ_PROPERTIES", label: "NAMESPACE_READ_PROPERTIES", category: "Properties" },
      { value: "TABLE_READ_PROPERTIES", label: "TABLE_READ_PROPERTIES", category: "Properties" },
      { value: "VIEW_READ_PROPERTIES", label: "VIEW_READ_PROPERTIES", category: "Properties" },
      { value: "NAMESPACE_WRITE_PROPERTIES", label: "NAMESPACE_WRITE_PROPERTIES", category: "Properties" },
      { value: "TABLE_WRITE_PROPERTIES", label: "TABLE_WRITE_PROPERTIES", category: "Properties" },
      { value: "VIEW_WRITE_PROPERTIES", label: "VIEW_WRITE_PROPERTIES", category: "Properties" },
      { value: "TABLE_READ_DATA", label: "TABLE_READ_DATA", category: "Data Operations" },
      { value: "TABLE_WRITE_DATA", label: "TABLE_WRITE_DATA", category: "Data Operations" },
      { value: "NAMESPACE_FULL_METADATA", label: "NAMESPACE_FULL_METADATA", category: "Metadata" },
      { value: "TABLE_FULL_METADATA", label: "TABLE_FULL_METADATA", category: "Metadata" },
      { value: "VIEW_FULL_METADATA", label: "VIEW_FULL_METADATA", category: "Metadata" },
      { value: "POLICY_CREATE", label: "POLICY_CREATE", category: "Policy Operations" },
      { value: "POLICY_WRITE", label: "POLICY_WRITE", category: "Policy Operations" },
      { value: "POLICY_READ", label: "POLICY_READ", category: "Policy Operations" },
      { value: "POLICY_DROP", label: "POLICY_DROP", category: "Policy Operations" },
      { value: "POLICY_LIST", label: "POLICY_LIST", category: "Policy Operations" },
      { value: "POLICY_FULL_METADATA", label: "POLICY_FULL_METADATA", category: "Metadata" },
      { value: "CATALOG_ATTACH_POLICY", label: "CATALOG_ATTACH_POLICY", category: "Policy Operations" },
      { value: "CATALOG_DETACH_POLICY", label: "CATALOG_DETACH_POLICY", category: "Policy Operations" },
      { value: "TABLE_ASSIGN_UUID", label: "TABLE_ASSIGN_UUID", category: "Structure Operations" },
      { value: "TABLE_UPGRADE_FORMAT_VERSION", label: "TABLE_UPGRADE_FORMAT_VERSION", category: "Structure Operations" },
      { value: "TABLE_ADD_SCHEMA", label: "TABLE_ADD_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_SET_CURRENT_SCHEMA", label: "TABLE_SET_CURRENT_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_ADD_PARTITION_SPEC", label: "TABLE_ADD_PARTITION_SPEC", category: "Structure Operations" },
      { value: "TABLE_ADD_SORT_ORDER", label: "TABLE_ADD_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_SET_DEFAULT_SORT_ORDER", label: "TABLE_SET_DEFAULT_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_ADD_SNAPSHOT", label: "TABLE_ADD_SNAPSHOT", category: "Structure Operations" },
      { value: "TABLE_SET_SNAPSHOT_REF", label: "TABLE_SET_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOTS", label: "TABLE_REMOVE_SNAPSHOTS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOT_REF", label: "TABLE_REMOVE_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_SET_LOCATION", label: "TABLE_SET_LOCATION", category: "Structure Operations" },
      { value: "TABLE_SET_PROPERTIES", label: "TABLE_SET_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PROPERTIES", label: "TABLE_REMOVE_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_SET_STATISTICS", label: "TABLE_SET_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_STATISTICS", label: "TABLE_REMOVE_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PARTITION_SPECS", label: "TABLE_REMOVE_PARTITION_SPECS", category: "Structure Operations" },
      { value: "TABLE_MANAGE_STRUCTURE", label: "TABLE_MANAGE_STRUCTURE", category: "Structure Operations" },
    ],
    namespace: [
      { value: "CATALOG_MANAGE_ACCESS", label: "CATALOG_MANAGE_ACCESS", category: "Access Control" },
      { value: "CATALOG_MANAGE_CONTENT", label: "CATALOG_MANAGE_CONTENT", category: "Content Management" },
      { value: "CATALOG_MANAGE_METADATA", label: "CATALOG_MANAGE_METADATA", category: "Content Management" },
      { value: "NAMESPACE_CREATE", label: "NAMESPACE_CREATE", category: "Namespace Operations" },
      { value: "TABLE_CREATE", label: "TABLE_CREATE", category: "Table Operations" },
      { value: "VIEW_CREATE", label: "VIEW_CREATE", category: "View Operations" },
      { value: "NAMESPACE_DROP", label: "NAMESPACE_DROP", category: "Namespace Operations" },
      { value: "TABLE_DROP", label: "TABLE_DROP", category: "Table Operations" },
      { value: "VIEW_DROP", label: "VIEW_DROP", category: "View Operations" },
      { value: "NAMESPACE_LIST", label: "NAMESPACE_LIST", category: "Namespace Operations" },
      { value: "TABLE_LIST", label: "TABLE_LIST", category: "Table Operations" },
      { value: "VIEW_LIST", label: "VIEW_LIST", category: "View Operations" },
      { value: "NAMESPACE_READ_PROPERTIES", label: "NAMESPACE_READ_PROPERTIES", category: "Properties" },
      { value: "TABLE_READ_PROPERTIES", label: "TABLE_READ_PROPERTIES", category: "Properties" },
      { value: "VIEW_READ_PROPERTIES", label: "VIEW_READ_PROPERTIES", category: "Properties" },
      { value: "NAMESPACE_WRITE_PROPERTIES", label: "NAMESPACE_WRITE_PROPERTIES", category: "Properties" },
      { value: "TABLE_WRITE_PROPERTIES", label: "TABLE_WRITE_PROPERTIES", category: "Properties" },
      { value: "VIEW_WRITE_PROPERTIES", label: "VIEW_WRITE_PROPERTIES", category: "Properties" },
      { value: "TABLE_READ_DATA", label: "TABLE_READ_DATA", category: "Data Operations" },
      { value: "TABLE_WRITE_DATA", label: "TABLE_WRITE_DATA", category: "Data Operations" },
      { value: "NAMESPACE_FULL_METADATA", label: "NAMESPACE_FULL_METADATA", category: "Metadata" },
      { value: "TABLE_FULL_METADATA", label: "TABLE_FULL_METADATA", category: "Metadata" },
      { value: "VIEW_FULL_METADATA", label: "VIEW_FULL_METADATA", category: "Metadata" },
      { value: "POLICY_CREATE", label: "POLICY_CREATE", category: "Policy Operations" },
      { value: "POLICY_WRITE", label: "POLICY_WRITE", category: "Policy Operations" },
      { value: "POLICY_READ", label: "POLICY_READ", category: "Policy Operations" },
      { value: "POLICY_DROP", label: "POLICY_DROP", category: "Policy Operations" },
      { value: "POLICY_LIST", label: "POLICY_LIST", category: "Policy Operations" },
      { value: "POLICY_FULL_METADATA", label: "POLICY_FULL_METADATA", category: "Metadata" },
      { value: "NAMESPACE_ATTACH_POLICY", label: "NAMESPACE_ATTACH_POLICY", category: "Policy Operations" },
      { value: "NAMESPACE_DETACH_POLICY", label: "NAMESPACE_DETACH_POLICY", category: "Policy Operations" },
      { value: "TABLE_ASSIGN_UUID", label: "TABLE_ASSIGN_UUID", category: "Structure Operations" },
      { value: "TABLE_UPGRADE_FORMAT_VERSION", label: "TABLE_UPGRADE_FORMAT_VERSION", category: "Structure Operations" },
      { value: "TABLE_ADD_SCHEMA", label: "TABLE_ADD_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_SET_CURRENT_SCHEMA", label: "TABLE_SET_CURRENT_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_ADD_PARTITION_SPEC", label: "TABLE_ADD_PARTITION_SPEC", category: "Structure Operations" },
      { value: "TABLE_ADD_SORT_ORDER", label: "TABLE_ADD_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_SET_DEFAULT_SORT_ORDER", label: "TABLE_SET_DEFAULT_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_ADD_SNAPSHOT", label: "TABLE_ADD_SNAPSHOT", category: "Structure Operations" },
      { value: "TABLE_SET_SNAPSHOT_REF", label: "TABLE_SET_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOTS", label: "TABLE_REMOVE_SNAPSHOTS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOT_REF", label: "TABLE_REMOVE_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_SET_LOCATION", label: "TABLE_SET_LOCATION", category: "Structure Operations" },
      { value: "TABLE_SET_PROPERTIES", label: "TABLE_SET_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PROPERTIES", label: "TABLE_REMOVE_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_SET_STATISTICS", label: "TABLE_SET_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_STATISTICS", label: "TABLE_REMOVE_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PARTITION_SPECS", label: "TABLE_REMOVE_PARTITION_SPECS", category: "Structure Operations" },
      { value: "TABLE_MANAGE_STRUCTURE", label: "TABLE_MANAGE_STRUCTURE", category: "Structure Operations" },
    ],
    table: [
      { value: "CATALOG_MANAGE_ACCESS", label: "CATALOG_MANAGE_ACCESS", category: "Access Control" },
      { value: "TABLE_DROP", label: "TABLE_DROP", category: "Table Operations" },
      { value: "TABLE_LIST", label: "TABLE_LIST", category: "Table Operations" },
      { value: "TABLE_READ_PROPERTIES", label: "TABLE_READ_PROPERTIES", category: "Properties" },
      { value: "TABLE_WRITE_PROPERTIES", label: "TABLE_WRITE_PROPERTIES", category: "Properties" },
      { value: "TABLE_READ_DATA", label: "TABLE_READ_DATA", category: "Data Operations" },
      { value: "TABLE_WRITE_DATA", label: "TABLE_WRITE_DATA", category: "Data Operations" },
      { value: "TABLE_FULL_METADATA", label: "TABLE_FULL_METADATA", category: "Metadata" },
      { value: "TABLE_ATTACH_POLICY", label: "TABLE_ATTACH_POLICY", category: "Policy Operations" },
      { value: "TABLE_DETACH_POLICY", label: "TABLE_DETACH_POLICY", category: "Policy Operations" },
      { value: "TABLE_ASSIGN_UUID", label: "TABLE_ASSIGN_UUID", category: "Structure Operations" },
      { value: "TABLE_UPGRADE_FORMAT_VERSION", label: "TABLE_UPGRADE_FORMAT_VERSION", category: "Structure Operations" },
      { value: "TABLE_ADD_SCHEMA", label: "TABLE_ADD_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_SET_CURRENT_SCHEMA", label: "TABLE_SET_CURRENT_SCHEMA", category: "Structure Operations" },
      { value: "TABLE_ADD_PARTITION_SPEC", label: "TABLE_ADD_PARTITION_SPEC", category: "Structure Operations" },
      { value: "TABLE_ADD_SORT_ORDER", label: "TABLE_ADD_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_SET_DEFAULT_SORT_ORDER", label: "TABLE_SET_DEFAULT_SORT_ORDER", category: "Structure Operations" },
      { value: "TABLE_ADD_SNAPSHOT", label: "TABLE_ADD_SNAPSHOT", category: "Structure Operations" },
      { value: "TABLE_SET_SNAPSHOT_REF", label: "TABLE_SET_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOTS", label: "TABLE_REMOVE_SNAPSHOTS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_SNAPSHOT_REF", label: "TABLE_REMOVE_SNAPSHOT_REF", category: "Structure Operations" },
      { value: "TABLE_SET_LOCATION", label: "TABLE_SET_LOCATION", category: "Structure Operations" },
      { value: "TABLE_SET_PROPERTIES", label: "TABLE_SET_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PROPERTIES", label: "TABLE_REMOVE_PROPERTIES", category: "Structure Operations" },
      { value: "TABLE_SET_STATISTICS", label: "TABLE_SET_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_STATISTICS", label: "TABLE_REMOVE_STATISTICS", category: "Structure Operations" },
      { value: "TABLE_REMOVE_PARTITION_SPECS", label: "TABLE_REMOVE_PARTITION_SPECS", category: "Structure Operations" },
      { value: "TABLE_MANAGE_STRUCTURE", label: "TABLE_MANAGE_STRUCTURE", category: "Structure Operations" },
    ],
    view: [
      { value: "CATALOG_MANAGE_ACCESS", label: "CATALOG_MANAGE_ACCESS", category: "Access Control" },
      { value: "VIEW_DROP", label: "VIEW_DROP", category: "View Operations" },
      { value: "VIEW_LIST", label: "VIEW_LIST", category: "View Operations" },
      { value: "VIEW_READ_PROPERTIES", label: "VIEW_READ_PROPERTIES", category: "Properties" },
      { value: "VIEW_WRITE_PROPERTIES", label: "VIEW_WRITE_PROPERTIES", category: "Properties" },
      { value: "VIEW_FULL_METADATA", label: "VIEW_FULL_METADATA", category: "Metadata" },
    ],
    policy: [
      { value: "CATALOG_MANAGE_ACCESS", label: "CATALOG_MANAGE_ACCESS", category: "Access Control" },
      { value: "POLICY_READ", label: "POLICY_READ", category: "Policy Operations" },
      { value: "POLICY_DROP", label: "POLICY_DROP", category: "Policy Operations" },
      { value: "POLICY_WRITE", label: "POLICY_WRITE", category: "Policy Operations" },
      { value: "POLICY_LIST", label: "POLICY_LIST", category: "Policy Operations" },
      { value: "POLICY_FULL_METADATA", label: "POLICY_FULL_METADATA", category: "Metadata" },
      { value: "POLICY_ATTACH", label: "POLICY_ATTACH", category: "Policy Operations" },
      { value: "POLICY_DETACH", label: "POLICY_DETACH", category: "Policy Operations" },
    ],
  }

  return allPrivileges[entityType] || []
}

// Helper to parse namespace path
function parseNamespacePath(path: string): string[] {
  if (!path.trim()) return []
  return path.split(".").map((s) => s.trim()).filter((s) => s.length > 0)
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

// Validation schema
const grantPrivilegeSchema = z
  .object({
    catalogName: z.string().min(1, "Catalog is required"),
    catalogRoleName: z.string().min(1, "Catalog role is required"),
    entityType: z.enum(["catalog", "namespace", "table", "view", "policy"]),
    namespacePath: z.string().optional(),
    entityName: z.string().optional(), // For table, view, policy
    privileges: z.array(z.string()).min(1, "At least one privilege must be selected"),
  })
  .refine(
    (data) => {
      if (data.entityType === "catalog") {
        return true // No additional validation needed
      }
      if (data.entityType === "namespace") {
        // Namespace path is optional (root namespace)
        return true
      }
      // For table, view, policy: namespace and entity name are required
      if (["table", "view", "policy"].includes(data.entityType)) {
        return !!data.entityName && data.entityName.trim().length > 0
      }
      return true
    },
    {
      message: "Entity name is required for tables, views, and policies",
      path: ["entityName"],
    }
  )

type GrantPrivilegeFormData = z.infer<typeof grantPrivilegeSchema>

interface GrantPrivilegeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function GrantPrivilegeModal({
  open,
  onOpenChange,
  onSuccess,
}: GrantPrivilegeModalProps) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<GrantPrivilegeFormData>({
    resolver: zodResolver(grantPrivilegeSchema),
    defaultValues: {
      catalogName: "",
      catalogRoleName: "",
      entityType: "catalog",
      namespacePath: "",
      entityName: "",
      privileges: [],
    },
  })

  const catalogName = form.watch("catalogName")
  const entityType = form.watch("entityType")

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      form.reset()
      setErrorMessage(null)
    }
  }, [open, form])

  // Fetch catalogs
  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
    enabled: open,
  })

  // Fetch catalog roles for selected catalog
  const catalogRolesQuery = useQuery({
    queryKey: ["catalog-roles", catalogName],
    queryFn: () => catalogRolesApi.list(catalogName),
    enabled: open && !!catalogName,
  })

  // Get available privileges for selected entity type
  const availablePrivileges = getPrivilegesForEntityType(entityType)
  const privilegesByCategory = availablePrivileges.reduce(
    (acc, priv) => {
      if (!acc[priv.category]) {
        acc[priv.category] = []
      }
      acc[priv.category].push(priv)
      return acc
    },
    {} as Record<string, Array<{ value: string; label: string; category: string }>>
  )

  // Create grants for each selected privilege
  const grantMutation = useMutation({
    mutationFn: async (data: GrantPrivilegeFormData) => {
      for (const privilege of data.privileges) {
        let grant: GrantResource

        switch (data.entityType) {
          case "catalog":
            grant = {
              type: "catalog",
              privilege: privilege as CatalogPrivilege,
            }
            break
          case "namespace":
            grant = {
              type: "namespace",
              namespace: parseNamespacePath(data.namespacePath || ""),
              privilege: privilege as NamespacePrivilege,
            }
            break
          case "table":
            grant = {
              type: "table",
              namespace: parseNamespacePath(data.namespacePath || ""),
              tableName: data.entityName!,
              privilege: privilege as TablePrivilege,
            }
            break
          case "view":
            grant = {
              type: "view",
              namespace: parseNamespacePath(data.namespacePath || ""),
              viewName: data.entityName!,
              privilege: privilege as ViewPrivilege,
            }
            break
          case "policy":
            grant = {
              type: "policy",
              namespace: parseNamespacePath(data.namespacePath || ""),
              policyName: data.entityName!,
              privilege: privilege as PolicyPrivilege,
            }
            break
          default:
            throw new Error(`Unknown entity type: ${data.entityType}`)
        }

        // Grant each privilege separately
        await privilegesApi.grant(data.catalogName, data.catalogRoleName, grant)
      }
    },
    onSuccess: () => {
      toast.success("Privilege granted successfully")
      queryClient.invalidateQueries({ queryKey: ["grants"] })
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      onSuccess?.()
      form.reset()
      setErrorMessage(null)
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to grant privilege",
        "privilege",
        "grant this privilege"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to grant privilege", {
        description: errorMsg,
      })
    },
  })

  const onSubmit = (data: GrantPrivilegeFormData) => {
    grantMutation.mutate(data)
  }

  const currentPrivileges = form.watch("privileges") || []

  const handlePrivilegeToggle = (privilege: string, checked: boolean) => {
    if (checked) {
      form.setValue("privileges", [...currentPrivileges, privilege])
    } else {
      form.setValue("privileges", currentPrivileges.filter((p) => p !== privilege))
    }
  }

  const handleSelectAllCategory = (_category: string, privileges: Array<{ value: string }>) => {
    const categoryPrivileges = privileges.map((p) => p.value)
    const allSelected = categoryPrivileges.every((p) => currentPrivileges.includes(p))
    
    if (allSelected) {
      // Deselect all in category
      const newSelection = currentPrivileges.filter((p) => !categoryPrivileges.includes(p))
      form.setValue("privileges", newSelection)
    } else {
      // Select all in category
      const newSelection = [...new Set([...currentPrivileges, ...categoryPrivileges])]
      form.setValue("privileges", newSelection)
    }
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Grant Privilege</DialogTitle>
          <DialogDescription>
            Grant privileges to a catalog role on a specific entity.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Catalog Selection */}
          <div className="space-y-2">
            <Label htmlFor="catalogName">Catalog *</Label>
            <Select
              value={form.watch("catalogName")}
              onValueChange={(value) => {
                form.setValue("catalogName", value)
                form.setValue("catalogRoleName", "") // Reset role when catalog changes
              }}
            >
              <SelectTrigger id="catalogName">
                <SelectValue placeholder="Select a catalog" />
              </SelectTrigger>
              <SelectContent>
                {catalogsQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading catalogs...
                  </SelectItem>
                ) : catalogsQuery.data && catalogsQuery.data.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No catalogs available
                  </SelectItem>
                ) : (
                  catalogsQuery.data?.map((catalog) => (
                    <SelectItem key={catalog.name} value={catalog.name}>
                      {catalog.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.catalogName && (
              <p className="text-sm text-red-600">
                {form.formState.errors.catalogName.message}
              </p>
            )}
          </div>

          {/* Catalog Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="catalogRoleName">Catalog Role *</Label>
            <Select
              value={form.watch("catalogRoleName")}
              onValueChange={(value) => form.setValue("catalogRoleName", value)}
              disabled={!catalogName}
            >
              <SelectTrigger id="catalogRoleName">
                <SelectValue placeholder="Select a catalog role" />
              </SelectTrigger>
              <SelectContent>
                {!catalogName ? (
                  <SelectItem value="disabled" disabled>
                    Select a catalog first
                  </SelectItem>
                ) : catalogRolesQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading roles...
                  </SelectItem>
                ) : catalogRolesQuery.data && catalogRolesQuery.data.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No catalog roles available
                  </SelectItem>
                ) : (
                  catalogRolesQuery.data?.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.catalogRoleName && (
              <p className="text-sm text-red-600">
                {form.formState.errors.catalogRoleName.message}
              </p>
            )}
          </div>

          {/* Entity Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="entityType">Entity Type *</Label>
            <Select
              value={form.watch("entityType")}
              onValueChange={(value) => {
                form.setValue("entityType", value as "catalog" | "namespace" | "table" | "view" | "policy")
                form.setValue("namespacePath", "")
                form.setValue("entityName", "")
                form.setValue("privileges", [])
              }}
            >
              <SelectTrigger id="entityType">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="catalog">Catalog</SelectItem>
                <SelectItem value="namespace">Namespace</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.entityType && (
              <p className="text-sm text-red-600">
                {form.formState.errors.entityType.message}
              </p>
            )}
          </div>

          {/* Namespace Path (conditional) */}
          {entityType !== "catalog" && (
            <div className="space-y-2">
              <Label htmlFor="namespacePath">
                Namespace Path {entityType === "namespace" ? "(optional)" : "*"}
              </Label>
              <Input
                id="namespacePath"
                {...form.register("namespacePath")}
                placeholder="ns1.ns2 (period-delimited, leave empty for root)"
              />
              {form.formState.errors.namespacePath && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.namespacePath.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter namespace path as period-delimited segments (e.g., "sales.2024"). Leave empty
                for root namespace.
              </p>
            </div>
          )}

          {/* Entity Name (conditional) */}
          {["table", "view", "policy"].includes(entityType) && (
            <div className="space-y-2">
              <Label htmlFor="entityName">
                {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Name *
              </Label>
              <Input
                id="entityName"
                {...form.register("entityName")}
                placeholder={`Enter ${entityType} name`}
              />
              {form.formState.errors.entityName && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.entityName.message}
                </p>
              )}
            </div>
          )}

          {/* Privilege Selection */}
          <div className="space-y-2">
            <Label>Privileges *</Label>
            <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-4">
              {Object.entries(privilegesByCategory).map(([category, privileges]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{category}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleSelectAllCategory(category, privileges)}
                    >
                      {privileges.every((p) => currentPrivileges.includes(p.value))
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <div className="space-y-2 pl-4">
                    {privileges.map((privilege) => (
                      <div key={privilege.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={privilege.value}
                          checked={currentPrivileges.includes(privilege.value)}
                          onCheckedChange={(checked) =>
                            handlePrivilegeToggle(privilege.value, checked === true)
                          }
                        />
                        <Label
                          htmlFor={privilege.value}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {privilege.label}
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>
                                <strong>{privilege.label}</strong>
                                <br />
                                {getPrivilegeDescription(privilege.value)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.privileges && (
              <p className="text-sm text-red-600">
                {form.formState.errors.privileges.message}
              </p>
            )}
            {currentPrivileges.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {currentPrivileges.length} privilege{currentPrivileges.length === 1 ? "" : "s"}{" "}
                selected
              </p>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={grantMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={grantMutation.isPending}>
              {grantMutation.isPending ? "Granting..." : "Grant Privilege"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  )
}

