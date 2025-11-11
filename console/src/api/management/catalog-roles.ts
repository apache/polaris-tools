import { apiClient } from "../client"
import type { CatalogRole, CatalogRolesResponse, PrincipalRole, PrincipalRolesResponse } from "@/types/api"

// Type guard to check if response has roles array
function hasRolesField(
  data: CatalogRolesResponse | { roles?: CatalogRole[] }
): data is { roles: CatalogRole[] } {
  return Array.isArray((data as { roles?: CatalogRole[] }).roles)
}

export const catalogRolesApi = {
  list: async (catalogName: string): Promise<CatalogRole[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<CatalogRolesResponse>(`/catalogs/${encodeURIComponent(catalogName)}/catalog-roles`)
    // API may return { roles: [...] } or { catalogRoles: [...] }
    const data = response.data
    if (hasRolesField(data)) {
      return data.roles
    }
    return data.catalogRoles || []
  },

  get: async (catalogName: string, catalogRoleName: string): Promise<CatalogRole> => {
    const response = await apiClient
      .getManagementClient()
      .get<CatalogRole>(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(catalogRoleName)}`
      )
    return response.data
  },

  create: async (
    catalogName: string,
    catalogRole: { name: string; properties?: Record<string, string> }
  ): Promise<CatalogRole> => {
    const response = await apiClient
      .getManagementClient()
      .post<CatalogRole>(`/catalogs/${encodeURIComponent(catalogName)}/catalog-roles`, {
        catalogRole,
      })
    return response.data
  },

  update: async (
    catalogName: string,
    catalogRoleName: string,
    catalogRole: { properties?: Record<string, string>; currentEntityVersion?: number }
  ): Promise<CatalogRole> => {
    const response = await apiClient
      .getManagementClient()
      .put<CatalogRole>(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(catalogRoleName)}`,
        {
          currentEntityVersion: catalogRole.currentEntityVersion,
          properties: catalogRole.properties,
        }
      )
    return response.data
  },

  delete: async (catalogName: string, catalogRoleName: string): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(catalogRoleName)}`
      )
  },

  listPrincipalRoles: async (
    catalogName: string,
    catalogRoleName: string
  ): Promise<PrincipalRole[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalRolesResponse>(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(
          catalogRoleName
        )}/principal-roles`
      )
    // API may return { roles: [...] } or { principalRoles: [...] }
    const data = response.data
    if (data.roles) {
      return data.roles
    }
    return data.principalRoles || []
  },

  grantToPrincipalRole: async (
    catalogName: string,
    catalogRoleName: string,
    principalRoleName: string
  ): Promise<void> => {
    // PUT /principal-roles/{principalRoleName}/catalog-roles/{catalogName}
    // Request body: { catalogRole: { name: catalogRoleName } }
    await apiClient
      .getManagementClient()
      .put(
        `/principal-roles/${encodeURIComponent(principalRoleName)}/catalog-roles/${encodeURIComponent(
          catalogName
        )}`,
        {
          catalogRole: {
            name: catalogRoleName,
          },
        }
      )
  },

  revokeFromPrincipalRole: async (
    catalogName: string,
    catalogRoleName: string,
    principalRoleName: string
  ): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(
        `/principal-roles/${encodeURIComponent(principalRoleName)}/catalog-roles/${encodeURIComponent(
          catalogName
        )}/${encodeURIComponent(catalogRoleName)}`
      )
  },
}

