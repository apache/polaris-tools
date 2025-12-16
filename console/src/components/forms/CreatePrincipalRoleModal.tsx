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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { principalRolesApi } from "@/api/management/principal-roles"
import type { PrincipalRole } from "@/types/api"

const principalRoleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  properties: z.record(z.string(), z.string()).optional(),
})

type PrincipalRoleFormData = z.infer<typeof principalRoleSchema>

interface CreatePrincipalRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  principalRole?: PrincipalRole | null
  onSuccess?: () => void
}

export function CreatePrincipalRoleModal({
  open,
  onOpenChange,
  principalRole,
  onSuccess,
}: CreatePrincipalRoleModalProps) {
  const queryClient = useQueryClient()
  const isNew = !principalRole?.name
  const [propertiesText, setPropertiesText] = useState("")

  const form = useForm<PrincipalRoleFormData>({
    resolver: zodResolver(principalRoleSchema),
    defaultValues: {
      name: "",
      properties: {},
    },
  })

  useEffect(() => {
    if (principalRole) {
      form.reset({
        name: principalRole.name || "",
        properties: principalRole.properties || {},
      })
      // Convert properties to text format for editing
      if (principalRole.properties) {
        const propsText = Object.entries(principalRole.properties)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")
        setPropertiesText(propsText)
      } else {
        setPropertiesText("")
      }
    } else {
      form.reset({
        name: "",
        properties: {},
      })
      setPropertiesText("")
    }
  }, [principalRole, form])

  const updateMutation = useMutation({
    mutationFn: async (data: PrincipalRoleFormData) => {
      // Parse properties from text
      const properties: Record<string, string> = {}
      if (propertiesText.trim()) {
        propertiesText.split("\n").forEach((line) => {
          const trimmed = line.trim()
          if (trimmed) {
            const [key, ...valueParts] = trimmed.split("=")
            if (key) {
              properties[key.trim()] = valueParts.join("=").trim()
            }
          }
        })
      }

      if (isNew) {
        return principalRolesApi.create({
          name: data.name,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        })
      } else {
        return principalRolesApi.update(principalRole!.name, {
          properties: Object.keys(properties).length > 0 ? properties : undefined,
          currentEntityVersion: principalRole?.currentEntityVersion
            ? parseInt(principalRole.currentEntityVersion)
            : undefined,
        })
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Principal role created successfully" : "Principal role updated successfully")
      queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(isNew ? "Failed to create principal role" : "Failed to update principal role", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (data: PrincipalRoleFormData) => {
    updateMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Create Principal Role" : "Edit Principal Role"}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Create a new principal role in the system."
              : "Update the principal role properties."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="role-name"
              disabled={!isNew}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "The unique name for this principal role."
                : "Principal role name cannot be changed."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="properties">Properties</Label>
            <Textarea
              id="properties"
              value={propertiesText}
              onChange={(e) => setPropertiesText(e.target.value)}
              placeholder="key1=value1&#10;key2=value2"
              className="font-mono text-sm"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Enter properties as key=value pairs, one per line.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {isNew ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

