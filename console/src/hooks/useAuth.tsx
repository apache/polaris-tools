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

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "sonner"
import { authApi } from "@/api/auth"
import { apiClient } from "@/api/client"
import { setCurrentWorkspace, clearCurrentWorkspace, getCurrentWorkspace } from "@/lib/workspaces"
import type { Workspace } from "@/types/workspaces"

interface AuthContextType {
  isAuthenticated: boolean
  login: (
    clientId: string,
    clientSecret: string,
    scope: string,
    realm: string,
    workspace?: Workspace
  ) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const token = apiClient.getAccessToken()
    const workspace = getCurrentWorkspace()
    if (token && workspace) {
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const login = async (
    clientId: string,
    clientSecret: string,
    scope: string,
    realm: string,
    workspace?: Workspace
  ) => {
    try {
      if (workspace) {
        setCurrentWorkspace(workspace)
        await authApi.getToken(
          clientId,
          clientSecret,
          scope,
          workspace.realm,
          workspace["realm-header"]
        )
      } else {
        await authApi.getToken(clientId, clientSecret, scope, realm, "Polaris-Realm")
      }
      setIsAuthenticated(true)
    } catch (error) {
      setIsAuthenticated(false)
      throw error
    }
  }

  const logout = () => {
    toast.success("Logged out successfully")
    authApi.logout()
    clearCurrentWorkspace()
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
