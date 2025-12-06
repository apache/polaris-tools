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

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { privilegesApi } from "@/api/management/privileges"
import { getErrorMessage } from "@/lib/errorHandler"
import type { GrantResource } from "@/types/api"

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

interface RevokePrivilegeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grant: GrantResource & { catalogName: string; catalogRoleName: string } | null
  onSuccess?: () => void
}

export function RevokePrivilegeDialog({
  open,
  onOpenChange,
  grant,
  onSuccess,
}: RevokePrivilegeDialogProps) {
  const queryClient = useQueryClient()
  const [cascade, setCascade] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const revokeMutation = useMutation({
    mutationFn: async ({
      catalogName,
      catalogRoleName,
      grantResource,
      cascadeValue,
    }: {
      catalogName: string
      catalogRoleName: string
      grantResource: GrantResource
      cascadeValue: boolean
    }) => {
      await privilegesApi.revoke(catalogName, catalogRoleName, grantResource, cascadeValue)
    },
    onSuccess: () => {
      toast.success("Privilege revoked successfully")
      queryClient.invalidateQueries({ queryKey: ["grants"] })
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      onSuccess?.()
      setCascade(false)
      setErrorMessage(null)
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to revoke privilege",
        "privilege",
        "revoke this privilege"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to revoke privilege", {
        description: errorMsg,
      })
    },
  })

  const handleRevoke = () => {
    if (!grant) return

    revokeMutation.mutate({
      catalogName: grant.catalogName,
      catalogRoleName: grant.catalogRoleName,
      grantResource: grant,
      cascadeValue: cascade,
    })
  }

  if (!grant) return null

  const entityPath = formatEntityPath(grant)
  const entityName = getEntityName(grant)
  const entityTypeDisplay = grant.type.charAt(0).toUpperCase() + grant.type.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Revoke Privilege</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review what will be revoked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Grant Information */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Catalog Role:</span>
              <span className="text-sm">{grant.catalogRoleName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Catalog:</span>
              <span className="text-sm">{grant.catalogName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Entity Type:</span>
              <span className="text-sm">{entityTypeDisplay}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Entity Path:</span>
              <span className="text-sm font-mono">{entityPath}</span>
            </div>
            {grant.type !== "catalog" && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Entity Name:</span>
                <span className="text-sm font-mono">{entityName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Privilege:</span>
              <span className="text-sm font-mono">{grant.privilege}</span>
            </div>
          </div>

          {/* Cascade Option */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="cascade"
                checked={cascade}
                onCheckedChange={(checked) => setCascade(checked === true)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="cascade"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Cascade to subresources
                </Label>
                <p className="text-xs text-muted-foreground">
                  If checked, revoking privileges on a parent resource will also revoke privileges
                  on all subresources (e.g., revoking namespace privileges will also revoke table
                  privileges in that namespace).
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> This action cannot be undone.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setCascade(false)
              setErrorMessage(null)
              onOpenChange(false)
            }}
            disabled={revokeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={revokeMutation.isPending}
          >
            {revokeMutation.isPending ? "Revoking..." : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

