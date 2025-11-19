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

import { useState, useMemo, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { PanelLeftClose, PanelLeftOpen, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CatalogTreeNode, type TreeNode } from "./CatalogTreeNode"
import { catalogsApi } from "@/api/management/catalogs"
import { TableDetailsDrawer } from "./TableDetailsDrawer"
import { useResizableWidth } from "@/hooks/useResizableWidth"
import { CATALOG_NODE_PREFIX } from "@/lib/constants"

interface CatalogExplorerProps {
  selectedCatalogName?: string
  onSelectCatalog?: (catalogName: string) => void
  className?: string
}

interface SelectedTable {
  catalogName: string
  namespace: string[]
  tableName: string
}

export function CatalogExplorer({
  selectedCatalogName,
  onSelectCatalog,
  className,
}: CatalogExplorerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null)

  // Use custom hook for resizable width
  const { width, isResizing, handleMouseDown } = useResizableWidth()

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  const catalogs = useMemo(() => catalogsQuery.data || [], [catalogsQuery.data])

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const handleSelectNode = useCallback((node: TreeNode) => {
    setSelectedNodeId(node.id)
    if (node.type === "catalog") {
      onSelectCatalog?.(node.name)
    }
  }, [onSelectCatalog])

  const handleTableClick = useCallback((
    catalogName: string,
    namespace: string[],
    tableName: string
  ) => {
    setSelectedTable({ catalogName, namespace, tableName })
    setDrawerOpen(true)
  }, [])

  // Auto-expand selected catalog
  useEffect(() => {
    if (!selectedCatalogName) return

    const catalog = catalogs.find((c) => c.name === selectedCatalogName)
    if (!catalog) return

    const catalogNodeId = `${CATALOG_NODE_PREFIX}${catalog.name}`
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      next.add(catalogNodeId)
      return next
    })
    setSelectedNodeId(catalogNodeId)
  }, [selectedCatalogName, catalogs])

  const catalogNodes: TreeNode[] = useMemo(
    () => catalogs.map((catalog) => ({
      type: "catalog" as const,
      id: `${CATALOG_NODE_PREFIX}${catalog.name}`,
      name: catalog.name,
      catalogName: catalog.name,
    })),
    [catalogs]
  )

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(false)}
        className="fixed left-4 top-20 z-10 md:hidden"
        aria-label="Show catalog explorer"
      >
        <PanelLeftOpen className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col h-full border-r bg-card",
          "fixed md:relative left-0 top-0 z-30 md:z-auto",
          "h-screen",
          !isResizing && "transition-all duration-200",
          className
        )}
        style={{ width: isCollapsed ? undefined : `${width}px` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <h2 className="font-semibold text-sm">Catalog Explorer</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-6 w-6 md:hidden"
            aria-label="Hide catalog explorer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {catalogsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : catalogNodes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground text-center">
                No catalogs found
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {catalogNodes.map((node) => (
                <CatalogTreeNode
                  key={node.id}
                  node={node}
                  catalogs={catalogs}
                  expandedNodes={expandedNodes}
                  selectedNodeId={selectedNodeId}
                  onToggleExpand={handleToggleExpand}
                  onSelectNode={handleSelectNode}
                  onTableClick={handleTableClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resize Handle - Desktop only */}
        {!isCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "hidden md:flex absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
              "bg-border hover:bg-primary/50 transition-colors",
              "group"
            )}
            aria-label="Resize catalog explorer"
            role="separator"
            aria-orientation="vertical"
          >
            <div className="absolute inset-y-0 -right-1 w-3" />
            <GripVertical className="absolute right-1/2 top-1/2 -translate-y-1/2 translate-x-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Table Details Drawer */}
      {selectedTable && (
        <TableDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          catalogName={selectedTable.catalogName}
          namespace={selectedTable.namespace}
          tableName={selectedTable.tableName}
        />
      )}
    </>
  )
}

