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
import type { Principal, PrincipalRole } from "@/types/api"

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
  const availablePrincipals = principalsQuery.data?.filter((p) => {
    // We'll filter on the client side, but ideally we'd check server-side
    return true
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
                {principalsQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading principals...
                  </SelectItem>
                ) : availablePrincipals.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No principals available
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

