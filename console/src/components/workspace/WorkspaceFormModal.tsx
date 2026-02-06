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

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { addWorkspace, updateWorkspace, getDefaultWorkspaceDefaults } from "@/lib/workspaces"
import {
  AuthProviderType,
  type Workspace,
  type WorkspacesConfig,
  type AuthConfig,
} from "@/types/workspaces"
import { Plus, Trash2 } from "lucide-react"

interface WorkspaceFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace | null
  config: WorkspacesConfig
  onSuccess: (config: WorkspacesConfig) => void
}

export function WorkspaceFormModal({
  open,
  onOpenChange,
  workspace,
  config,
  onSuccess,
}: WorkspaceFormModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [realm, setRealm] = useState("")
  const [realmHeader, setRealmHeader] = useState("Polaris-Realm")
  const [apiUrl, setApiUrl] = useState("")
  const [authConfigs, setAuthConfigs] = useState<AuthConfig[]>([
    {
      type: AuthProviderType.INTERNAL,
      url: "",
      scope: "PRINCIPAL_ROLE:ALL",
    },
  ])

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setDescription(workspace.description)
      setIsDefault(workspace.is_default)
      setRealm(workspace.realm)
      setRealmHeader(workspace["realm-header"])
      setApiUrl(workspace.server?.api || "")
      setAuthConfigs(
        workspace.auth.length > 0
          ? workspace.auth
          : [
              {
                type: AuthProviderType.INTERNAL,
                url: "",
                scope: "PRINCIPAL_ROLE:ALL",
              },
            ]
      )
    } else {
      const defaults = getDefaultWorkspaceDefaults()
      setName("")
      setDescription("")
      setIsDefault(false)
      setRealm(defaults.realm)
      setRealmHeader(defaults.realmHeader)
      setApiUrl(defaults.apiUrl)
      setAuthConfigs([
        {
          type: AuthProviderType.INTERNAL,
          url: defaults.authUrl,
          scope: defaults.authScope,
        },
      ])
    }
  }, [workspace, open])

  const addAuthConfig = () => {
    setAuthConfigs([
      ...authConfigs,
      {
        type: AuthProviderType.INTERNAL,
        url: "",
        scope: "PRINCIPAL_ROLE:ALL",
      },
    ])
  }

  const removeAuthConfig = (index: number) => {
    if (authConfigs.length > 1) {
      setAuthConfigs(authConfigs.filter((_, i) => i !== index))
    }
  }

  const updateAuthConfig = (index: number, field: string, value: string) => {
    const updated = [...authConfigs]
    const config = updated[index]

    if (field === "type") {
      if (value === AuthProviderType.INTERNAL) {
        updated[index] = {
          type: AuthProviderType.INTERNAL,
          url: config.url,
          scope: config.scope,
        }
      } else {
        updated[index] = {
          type: AuthProviderType.OIDC,
          url: config.url,
          client_id: "",
          scope: config.scope,
        }
      }
    } else if (field === "url") {
      updated[index] = { ...config, url: value }
    } else if (field === "scope") {
      updated[index] = { ...config, scope: value }
    } else if (field === "client_id" && config.type === AuthProviderType.OIDC) {
      updated[index] = { ...config, client_id: value }
    }

    setAuthConfigs(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newWorkspace: Workspace = {
      name,
      description,
      is_default: isDefault,
      "realm-header": realmHeader,
      realm,
      server: apiUrl ? { api: apiUrl } : undefined,
      auth: authConfigs,
    }

    try {
      let newConfig: WorkspacesConfig
      if (workspace) {
        newConfig = updateWorkspace(config, workspace.name, newWorkspace)
        toast.success(`Workspace "${name}" updated`)
      } else {
        newConfig = addWorkspace(config, newWorkspace)
        toast.success(`Workspace "${name}" created`)
      }
      onSuccess(newConfig)
    } catch {
      toast.error("Failed to save workspace")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{workspace ? "Edit Workspace" : "Add Workspace"}</DialogTitle>
          <DialogDescription>
            {workspace ? "Update workspace configuration" : "Create a new workspace configuration"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="My Workspace"
              />
            </div>
            <div className="flex items-center space-x-2 pb-2">
              <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
              <Label htmlFor="isDefault" className="whitespace-nowrap">
                Set as default
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Workspace description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="realmHeader">Realm Header</Label>
              <Input
                id="realmHeader"
                value={realmHeader}
                onChange={(e) => setRealmHeader(e.target.value)}
                placeholder="Polaris-Realm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="realm">Realm Name *</Label>
              <Input
                id="realm"
                value={realm}
                onChange={(e) => setRealm(e.target.value)}
                required
                placeholder="POLARIS"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiUrl">API URL</Label>
            <Input
              id="apiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8181"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Authentication Methods</h3>
              <Button type="button" variant="outline" size="sm" onClick={addAuthConfig}>
                <Plus className="h-4 w-4 mr-1" />
                Add Auth Method
              </Button>
            </div>

            <div className="space-y-6">
              {authConfigs.map((authConfig, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Auth Method {index + 1}</h4>
                    {authConfigs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAuthConfig(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`authType-${index}`}>Auth Type</Label>
                    <select
                      id={`authType-${index}`}
                      value={authConfig.type}
                      onChange={(e) => updateAuthConfig(index, "type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value={AuthProviderType.INTERNAL}>Internal</option>
                      <option value={AuthProviderType.OIDC}>OIDC</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`authUrl-${index}`}>Auth URL *</Label>
                    <Input
                      id={`authUrl-${index}`}
                      value={authConfig.url}
                      onChange={(e) => updateAuthConfig(index, "url", e.target.value)}
                      required
                      placeholder="http://localhost:8181/api/catalog/v1/oauth/tokens"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`authScope-${index}`}>Scope *</Label>
                    <Input
                      id={`authScope-${index}`}
                      value={authConfig.scope}
                      onChange={(e) => updateAuthConfig(index, "scope", e.target.value)}
                      required
                      placeholder="PRINCIPAL_ROLE:ALL"
                    />
                  </div>

                  {authConfig.type === AuthProviderType.OIDC && (
                    <div className="space-y-2">
                      <Label htmlFor={`authClientId-${index}`}>Client ID *</Label>
                      <Input
                        id={`authClientId-${index}`}
                        value={authConfig.client_id}
                        onChange={(e) => updateAuthConfig(index, "client_id", e.target.value)}
                        required
                        placeholder="client-id"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{workspace ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
