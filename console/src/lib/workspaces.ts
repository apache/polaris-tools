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

import { AuthProviderType, type WorkspacesConfig, type Workspace } from "@/types/workspaces"

const DEFAULT_WORKSPACE: Workspace = {
  name: "Default Polaris",
  description: "Default Polaris Workspace",
  is_default: true,
  "realm-header": "Polaris-Realm",
  realm: "POLARIS",
  server: {
    api: "http://localhost:8181"
  },
  auth: [
    {
      type: AuthProviderType.INTERNAL,
      url: "http://localhost:8181/api/v1/oauth/tokens",
      scope: "PRINCIPAL_ROLE:ALL"
    }
  ]
}

const WORKSPACES_STORAGE_KEY = "polaris_workspaces_config"

export async function loadWorkspacesFromServer(): Promise<WorkspacesConfig> {
  try {
    const response = await fetch('/workspaces.json')
    if (response.ok) {
      const config = await response.json() as WorkspacesConfig
      return config
    }
  } catch (error) {
    console.warn('Failed to load workspaces.json from server:', error)
  }

  return {
    workspaces: [DEFAULT_WORKSPACE]
  }
}

export async function loadWorkspacesConfig(): Promise<WorkspacesConfig> {
  const stored = localStorage.getItem(WORKSPACES_STORAGE_KEY)

  if (stored) {
    try {
      return JSON.parse(stored) as WorkspacesConfig
    } catch (error) {
      console.warn('Failed to parse stored workspaces config:', error)
    }
  }

  const serverConfig = await loadWorkspacesFromServer()
  saveWorkspacesConfig(serverConfig)
  return serverConfig
}

export function saveWorkspacesConfig(config: WorkspacesConfig): void {
  localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(config))
}

export function clearWorkspacesConfig(): void {
  localStorage.removeItem(WORKSPACES_STORAGE_KEY)
}

export function getDefaultWorkspace(config: WorkspacesConfig): Workspace {
  const defaultWs = config.workspaces.find(ws => ws.is_default)
  return defaultWs || config.workspaces[0] || DEFAULT_WORKSPACE
}

export function getWorkspaceByName(config: WorkspacesConfig, name: string): Workspace | undefined {
  return config.workspaces.find(ws => ws.name === name)
}

export function getCurrentWorkspace(): Workspace | null {
  const workspaceJson = localStorage.getItem('polaris_workspace')
  if (workspaceJson) {
    try {
      return JSON.parse(workspaceJson) as Workspace
    } catch {
      return null
    }
  }
  return null
}

export function setCurrentWorkspace(workspace: Workspace): void {
  localStorage.setItem('polaris_workspace', JSON.stringify(workspace))
}

export function clearCurrentWorkspace(): void {
  localStorage.removeItem('polaris_workspace')
}

export function addWorkspace(config: WorkspacesConfig, workspace: Workspace): WorkspacesConfig {
  const newConfig = {
    workspaces: [...config.workspaces, workspace]
  }
  saveWorkspacesConfig(newConfig)
  return newConfig
}

export function updateWorkspace(config: WorkspacesConfig, oldName: string, workspace: Workspace): WorkspacesConfig {
  const newConfig = {
    workspaces: config.workspaces.map(ws => ws.name === oldName ? workspace : ws)
  }
  saveWorkspacesConfig(newConfig)
  return newConfig
}

export function deleteWorkspace(config: WorkspacesConfig, name: string): WorkspacesConfig {
  const newConfig = {
    workspaces: config.workspaces.filter(ws => ws.name !== name)
  }
  saveWorkspacesConfig(newConfig)
  return newConfig
}

export async function reloadFromServer(): Promise<WorkspacesConfig> {
  clearWorkspacesConfig()
  const serverConfig = await loadWorkspacesFromServer()
  saveWorkspacesConfig(serverConfig)
  return serverConfig
}

