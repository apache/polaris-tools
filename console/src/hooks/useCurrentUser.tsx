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

