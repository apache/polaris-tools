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
import { config } from "@/lib/config"

interface ProxyUser {
  displayName: string | null
  principalName: string | null
  loading: boolean
}

/** Helper to read a field from the proxy body */
function pickField(body: Record<string, unknown>, field: string): string | null {
  const value = body[field.trim()]
  return typeof value === "string" && value !== "" ? value : null
}

/**
 * Hook to fetch the authenticated user from the auth proxy (e.g. oauth2-proxy)
 * when the console is deployed behind it (VITE_PROXY_AUTH=true). In this setup
 * the browser never holds the token - the proxy does. Therefore the  identity
 * comes from the proxy's userinfo endpoint rather than a decoded JWT.
 *
 * The response body shape is not standardized across proxies, so the keys to
 * read are runtime-configurable:
 *   - VITE_PROXY_USER_FIELDS: comma-separated priority list for the header
 *      display name.
 *   - VITE_PROXY_PRINCIPAL_FIELD: single key holding the Polaris principal
 *      name used to fetch principal details/roles (empty = don't fetch).
 *
 * Its a no-op if proxy mode is disabled. Fails silently for any non 200 / non
 * JSON response (e.g. a 401 or a redirect to the IdP when the proxy is absent).
 */
export function useProxyUser(): ProxyUser {
  const { data, isLoading } = useQuery<Record<string, unknown> | null>({
    queryKey: ["proxyUser"],
    queryFn: async () => {
      try {
        const response = await fetch(config.PROXY_USERINFO_PATH, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        if (!response.ok) {
          return null
        }
        const contentType = response.headers.get("content-type") || ""
        if (!contentType.includes("application/json")) {
          return null
        }
        const body = await response.json()
        return body && typeof body === "object" ? (body as Record<string, unknown>) : null
      } catch {
        return null
      }
    },
    enabled: config.PROXY_AUTH,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  })

  let displayName: string | null = null
  if (data) {
    for (const field of config.PROXY_USER_FIELDS.split(",")) {
      displayName = pickField(data, field)
      if (displayName) {
        break
      }
    }
  }

  const principalName =
    data && config.PROXY_PRINCIPAL_FIELD ? pickField(data, config.PROXY_PRINCIPAL_FIELD) : null

  return {
    displayName,
    principalName,
    loading: config.PROXY_AUTH && isLoading,
  }
}
