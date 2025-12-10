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
  Principal,
  PrincipalsResponse,
  CreatePrincipalRequest,
  PrincipalWithCredentials,
  PrincipalRole,
  PrincipalRolesResponse,
} from "@/types/api"

export const principalsApi = {
  list: async (): Promise<Principal[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalsResponse>("/principals")
    return response.data.principals
  },

  get: async (principalName: string): Promise<Principal> => {
    const response = await apiClient
      .getManagementClient()
      .get<Principal>(`/principals/${encodeURIComponent(principalName)}`)
    return response.data
  },

  create: async (
    request: CreatePrincipalRequest
  ): Promise<PrincipalWithCredentials> => {
    const response = await apiClient
      .getManagementClient()
      .post<PrincipalWithCredentials>("/principals", request)
    return response.data
  },

  update: async (
    principalName: string,
    principal: Partial<Principal>
  ): Promise<Principal> => {
    const response = await apiClient
      .getManagementClient()
      .put<Principal>(
        `/principals/${encodeURIComponent(principalName)}`,
        principal
      )
    return response.data
  },

  delete: async (principalName: string): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(`/principals/${encodeURIComponent(principalName)}`)
  },

  rotateCredentials: async (
    principalName: string
  ): Promise<PrincipalWithCredentials> => {
    const response = await apiClient
      .getManagementClient()
      .post<PrincipalWithCredentials>(
        `/principals/${encodeURIComponent(principalName)}/rotate`
      )
    return response.data
  },

  reset: async (
    principalName: string,
    newClientId?: string,
    newClientSecret?: string
  ): Promise<PrincipalWithCredentials> => {
    const response = await apiClient
      .getManagementClient()
      .post<PrincipalWithCredentials>(
        `/principals/${encodeURIComponent(principalName)}/reset`,
        {
          clientId: newClientId,
          clientSecret: newClientSecret,
        }
      )
    return response.data
  },

  grantPrincipalRole: async (
    principalName: string,
    principalRoleName: string
  ): Promise<void> => {
    await apiClient
      .getManagementClient()
      .put(
        `/principals/${encodeURIComponent(principalName)}/principal-roles`,
        {
          principalRole: {
            name: principalRoleName,
          },
        }
      )
  },

  revokePrincipalRole: async (
    principalName: string,
    principalRoleName: string
  ): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(
        `/principals/${encodeURIComponent(principalName)}/principal-roles/${encodeURIComponent(principalRoleName)}`
      )
  },

  listPrincipalRoles: async (principalName: string): Promise<PrincipalRole[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<PrincipalRolesResponse>(
        `/principals/${encodeURIComponent(principalName)}/principal-roles`
      )
    return response.data.principalRoles || response.data.roles || []
  },
}

