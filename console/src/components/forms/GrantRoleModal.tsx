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
import { principalsApi } from "@/api/management/principals"
import { principalRolesApi } from "@/api/management/principal-roles"
import type { PrincipalRole } from "@/types/api"

interface GrantRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  principalRole: PrincipalRole | null
  onSuccess?: () => void
}

export function GrantRoleModal({
  open,
  onOpenChange,
  principalRole,
  onSuccess,
}: GrantRoleModalProps) {
  const queryClient = useQueryClient()
  const [selectedPrincipal, setSelectedPrincipal] = useState<string>("")

  const principalsQuery = useQuery({
    queryKey: ["principals"],
    queryFn: principalsApi.list,
    enabled: open,
  })

  // Fetch principals that already have this role
  const principalsWithRoleQuery = useQuery({
    queryKey: ["principal-roles", principalRole?.name, "principals"],
    queryFn: () => principalRolesApi.listPrincipals(principalRole!.name),
    enabled: open && !!principalRole?.name,
  })

  const grantMutation = useMutation({
    mutationFn: async (principalName: string) => {
      if (!principalRole) return
      await principalsApi.grantPrincipalRole(principalName, principalRole.name)
    },
    onSuccess: () => {
      toast.success("Principal role granted successfully")
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      onSuccess?.()
      setSelectedPrincipal("")
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Failed to grant principal role", {
        description: error.message || "An error occurred",
      })
    },
  })

  const handleGrant = () => {
    if (selectedPrincipal) {
      grantMutation.mutate(selectedPrincipal)
    }
  }

  // Get principals that don't already have this role
  const availablePrincipals = principalsQuery.data?.filter((principal) => {
    // Filter out principals that already have this role
    const principalsWithRole = principalsWithRoleQuery.data || []
    return !principalsWithRole.some((p) => p.name === principal.name)
  }) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Grant Role to Principal</DialogTitle>
          <DialogDescription>
            Select a principal to grant the role{" "}
            <span className="font-medium">{principalRole?.name}</span> to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="principal">Principal</Label>
            <Select value={selectedPrincipal} onValueChange={setSelectedPrincipal}>
              <SelectTrigger id="principal">
                <SelectValue placeholder="Select a principal" />
              </SelectTrigger>
              <SelectContent>
                {principalsQuery.isLoading || principalsWithRoleQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading principals...
                  </SelectItem>
                ) : availablePrincipals.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {principalsQuery.data && principalsQuery.data.length > 0
                      ? "All principals already have this role"
                      : "No principals available"}
                  </SelectItem>
                ) : (
                  availablePrincipals.map((principal) => (
                    <SelectItem key={principal.name} value={principal.name}>
                      {principal.name}
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
              setSelectedPrincipal("")
              onOpenChange(false)
            }}
            disabled={grantMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGrant}
            disabled={!selectedPrincipal || grantMutation.isPending}
          >
            Grant Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

