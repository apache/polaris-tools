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

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { tablesApi } from "@/api/catalog/tables"

interface RenameTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  currentName: string
  onRenamed?: (newName: string) => void
}

export function RenameTableModal({ open, onOpenChange, catalogName, namespace, currentName, onRenamed }: RenameTableModalProps) {
  const [newName, setNewName] = useState(currentName)
  const queryClient = useQueryClient()

  const renameMutation = useMutation({
    mutationFn: async () => {
      const trimmed = newName.trim()
      if (!trimmed || trimmed === currentName) return
      await tablesApi.rename(catalogName, namespace, currentName, namespace, trimmed)
    },
    onSuccess: () => {
      toast.success("Table renamed successfully")
      queryClient.invalidateQueries()
      onOpenChange(false)
      onRenamed?.(newName.trim())
    },
    onError: (error: Error) => {
      toast.error("Failed to rename table", {
        description: error.message || "An error occurred",
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename table</DialogTitle>
          <DialogDescription>Change the table name within the same namespace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">New name</label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={currentName} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={renameMutation.isPending}>Cancel</Button>
          <Button onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending || newName.trim().length === 0}>
            {renameMutation.isPending ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RenameTableModal


