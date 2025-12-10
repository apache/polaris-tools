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

