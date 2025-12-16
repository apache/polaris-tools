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

