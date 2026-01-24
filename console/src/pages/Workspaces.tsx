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
import { Link, useNavigate } from "react-router-dom"
import { Plus, RefreshCw, Pencil, Trash2, Server, ArrowLeft, LogIn, LogOut } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  loadWorkspacesConfig,
  deleteWorkspace,
  reloadFromServer,
  getCurrentWorkspace,
  setCurrentWorkspace as saveCurrentWorkspace,
} from "@/lib/workspaces"
import { WorkspaceFormModal } from "@/components/workspace/WorkspaceFormModal"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { apiClient } from "@/api/client"
import { catalogsApi } from "@/api/management/catalogs"
import type { Workspace, WorkspacesConfig } from "@/types/workspaces"
import { Logo } from "@/components/layout/Logo.tsx"

export function Workspaces() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [config, setConfig] = useState<WorkspacesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [tokenStatus, setTokenStatus] = useState<Record<string, "valid" | "invalid" | "checking">>(
    {}
  )

  useEffect(() => {
    loadConfig()
    setCurrentWorkspace(getCurrentWorkspace())
  }, [])

  useEffect(() => {
    if (config) {
      validateTokens()
    }
  }, [config])

  const validateTokens = async () => {
    if (!config) return

    for (const workspace of config.workspaces) {
      if (apiClient.hasToken(workspace.name)) {
        setTokenStatus((prev) => ({ ...prev, [workspace.name]: "checking" }))

        try {
          const token = apiClient.getAccessToken(workspace.name)
          if (!token) {
            setTokenStatus((prev) => ({ ...prev, [workspace.name]: "invalid" }))
            continue
          }

          const realmHeader = workspace["realm-header"] || "Polaris-Realm"
          await apiClient.getManagementClient().get("/catalogs", {
            headers: {
              Authorization: `Bearer ${token}`,
              [realmHeader]: workspace.realm,
            },
          })

          setTokenStatus((prev) => ({ ...prev, [workspace.name]: "valid" }))
        } catch (error) {
          setTokenStatus((prev) => ({ ...prev, [workspace.name]: "invalid" }))
          apiClient.clearAccessToken(workspace.name)
        }
      }
    }
  }

  const loadConfig = async () => {
    setLoading(true)
    try {
      const cfg = await loadWorkspacesConfig()
      setConfig(cfg)
    } catch {
      toast.error("Failed to load workspaces")
    } finally {
      setLoading(false)
    }
  }

  const handleResetClick = () => {
    setResetDialogOpen(true)
  }

  const confirmReset = async () => {
    setResetDialogOpen(false)
    setLoading(true)
    try {
      const cfg = await reloadFromServer()
      setConfig(cfg)
      toast.success("Workspaces reset to defaults")
    } catch {
      toast.error("Failed to reset to defaults")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (workspace: Workspace, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setWorkspaceToDelete(workspace)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!config || !workspaceToDelete) return

    try {
      const newConfig = deleteWorkspace(config, workspaceToDelete.name)
      setConfig(newConfig)
      toast.success(`Workspace "${workspaceToDelete.name}" deleted`)
      setDeleteDialogOpen(false)
      setWorkspaceToDelete(null)
    } catch {
      toast.error("Failed to delete workspace")
    }
  }

  const handleEdit = (workspace: Workspace, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedWorkspace(workspace)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedWorkspace(null)
    setIsFormOpen(true)
  }

  const handleFormSuccess = (newConfig: WorkspacesConfig) => {
    setConfig(newConfig)
    setIsFormOpen(false)
    setSelectedWorkspace(null)
  }

  const handleLogin = (workspace: Workspace, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigate(`/login?workspace=${encodeURIComponent(workspace.name)}`)
  }

  const handleLogout = (workspace: Workspace, e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (currentWorkspace?.name === workspace.name) {
      logout()
    } else {
      apiClient.clearAccessToken(workspace.name)
      toast.success(`Logged out from "${workspace.name}"`)
      setTokenStatus((prev) => {
        const newStatus = { ...prev }
        delete newStatus[workspace.name]
        return newStatus
      })
    }
  }

  const handleRowClick = (workspace: Workspace) => {
    const hasToken = apiClient.hasToken(workspace.name)
    const status = tokenStatus[workspace.name]

    if (hasToken && status !== "invalid") {
      saveCurrentWorkspace(workspace)
      toast.success(`Switched to workspace "${workspace.name}"`)
      window.location.href = "/"
    } else {
      navigate(`/login?workspace=${encodeURIComponent(workspace.name)}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        <div className="space-y-4">
          <h1>
            {" "}
            <Logo clickable={false} />{" "}
          </h1>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go back
              </Button>
            </Link>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleResetClick}>
              <Server className="mr-2 h-4 w-4" />
              Reset to defaults
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Workspace
            </Button>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Realm</TableHead>
                <TableHead>API Server</TableHead>
                <TableHead>Auth Providers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config?.workspaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No workspaces configured. Click "Add Workspace" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                config?.workspaces.map((workspace) => {
                  const isActive = currentWorkspace?.name === workspace.name
                  const hasToken = apiClient.hasToken(workspace.name)

                  return (
                    <TableRow
                      key={workspace.name}
                      className={
                        isActive
                          ? "bg-primary/5 cursor-pointer hover:bg-primary/10"
                          : "cursor-pointer hover:bg-accent"
                      }
                      onClick={() => handleRowClick(workspace)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {workspace.name}
                          {workspace.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                          {isActive && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {workspace.description || "-"}
                      </TableCell>
                      <TableCell>{workspace.realm}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {workspace.server?.api || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {workspace.auth.map((auth, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {auth.type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasToken ? (
                          tokenStatus[workspace.name] === "checking" ? (
                            <Badge
                              variant="outline"
                              className="text-xs text-blue-600 border-blue-600"
                            >
                              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                              Checking...
                            </Badge>
                          ) : tokenStatus[workspace.name] === "invalid" ? (
                            <Badge
                              variant="outline"
                              className="text-xs text-red-600 border-red-600"
                            >
                              Token expired
                            </Badge>
                          ) : tokenStatus[workspace.name] === "valid" ? (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-600 border-green-600"
                            >
                              Authenticated
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-600 border-green-600"
                            >
                              Authenticated
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not authenticated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hasToken ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleLogout(workspace, e)}
                              title="Logout"
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleLogin(workspace, e)}
                              title="Login"
                            >
                              <LogIn className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleEdit(workspace, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(workspace, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {config && (
          <WorkspaceFormModal
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            workspace={selectedWorkspace}
            config={config}
            onSuccess={handleFormSuccess}
          />
        )}

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Workspace"
          description={`Are you sure you want to delete "${workspaceToDelete?.name}"? This action cannot be undone.`}
        />

        <DeleteConfirmDialog
          open={resetDialogOpen}
          onOpenChange={setResetDialogOpen}
          onConfirm={confirmReset}
          title="Reset to Defaults"
          description="This will reload workspaces from the server and discard all local changes. Are you sure you want to continue?"
        />
      </div>
    </div>
  )
}
