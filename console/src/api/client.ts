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

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { navigate } from "@/lib/navigation"
import { getCurrentWorkspace } from "@/lib/workspaces"

class ApiClient {
  private readonly TOKENS_KEY = "polaris_workspace_tokens"

  private createClient(pathSuffix: string): AxiosInstance {
    const client = axios.create({
      headers: {
        "Content-Type": "application/json",
      },
    })

    client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const workspace = getCurrentWorkspace()
      const token = this.getAccessToken()

      if (workspace?.server?.api) {
        config.baseURL = `${workspace.server.api}${pathSuffix}`
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      if (workspace) {
        const realmHeaderName = workspace["realm-header"] || "Polaris-Realm"
        config.headers[realmHeaderName] = workspace.realm
      }

      return config
    })

    client.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            this.clearAccessToken()
            navigate("/login", true)
          }
        }
        return Promise.reject(error)
      }
    )

    return client
  }

  private getTokensMap(): Record<string, string> {
    const stored = sessionStorage.getItem(this.TOKENS_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return {}
      }
    }
    return {}
  }

  private saveTokensMap(tokens: Record<string, string>): void {
    sessionStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens))
  }

  getAccessToken(workspaceName?: string): string | null {
    const workspace = workspaceName || getCurrentWorkspace()?.name
    if (!workspace) return null

    const tokens = this.getTokensMap()
    return tokens[workspace] || null
  }

  clearAccessToken(workspaceName?: string): void {
    const workspace = workspaceName || getCurrentWorkspace()?.name
    if (!workspace) return

    const tokens = this.getTokensMap()
    delete tokens[workspace]
    this.saveTokensMap(tokens)
  }

  setAccessToken(token: string, workspaceName?: string): void {
    const workspace = workspaceName || getCurrentWorkspace()?.name
    if (!workspace) return

    const tokens = this.getTokensMap()
    tokens[workspace] = token
    this.saveTokensMap(tokens)
  }

  hasToken(workspaceName: string): boolean {
    const tokens = this.getTokensMap()
    return !!tokens[workspaceName]
  }

  getManagementClient(): AxiosInstance {
    return this.createClient("/api/management/v1")
  }

  getCatalogClient(): AxiosInstance {
    return this.createClient("/api/catalog/v1")
  }

  getPolarisClient(): AxiosInstance {
    return this.createClient("/api/catalog/polaris/v1")
  }
}

export const apiClient = new ApiClient()
