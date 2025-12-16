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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { principalRolesApi } from "@/api/management/principal-roles"
import { getErrorMessage } from "@/lib/errorHandler"
import type { CatalogRole } from "@/types/api"

interface GrantCatalogRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogRole: CatalogRole | null
  onSuccess?: () => void
}

export function GrantCatalogRoleModal({
  open,
  onOpenChange,
  catalogRole,
  onSuccess,
}: GrantCatalogRoleModalProps) {
  const queryClient = useQueryClient()
  const [selectedPrincipalRole, setSelectedPrincipalRole] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedPrincipalRole("")
      setErrorMessage(null)
    }
  }, [open])

  const principalRolesQuery = useQuery({
    queryKey: ["principal-roles"],
    queryFn: principalRolesApi.list,
    enabled: open,
  })

  const grantMutation = useMutation({
    mutationFn: async (principalRoleName: string) => {
      if (!catalogRole) {
        throw new Error("Catalog role is not defined")
      }
      if (!catalogRole.catalogName) {
        throw new Error("Catalog name is missing")
      }
      await catalogRolesApi.grantToPrincipalRole(
        catalogRole.catalogName,
        catalogRole.name,
        principalRoleName
      )
    },
    onSuccess: () => {
      toast.success("Catalog role granted successfully")
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      onSuccess?.()
      setSelectedPrincipalRole("")
      setErrorMessage(null)
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to grant catalog role",
        "catalog role",
        "grant this catalog role"
      )
      setErrorMessage(errorMsg)
      toast.error("Failed to grant catalog role", {
        description: errorMsg,
      })
    },
  })

  const handleGrant = () => {
    if (!selectedPrincipalRole) {
      setErrorMessage("Please select a principal role")
      return
    }
    if (!catalogRole?.catalogName) {
      setErrorMessage("Catalog name is missing")
      return
    }
    grantMutation.mutate(selectedPrincipalRole)
  }

  // Get principal roles that don't already have this catalog role
  const availablePrincipalRoles = principalRolesQuery.data || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Grant Catalog Role to Principal Role</DialogTitle>
          <DialogDescription>
            Select a principal role to grant the catalog role{" "}
            <span className="font-medium">{catalogRole?.name}</span> from catalog{" "}
            <span className="font-medium">{catalogRole?.catalogName}</span> to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!catalogRole?.catalogName && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm text-yellow-800">
                Warning: Catalog name is missing. Cannot grant role without catalog information.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="principalRole">Principal Role</Label>
            <Select
              value={selectedPrincipalRole}
              onValueChange={setSelectedPrincipalRole}
              disabled={!catalogRole?.catalogName}
            >
              <SelectTrigger id="principalRole">
                <SelectValue placeholder="Select a principal role" />
              </SelectTrigger>
              <SelectContent>
                {principalRolesQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading principal roles...
                  </SelectItem>
                ) : availablePrincipalRoles.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No principal roles available
                  </SelectItem>
                ) : (
                  availablePrincipalRoles.map((principalRole) => (
                    <SelectItem key={principalRole.name} value={principalRole.name}>
                      {principalRole.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedPrincipalRole("")
              onOpenChange(false)
            }}
            disabled={grantMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGrant}
            disabled={!selectedPrincipalRole || grantMutation.isPending || !catalogRole?.catalogName}
          >
            {grantMutation.isPending ? "Granting..." : "Grant Role"}
          </Button>
        </DialogFooter>
        {errorMessage && (
          <div className="px-6 pb-4">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

