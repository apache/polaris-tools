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

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { tablesApi } from "@/api/catalog/tables"

type KV = { key: string; value: string; toRemove?: boolean }

interface EditTablePropertiesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  tableName: string
  properties: Record<string, string> | undefined
}

export function EditTablePropertiesModal({ open, onOpenChange, catalogName, namespace, tableName, properties }: EditTablePropertiesModalProps) {
  const [rows, setRows] = useState<KV[]>([])
  const queryClient = useQueryClient()

  useEffect(() => {
    const initial: KV[] = Object.entries(properties || {}).map(([k, v]) => ({ key: k, value: String(v) }))
    setRows(initial.length > 0 ? initial : [{ key: "", value: "" }])
  }, [properties, open])

  const updates = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of rows) {
      if (!r.toRemove && r.key.trim().length > 0) {
        map[r.key.trim()] = r.value
      }
    }
    return map
  }, [rows])

  const removals = useMemo(() => rows.filter((r) => r.toRemove && r.key.trim().length > 0).map((r) => r.key.trim()), [rows])

  const saveMutation = useMutation({
    mutationFn: async () => tablesApi.updateProperties(catalogName, namespace, tableName, updates, removals),
    onSuccess: () => {
      toast.success("Table properties updated successfully")
      queryClient.invalidateQueries({ queryKey: ["table", catalogName] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Failed to update table properties", {
        description: error.message || "An error occurred",
      })
    },
  })

  const addRow = () => setRows((r) => [...r, { key: "", value: "" }])
  const setKey = (i: number, v: string) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, key: v } : x)))
  const setValue = (i: number, v: string) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, value: v } : x)))
  const toggleRemove = (i: number) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, toRemove: !x.toRemove } : x)))
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit table properties</DialogTitle>
          <DialogDescription>Set, update, or remove properties for this table.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={idx} className={`grid grid-cols-12 gap-2 items-center ${row.toRemove ? "opacity-60" : ""}`}>
              <div className="col-span-5">
                <Input placeholder="key" value={row.key} onChange={(e) => setKey(idx, e.target.value)} />
              </div>
              <div className="col-span-5">
                <Input placeholder="value" value={row.value} onChange={(e) => setValue(idx, e.target.value)} />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button variant={row.toRemove ? "secondary" : "outline"} size="sm" onClick={() => toggleRemove(idx)}>
                  {row.toRemove ? "Keep" : "Remove"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>Delete</Button>
              </div>
            </div>
          ))}
          <div>
            <Button variant="outline" size="sm" onClick={addRow}>Add property</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditTablePropertiesModal


