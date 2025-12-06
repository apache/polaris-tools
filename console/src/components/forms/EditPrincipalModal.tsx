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
import { principalsApi } from "@/api/management/principals"
import type { Principal, PrincipalWithCredentials } from "@/types/api"

const principalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  properties: z.record(z.string(), z.string()).optional(),
})

type PrincipalFormData = z.infer<typeof principalSchema>

interface EditPrincipalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  principal: Principal | null
  onSuccess?: () => void
}

export function EditPrincipalModal({
  open,
  onOpenChange,
  principal,
  onSuccess,
}: EditPrincipalModalProps) {
  const queryClient = useQueryClient()
  const isNew = !principal?.name || principal.name === ""
  const [propertiesText, setPropertiesText] = useState("")

  const form = useForm<PrincipalFormData>({
    resolver: zodResolver(principalSchema),
    defaultValues: {
      name: "",
      properties: {},
    },
  })

  useEffect(() => {
    if (principal) {
      form.reset({
        name: principal.name || "",
        properties: principal.properties || {},
      })
      // Convert properties to text format for editing
      if (principal.properties) {
        const propsText = Object.entries(principal.properties)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")
        setPropertiesText(propsText)
      } else {
        setPropertiesText("")
      }
    }
  }, [principal, form])

  const updateMutation = useMutation({
    mutationFn: async (data: PrincipalFormData) => {
      if (isNew) {
        return principalsApi.create({
          principal: {
            name: data.name,
            properties: data.properties,
          },
        })
      } else {
        return principalsApi.update(principal!.name, {
          currentEntityVersion: principal?.currentEntityVersion,
          properties: data.properties,
        })
      }
    },
    onSuccess: (data: Principal | PrincipalWithCredentials) => {
      toast.success(isNew ? "Principal created successfully" : "Principal updated successfully")
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      onSuccess?.()
      if (isNew && "clientId" in data && "clientSecret" in data) {
        // If creating new principal, PrincipalWithCredentials is returned
        // This would typically trigger a credentials modal
        onOpenChange(false)
      } else {
        onOpenChange(false)
      }
    },
    onError: (error: Error) => {
      toast.error(isNew ? "Failed to create principal" : "Failed to update principal", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (data: PrincipalFormData) => {
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
    updateMutation.mutate({
      ...data,
      properties,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create Principal" : "Edit Principal"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Create a new principal in the system."
              : "Update the principal properties."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="principal-name"
              disabled={!isNew}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "The unique name for this principal."
                : "Principal name cannot be changed."}
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

