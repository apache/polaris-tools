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
import { Link } from "react-router-dom"
import { Plus, RefreshCw, Pencil, Trash2, Server, ArrowLeft } from "lucide-react"
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
} from "@/lib/workspaces"
import { WorkspaceFormModal } from "@/components/workspace/WorkspaceFormModal"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import type { Workspace, WorkspacesConfig } from "@/types/workspaces"

export function Workspaces() {
  const [config, setConfig] = useState<WorkspacesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

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

  const handleReloadFromServer = async () => {
    setLoading(true)
    try {
      const cfg = await reloadFromServer()
      setConfig(cfg)
      toast.success("Workspaces reloaded from server")
    } catch {
      toast.error("Failed to reload from server")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (workspace: Workspace) => {
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

  const handleEdit = (workspace: Workspace) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          </Link>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleReloadFromServer}>
            <Server className="mr-2 h-4 w-4" />
            Reset to defaults
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Workspace
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Workspaces</h1>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config?.workspaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No workspaces configured. Click "Add Workspace" to create one.
                </TableCell>
              </TableRow>
            ) : (
              config?.workspaces.map((workspace) => (
                <TableRow key={workspace.name}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {workspace.name}
                      {workspace.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(workspace)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(workspace)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
    </div>
  )
}

