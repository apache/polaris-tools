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

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { namespacesApi } from "@/api/catalog/namespaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, X } from "lucide-react"

const schema = z.object({
  namespacePath: z
    .string()
    .min(1, "Namespace path is required")
    .refine(
      (val) => {
        // Validate namespace path format: allows nested namespaces like "outer.inner"
        // Each part should be alphanumeric with underscores and hyphens
        const parts = val.split(".")
        return parts.every(
          (part) =>
            part.trim().length > 0 &&
            /^[a-zA-Z0-9_-]+$/.test(part.trim())
        )
      },
      {
        message:
          "Namespace path must consist of alphanumeric characters, underscores, or hyphens, separated by dots",
      }
    ),
  location: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true // Optional field
        // Basic validation: should look like a URL or file path
        // Accepts: s3://, https://, http://, file://, gs://, azure://, or absolute paths
        const urlPattern = /^(s3|https?|file|gs|azure|abfss?):\/\//i
        const absolutePathPattern = /^\/[^/]/
        return urlPattern.test(val.trim()) || absolutePathPattern.test(val.trim())
      },
      {
        message: "Location must be a valid URL (s3://, https://, file://, etc.) or absolute path",
      }
    ),
  properties: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      value: z.string(),
    })
  ).optional(),
})

type FormValues = z.infer<typeof schema>

interface CreateNamespaceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  parentNamespace?: string[] // Optional parent namespace for nested namespaces
  onCreated?: (namespace: string[]) => void
}

export function CreateNamespaceModal({
  open,
  onOpenChange,
  catalogName,
  parentNamespace,
  onCreated,
}: CreateNamespaceModalProps) {
  const [properties, setProperties] = useState<Array<{ key: string; value: string }>>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      namespacePath: "",
      location: "",
      properties: [],
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      // Parse namespace path into array (supports nested: "outer.inner" -> ["outer", "inner"])
      const namespaceParts = values.namespacePath
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean)

      // If parent namespace is provided, prepend it to create full path
      const fullNamespace = parentNamespace
        ? [...parentNamespace, ...namespaceParts]
        : namespaceParts

      // Build properties object from key-value pairs
      const propertiesObj: Record<string, string> = {}
      
      // Add location if provided (location property takes precedence)
      if (values.location && values.location.trim()) {
        propertiesObj.location = values.location.trim()
      }

      // Add custom properties from the properties array
      // Note: If user adds a "location" property manually, it will overwrite the location field
      if (values.properties) {
        values.properties.forEach((prop) => {
          if (prop.key.trim()) {
            propertiesObj[prop.key.trim()] = prop.value || ""
          }
        })
      }

      return namespacesApi.create(catalogName, {
        namespace: fullNamespace,
        properties: Object.keys(propertiesObj).length > 0 ? propertiesObj : undefined,
      })
    },
    onSuccess: (data) => {
      toast.success("Namespace created successfully")
      onOpenChange(false)
      reset()
      setProperties([{ key: "", value: "" }])
      onCreated?.(data.namespace)
    },
    onError: (error: Error) => {
      toast.error("Failed to create namespace", {
        description: error.message || "An error occurred",
      })
    },
  })

  // Update form when properties change
  useEffect(() => {
    const nonEmpty = properties.filter((p) => p.key.trim().length > 0)
    setValue("properties", nonEmpty, { shouldValidate: true })
  }, [properties, setValue])

  useEffect(() => {
    if (!open) {
      reset({
        namespacePath: "",
        location: "",
        properties: [],
      })
      setProperties([])
    }
  }, [open, reset])

  const addProperty = () => {
    setProperties([...properties, { key: "", value: "" }])
  }

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index))
  }

  const updateProperty = (index: number, field: "key" | "value", value: string) => {
    const updated = [...properties]
    updated[index] = { ...updated[index], [field]: value }
    setProperties(updated)
  }

  // no-op watch for now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create namespace</DialogTitle>
          <DialogDescription>
            Create a new namespace in the catalog. Namespaces support nested paths like "outer.inner".
            {parentNamespace && (
              <span className="block mt-1 text-xs">
                Parent namespace: {parentNamespace.join(".")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="namespacePath">
              Namespace path {parentNamespace && "(relative to parent)"}
            </Label>
            <Input
              id="namespacePath"
              placeholder={parentNamespace ? "e.g. inner" : "e.g. accounting or accounting.tax"}
              {...register("namespacePath")}
            />
            {errors.namespacePath && (
              <p className="text-sm text-red-600">{errors.namespacePath.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use dots to create nested namespaces (e.g., "outer.inner"). Each part must contain
              only alphanumeric characters, underscores, or hyphens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              placeholder="e.g. s3://bucket/prefix/ or file:///path/to/namespace"
              {...register("location")}
            />
            {errors.location && (
              <p className="text-sm text-red-600">{errors.location.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Storage location for this namespace. Must be within the catalog's base location and
              allowed locations.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Properties (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addProperty}
                className="h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Property
              </Button>
            </div>
            <div className="space-y-2">
              {properties.map((prop, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Key"
                      value={prop.key}
                      onChange={(e) => updateProperty(index, "key", e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Value"
                      value={prop.value}
                      onChange={(e) => updateProperty(index, "value", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProperty(index)}
                    className="h-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {properties.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No properties added. Click "Add Property" to add key-value pairs.
                </p>
              )}
            </div>
            {errors.properties && (
              <p className="text-sm text-red-600">{errors.properties.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

