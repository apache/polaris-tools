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

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Database,
  Folder,
  FolderOpen,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { namespacesApi } from "@/api/catalog/namespaces"
import { tablesApi } from "@/api/catalog/tables"
import type { Catalog } from "@/types/api"

export type TreeNodeType = "catalog" | "namespace" | "table"

export interface TreeNode {
  type: TreeNodeType
  id: string
  name: string
  namespace?: string[] // For namespaces and tables
  catalogName?: string // For namespaces and tables
  parent?: TreeNode
}

interface CatalogTreeNodeProps {
  node: TreeNode
  catalogs: Catalog[]
  expandedNodes: Set<string>
  selectedNodeId?: string
  onToggleExpand: (nodeId: string) => void
  onSelectNode?: (node: TreeNode) => void
  onTableClick?: (catalogName: string, namespace: string[], tableName: string) => void
}

export function CatalogTreeNode({
  node,
  catalogs,
  expandedNodes,
  selectedNodeId,
  onToggleExpand,
  onSelectNode,
  onTableClick,
}: CatalogTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id)
  const isSelected = selectedNodeId === node.id

  // Fetch namespaces when catalog is expanded
  const catalogNameForQuery = node.catalogName || (node.type === "catalog" ? node.name : "")

  const namespacesQuery = useQuery({
    queryKey: ["namespaces", catalogNameForQuery],
    queryFn: () => namespacesApi.list(catalogNameForQuery),
    enabled: node.type === "catalog" && isExpanded && !!catalogNameForQuery,
  })

  // Build the full namespace path for this namespace node
  // For a top-level namespace like ["accounting"], the node has:
  //   name: "accounting", namespace: []
  //   So currentNamespacePath = [...[], "accounting"] = ["accounting"]
  // For a nested namespace like ["accounting", "tax"], the node has:
  //   name: "tax", namespace: ["accounting"]
  //   So currentNamespacePath = [["accounting"], "tax"] = ["accounting", "tax"]
  const currentNamespacePath = useMemo(() => {
    if (node.type === "namespace") {
      const parentNamespace = node.namespace && Array.isArray(node.namespace) ? node.namespace : []
      return [...parentNamespace, node.name]
    }
    return []
  }, [node.type, node.namespace, node.name])

  const childNamespacesQuery = useQuery({
    queryKey: [
      "namespaces",
      node.catalogName || "",
      currentNamespacePath.join(".") || "",
    ],
    queryFn: () =>
      namespacesApi.list(node.catalogName || "", currentNamespacePath),
    enabled:
      node.type === "namespace" &&
      isExpanded &&
      !!node.catalogName &&
      currentNamespacePath.length > 0,
  })

  // Fetch tables when namespace is expanded
  const tablesQuery = useQuery({
    queryKey: [
      "tables",
      node.catalogName || "",
      currentNamespacePath.join(".") || "",
    ],
    queryFn: () =>
      tablesApi.list(node.catalogName || "", currentNamespacePath),
    enabled:
      node.type === "namespace" &&
      isExpanded &&
      !!node.catalogName &&
      currentNamespacePath.length > 0,
  })

  const handleClick = () => {
    // Only toggle expand/collapse, don't navigate when clicking in tree
    if (node.type === "catalog") {
      onToggleExpand(node.id)
      onSelectNode?.(node)
    } else if (node.type === "namespace") {
      // Toggle expansion to show tables and child namespaces
      onToggleExpand(node.id)
      onSelectNode?.(node)
    } else if (node.type === "table") {
      // Open table details drawer when clicking a table
      if (node.catalogName && node.namespace && node.namespace.length > 0) {
        onTableClick?.(node.catalogName, node.namespace, node.name)
      }
      onSelectNode?.(node)
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(node.id)
  }

  const childNodes = useMemo(() => {
    const children: TreeNode[] = []

    if (node.type === "catalog") {
      // Add top-level namespaces under catalog
      // API returns top-level namespaces when no parent is specified
      // e.g., [{namespace: ["accounting"]}, {namespace: ["sales"]}]
      // Note: The API should only return top-level namespaces (length 1), but we handle any length
      const namespaces = namespacesQuery.data || []
      namespaces.forEach((ns) => {
        if (!ns.namespace || !Array.isArray(ns.namespace) || ns.namespace.length === 0) {
          return // Skip invalid namespaces
        }
        
        // When listing from catalog (no parent), API should return only top-level namespaces
        // like ["accounting"]. However, if it returns nested ones like ["accounting", "tax"],
        // we only want to show the top-level ones (those with length 1).
        // For simplicity, we'll show all, but filter to only show single-level namespaces
        // as top-level children (multi-level ones will appear under their parent namespace)
        
        // Only show single-level namespaces as direct children of catalog
        // Multi-level namespaces like ["accounting", "tax"] will appear when "accounting" is expanded
        if (ns.namespace.length === 1) {
          const namespaceId = `${node.id}.${ns.namespace[0]}`
          children.push({
            type: "namespace",
            id: namespaceId,
            name: ns.namespace[0], // Top-level namespace name
            namespace: [], // No parent (top-level)
            catalogName: node.name,
            parent: node,
          })
        }
      })
    } else if (node.type === "namespace") {
      // Add child namespaces (nested namespaces)
      // When we query with parent=["accounting"], API returns namespaces like:
      //   [{namespace: ["accounting", "tax"]}, {namespace: ["accounting", "internal"]}]
      const childNamespaces = childNamespacesQuery.data || []
      childNamespaces.forEach((ns) => {
        if (!ns.namespace || !Array.isArray(ns.namespace) || ns.namespace.length === 0) {
          return // Skip invalid namespaces
        }
        
        // ns.namespace is the full path, e.g., ["accounting", "tax"]
        // currentNamespacePath is ["accounting"]
        // So we want to extract "tax" as the child name
        // and use ["accounting"] as the parent
        if (ns.namespace.length <= currentNamespacePath.length) {
          return // Skip - this shouldn't happen, child should be deeper
        }
        
        // Verify this namespace is actually a child (starts with currentNamespacePath)
        const isChild = currentNamespacePath.every(
          (part, index) => part === ns.namespace[index]
        )
        if (!isChild) {
          return // Skip - not a direct child
        }
        
        const childName = ns.namespace[currentNamespacePath.length]
        const namespaceId = `${node.id}.${childName}`
        
        children.push({
          type: "namespace",
          id: namespaceId,
          name: childName,
          namespace: currentNamespacePath, // This namespace is the parent
          catalogName: node.catalogName,
          parent: node,
        })
      })

      // Add tables under namespace
      // Tables API returns identifiers like [{namespace: ["accounting"], name: "users"}]
      const tables = tablesQuery.data || []
      tables.forEach((table) => {
        const namespaceId = `${node.id}.table.${table.name}`
        children.push({
          type: "table",
          id: namespaceId,
          name: table.name,
          namespace: currentNamespacePath, // Full namespace path where table resides
          catalogName: node.catalogName,
          parent: node,
        })
      })
    }

    return children
  }, [
    node,
    namespacesQuery.data,
    childNamespacesQuery.data,
    tablesQuery.data,
    currentNamespacePath,
  ])

  const isLoading =
    (node.type === "catalog" && namespacesQuery.isLoading) ||
    (node.type === "namespace" &&
      (childNamespacesQuery.isLoading || tablesQuery.isLoading))

  const Icon = useMemo(() => {
    if (node.type === "catalog") return Database
    if (node.type === "namespace") return isExpanded ? FolderOpen : Folder
    return TableIcon
  }, [node.type, isExpanded])

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-primary/10 text-primary"
        )}
        onClick={handleClick}
      >
        {(node.type === "catalog" || node.type === "namespace") ? (
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-4 h-4 p-0 hover:bg-accent rounded"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{node.name}</span>
      </div>

      {isExpanded && (
        <div className="ml-4 border-l border-border pl-2">
              {childNodes.map((child) => (
                <CatalogTreeNode
                  key={child.id}
                  node={child}
                  catalogs={catalogs}
                  expandedNodes={expandedNodes}
                  selectedNodeId={selectedNodeId}
                  onToggleExpand={onToggleExpand}
                  onSelectNode={onSelectNode}
                  onTableClick={onTableClick}
                />
              ))}
          {!isLoading && childNodes.length === 0 && node.type !== "table" && (
            <div className="px-2 py-1 text-xs text-muted-foreground italic">
              No {node.type === "catalog" ? "namespaces" : "tables"} found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

