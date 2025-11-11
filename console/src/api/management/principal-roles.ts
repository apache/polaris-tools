import { apiClient } from "../client"
import type { PrincipalRole, PrincipalRolesResponse, Principal, PrincipalsResponse } from "@/types/api"

export const principalRolesApi = {
  list: async (): Promise<PrincipalRole[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalRolesResponse>("/principal-roles")
    // API may return { roles: [...] } or { principalRoles: [...] }
    // Handle both formats for compatibility
    const data = response.data
    if (data.roles) {
      return data.roles
    }
    return data.principalRoles || []
  },

  get: async (principalRoleName: string): Promise<PrincipalRole> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalRole>(`/principal-roles/${encodeURIComponent(principalRoleName)}`)
    return response.data
  },

  create: async (principalRole: { name: string; properties?: Record<string, string> }): Promise<PrincipalRole> => {
    const response = await apiClient
      .getManagementClient()
      .post<PrincipalRole>("/principal-roles", {
        principalRole,
      })
    return response.data
  },

  update: async (
    principalRoleName: string,
    principalRole: { properties?: Record<string, string>; currentEntityVersion?: number }
  ): Promise<PrincipalRole> => {
    const response = await apiClient
      .getManagementClient()
      .put<PrincipalRole>(
        `/principal-roles/${encodeURIComponent(principalRoleName)}`,
        {
          currentEntityVersion: principalRole.currentEntityVersion,
          properties: principalRole.properties,
        }
      )
    return response.data
  },

  delete: async (principalRoleName: string): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(`/principal-roles/${encodeURIComponent(principalRoleName)}`)
  },

  listPrincipals: async (principalRoleName: string): Promise<Principal[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalsResponse>(
        `/principal-roles/${encodeURIComponent(principalRoleName)}/principals`
      )
    return response.data.principals
  },
}

