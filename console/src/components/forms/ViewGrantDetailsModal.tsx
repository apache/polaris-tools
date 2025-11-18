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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GrantResource } from "@/types/api"
import { Shield, Database } from "lucide-react"

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

// Helper to get entity name
function getEntityName(grant: GrantResource): string {
  switch (grant.type) {
    case "catalog":
      return "Catalog"
    case "namespace":
      return "Namespace"
    case "table":
      return grant.tableName
    case "view":
      return grant.viewName
    case "policy":
      return grant.policyName
  }
}

// Helper to format namespace array
function formatNamespace(namespace: string[]): string {
  if (namespace.length === 0) return "(root)"
  return namespace.join(".")
}

interface ViewGrantDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grant: GrantResource & { catalogName: string; catalogRoleName: string } | null
  onRevoke?: () => void
}

export function ViewGrantDetailsModal({
  open,
  onOpenChange,
  grant,
  onRevoke,
}: ViewGrantDetailsModalProps) {
  if (!grant) return null

  const entityPath = formatEntityPath(grant)
  const entityName = getEntityName(grant)
  const entityTypeDisplay = grant.type.charAt(0).toUpperCase() + grant.type.slice(1)

  const badgeColors: Record<string, string> = {
    catalog: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    namespace: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    table: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    view: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    policy: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Grant Details</DialogTitle>
          <DialogDescription>
            View detailed information about this privilege grant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Catalog Role Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Catalog Role</h3>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{grant.catalogRoleName}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This privilege is granted to the catalog role above.
            </p>
          </div>

          {/* Catalog Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Catalog</h3>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{grant.catalogName}</span>
            </div>
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Entity Type</h3>
            <Badge
              variant="secondary"
              className={badgeColors[grant.type] || "bg-gray-100 text-gray-800"}
            >
              {entityTypeDisplay}
            </Badge>
          </div>

          {/* Entity Path */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Entity Path</h3>
            <div className="rounded-md border bg-muted/50 p-3">
              <code className="text-sm font-mono">{entityPath}</code>
            </div>
          </div>

          {/* Namespace Details (if applicable) */}
          {grant.type !== "catalog" && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Namespace</h3>
              <div className="rounded-md border bg-muted/50 p-3">
                <code className="text-sm font-mono">
                  {formatNamespace(grant.namespace)}
                </code>
              </div>
            </div>
          )}

          {/* Entity Name (if applicable) */}
          {["table", "view", "policy"].includes(grant.type) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {grant.type.charAt(0).toUpperCase() + grant.type.slice(1)} Name
              </h3>
              <div className="rounded-md border bg-muted/50 p-3">
                <code className="text-sm font-mono">{entityName}</code>
              </div>
            </div>
          )}

          {/* Privilege Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Privilege</h3>
            <div className="rounded-md border bg-muted/50 p-3">
              <Badge variant="outline" className="font-mono text-sm">
                {grant.privilege}
              </Badge>
            </div>
          </div>

          {/* Grant Resource JSON (for debugging/advanced users) */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Grant Resource</h3>
            <div className="rounded-md border bg-muted/50 p-3">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(grant, null, 2)}
              </pre>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onRevoke && (
            <Button variant="destructive" onClick={onRevoke}>
              Revoke
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

