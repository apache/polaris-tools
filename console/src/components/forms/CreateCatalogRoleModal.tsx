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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { catalogsApi } from "@/api/management/catalogs"
import type { CatalogRole } from "@/types/api"

const catalogRoleSchema = z.object({
  catalogName: z.string().min(1, "Catalog is required"),
  name: z.string().min(1, "Name is required"),
  properties: z.record(z.string(), z.string()).optional(),
})

type CatalogRoleFormData = z.infer<typeof catalogRoleSchema>

interface CreateCatalogRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogRole?: CatalogRole | null
  defaultCatalogName?: string
  onSuccess?: () => void
}

export function CreateCatalogRoleModal({
  open,
  onOpenChange,
  catalogRole,
  defaultCatalogName,
  onSuccess,
}: CreateCatalogRoleModalProps) {
  const queryClient = useQueryClient()
  const isNew = !catalogRole?.name
  const [propertiesText, setPropertiesText] = useState("")

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
    enabled: open,
  })

  const form = useForm<CatalogRoleFormData>({
    resolver: zodResolver(catalogRoleSchema),
    defaultValues: {
      catalogName: "",
      name: "",
      properties: {},
    },
  })

  useEffect(() => {
    if (catalogRole) {
      form.reset({
        catalogName: catalogRole.catalogName || defaultCatalogName || "",
        name: catalogRole.name || "",
        properties: catalogRole.properties || {},
      })
      // Convert properties to text format for editing
      if (catalogRole.properties) {
        const propsText = Object.entries(catalogRole.properties)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")
        setPropertiesText(propsText)
      } else {
        setPropertiesText("")
      }
    } else {
      form.reset({
        catalogName: defaultCatalogName || "",
        name: "",
        properties: {},
      })
      setPropertiesText("")
    }
  }, [catalogRole, defaultCatalogName, form])

  const updateMutation = useMutation({
    mutationFn: async (data: CatalogRoleFormData) => {
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
        return catalogRolesApi.create(data.catalogName, {
          name: data.name,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        })
      } else {
        const updateCatalogName = catalogRole!.catalogName || data.catalogName
        return catalogRolesApi.update(
          updateCatalogName,
          catalogRole!.name,
          {
            properties: Object.keys(properties).length > 0 ? properties : undefined,
            currentEntityVersion: catalogRole?.entityVersion || catalogRole?.currentEntityVersion
              ? parseInt(String(catalogRole.entityVersion || catalogRole.currentEntityVersion))
              : undefined,
          }
        )
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Catalog role created successfully" : "Catalog role updated successfully")
      queryClient.invalidateQueries({ queryKey: ["catalog-roles"] })
      queryClient.invalidateQueries({ queryKey: ["catalogs"] })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(isNew ? "Failed to create catalog role" : "Failed to update catalog role", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (data: CatalogRoleFormData) => {
    updateMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Create Catalog Role" : "Edit Catalog Role"}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Create a new catalog role in the selected catalog."
              : "Update the catalog role properties."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalogName">Catalog</Label>
            <Select
              value={form.watch("catalogName")}
              onValueChange={(value) => form.setValue("catalogName", value)}
              disabled={!isNew}
            >
              <SelectTrigger id="catalogName">
                <SelectValue placeholder="Select a catalog" />
              </SelectTrigger>
              <SelectContent>
                {catalogsQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading catalogs...
                  </SelectItem>
                ) : catalogsQuery.data && catalogsQuery.data.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No catalogs available
                  </SelectItem>
                ) : (
                  catalogsQuery.data?.map((catalog) => (
                    <SelectItem key={catalog.name} value={catalog.name}>
                      {catalog.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.catalogName && (
              <p className="text-sm text-red-600">
                {form.formState.errors.catalogName.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Select the catalog where this role will be created."
                : "Catalog cannot be changed."}
            </p>
          </div>

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
                ? "The unique name for this catalog role."
                : "Catalog role name cannot be changed."}
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

