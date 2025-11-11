import { apiClient } from "../client"
import type {
  GrantResource,
  GrantResources,
  AddGrantRequest,
  RevokeGrantRequest,
} from "@/types/api"

export const privilegesApi = {
  /**
   * List all grants for a catalog role
   * @param catalogName - The name of the catalog
   * @param catalogRoleName - The name of the catalog role
   * @returns Promise resolving to an array of grant resources
   */
  listGrants: async (
    catalogName: string,
    catalogRoleName: string
  ): Promise<GrantResource[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<GrantResources>(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(
          catalogRoleName
        )}/grants`
      )
    return response.data.grants || []
  },

  /**
   * Grant a privilege to a catalog role
   * @param catalogName - The name of the catalog
   * @param catalogRoleName - The name of the catalog role
   * @param grant - The grant resource to add
   * @returns Promise that resolves when the grant is successfully added
   */
  grant: async (
    catalogName: string,
    catalogRoleName: string,
    grant: GrantResource
  ): Promise<void> => {
    const requestBody: AddGrantRequest = {
      grant,
    }
    await apiClient
      .getManagementClient()
      .put(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(
          catalogRoleName
        )}/grants`,
        requestBody
      )
  },

  /**
   * Revoke a privilege from a catalog role
   * @param catalogName - The name of the catalog
   * @param catalogRoleName - The name of the catalog role
   * @param grant - The grant resource to revoke
   * @param cascade - If true, revoke grants on subresources as well (default: false)
   * @returns Promise that resolves when the grant is successfully revoked
   */
  revoke: async (
    catalogName: string,
    catalogRoleName: string,
    grant: GrantResource,
    cascade: boolean = false
  ): Promise<void> => {
    const requestBody: RevokeGrantRequest = {
      grant,
    }
    await apiClient
      .getManagementClient()
      .post(
        `/catalogs/${encodeURIComponent(catalogName)}/catalog-roles/${encodeURIComponent(
          catalogRoleName
        )}/grants?cascade=${cascade}`,
        requestBody
      )
  },
}

