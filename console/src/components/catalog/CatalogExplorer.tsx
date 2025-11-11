import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CatalogTreeNode, type TreeNode } from "./CatalogTreeNode"
import { catalogsApi } from "@/api/management/catalogs"
import { TableDetailsDrawer } from "./TableDetailsDrawer"

interface CatalogExplorerProps {
  selectedCatalogName?: string
  onSelectCatalog?: (catalogName: string) => void
  className?: string
}

export function CatalogExplorer({
  selectedCatalogName,
  onSelectCatalog,
  className,
}: CatalogExplorerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Table drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<{
    catalogName: string
    namespace: string[]
    tableName: string
  } | null>(null)

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  const catalogs = useMemo(() => catalogsQuery.data || [], [catalogsQuery.data])

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const handleSelectNode = (node: TreeNode) => {
    setSelectedNodeId(node.id)
    if (node.type === "catalog") {
      onSelectCatalog?.(node.name)
    }
  }

  const handleTableClick = (
    catalogName: string,
    namespace: string[],
    tableName: string
  ) => {
    setSelectedTable({ catalogName, namespace, tableName })
    setDrawerOpen(true)
  }

  // Auto-expand selected catalog
  useMemo(() => {
    if (selectedCatalogName) {
      const catalog = catalogs.find((c) => c.name === selectedCatalogName)
      if (catalog) {
        const catalogNodeId = `catalog.${catalog.name}`
        setExpandedNodes((prev) => {
          const next = new Set(prev)
          next.add(catalogNodeId)
          return next
        })
        setSelectedNodeId(catalogNodeId)
      }
    }
  }, [selectedCatalogName, catalogs])

  const catalogNodes: TreeNode[] = catalogs.map((catalog) => ({
    type: "catalog",
    id: `catalog.${catalog.name}`,
    name: catalog.name,
    catalogName: catalog.name,
  }))

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
          "flex flex-col h-full border-r bg-card transition-all duration-200",
          "w-64 md:w-80",
          "fixed md:relative left-0 top-0 z-30 md:z-auto",
          "h-screen",
          className
        )}
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

