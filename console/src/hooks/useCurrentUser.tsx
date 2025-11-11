import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/api/client"
import { principalsApi } from "@/api/management/principals"
import { getPrincipalNameFromToken } from "@/lib/utils"
import type { Principal, PrincipalRole } from "@/types/api"

interface CurrentUserInfo {
  principal: Principal | null
  principalRoles: PrincipalRole[]
  loading: boolean
  error: Error | null
}

/**
 * Hook to fetch the current logged-in user's principal information
 * Decodes the JWT token to get the principal name, then fetches full details
 */
export function useCurrentUser(): CurrentUserInfo {
  const token = apiClient.getAccessToken()

  // Get principal name from token
  const principalName = token ? getPrincipalNameFromToken(token) : null

  // Fetch principal details
  const {
    data: principal,
    isLoading: principalLoading,
    error: principalError,
  } = useQuery<Principal | null>({
    queryKey: ["currentUser", principalName],
    queryFn: async () => {
      if (!principalName) {
        return null
      }
      try {
        return await principalsApi.get(principalName)
      } catch (error) {
        console.error("Failed to fetch principal:", error)
        return null
      }
    },
    enabled: !!principalName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Fetch principal roles
  const {
    data: principalRoles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery<PrincipalRole[]>({
    queryKey: ["currentUserRoles", principalName],
    queryFn: async () => {
      if (!principalName) {
        return []
      }
      try {
        const roles = await principalsApi.listPrincipalRoles(principalName)
        return roles || []
      } catch (error) {
        // If roles endpoint fails, it's not critical - just return empty array
        console.warn("Failed to fetch principal roles:", error)
        return []
      }
    },
    enabled: !!principalName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once for roles since it's not critical
  })

  return {
    principal: principal || null,
    principalRoles,
    loading: principalLoading || rolesLoading,
    error: principalError || rolesError || null,
  }
}

