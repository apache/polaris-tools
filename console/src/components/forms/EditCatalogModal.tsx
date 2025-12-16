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

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { catalogsApi } from "@/api/management/catalogs"
import type { Catalog, StorageConfigInfo } from "@/types/api"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const schema = z.object({
  defaultBaseLocation: z.string().min(1, "Default base location is required"),
  storageType: z.enum(["S3", "AZURE", "GCS", "FILE"]),
  allowedLocations: z.string().optional(), // comma separated

  // S3
  s3_region: z.string().optional(),
  s3_roleArn: z.string().optional(),
  s3_externalId: z.string().optional(),
  s3_endpoint: z.string().optional(),
  s3_endpointInternal: z.string().optional(),
  s3_stsEndpoint: z.string().optional(),
  s3_stsUnavailable: z.boolean().optional(),
  s3_pathStyleAccess: z.boolean().optional(),

  // Azure
  azure_tenantId: z.string().optional(),
  azure_multiTenantAppName: z.string().optional(),
  azure_consentUrl: z.string().optional(),

  // GCS
  gcs_serviceAccount: z.string().optional(),

  // Properties (key-value pairs as JSON string or separate fields)
  propertiesJson: z.string().optional(),
})
  .superRefine((val, ctx) => {
    if (val.storageType === "AZURE" && !val.azure_tenantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tenant ID is required for Azure",
        path: ["azure_tenantId"],
      })
    }
  })

type FormValues = z.infer<typeof schema>

interface EditCatalogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: Catalog | undefined
  onUpdated?: () => void
}

export function EditCatalogModal({
  open,
  onOpenChange,
  catalog,
  onUpdated,
}: EditCatalogModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const storageType = watch("storageType")

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!catalog) throw new Error("Catalog is required")

      const allowedLocations = values.allowedLocations
        ? values.allowedLocations.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined

      // Build storage config from form values
      const storageConfigInfo: StorageConfigInfo = {
        storageType: values.storageType,
      }
      if (allowedLocations && allowedLocations.length)
        storageConfigInfo.allowedLocations = allowedLocations

      if (values.storageType === "S3") {
        if (values.s3_region) storageConfigInfo.region = values.s3_region
        if (values.s3_roleArn) storageConfigInfo.roleArn = values.s3_roleArn
        if (values.s3_externalId) storageConfigInfo.externalId = values.s3_externalId
        if (values.s3_endpoint) storageConfigInfo.endpoint = values.s3_endpoint
        if (values.s3_endpointInternal)
          storageConfigInfo.endpointInternal = values.s3_endpointInternal
        if (values.s3_stsEndpoint)
          storageConfigInfo.stsEndpoint = values.s3_stsEndpoint
        if (typeof values.s3_stsUnavailable === "boolean")
          storageConfigInfo.stsUnavailable = values.s3_stsUnavailable
        if (typeof values.s3_pathStyleAccess === "boolean")
          storageConfigInfo.pathStyleAccess = values.s3_pathStyleAccess
      }
      if (values.storageType === "AZURE") {
        if (values.azure_tenantId) storageConfigInfo.tenantId = values.azure_tenantId
        if (values.azure_multiTenantAppName)
          storageConfigInfo.multiTenantAppName = values.azure_multiTenantAppName
        if (values.azure_consentUrl)
          storageConfigInfo.consentUrl = values.azure_consentUrl
      }
      if (values.storageType === "GCS") {
        if (values.gcs_serviceAccount)
          storageConfigInfo.gcsServiceAccount = values.gcs_serviceAccount
      }

      // Parse properties JSON or keep existing
      let properties: Record<string, string> = { ...catalog.properties }
      if (values.propertiesJson) {
        try {
          const parsed = JSON.parse(values.propertiesJson)
          if (typeof parsed === "object" && parsed !== null) {
            properties = parsed
          }
        } catch {
          // If JSON is invalid, try to parse as key=value pairs
          const lines = values.propertiesJson.split("\n")
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed && trimmed.includes("=")) {
              const [key, ...valueParts] = trimmed.split("=")
              properties[key.trim()] = valueParts.join("=").trim()
            }
          }
        }
      }

      // Ensure default-base-location is set
      if (values.defaultBaseLocation) {
        properties["default-base-location"] = values.defaultBaseLocation
      }

      const payload = {
        properties,
        storageConfigInfo,
        currentEntityVersion:
          catalog.currentEntityVersion ?? catalog.entityVersion ?? undefined,
      }

      return catalogsApi.update(catalog.name, payload)
    },
    onSuccess: () => {
      toast.success("Catalog updated successfully")
      onOpenChange(false)
      onUpdated?.()
    },
    onError: (error: Error) => {
      toast.error("Failed to update catalog", {
        description: error.message || "An error occurred",
      })
    },
  })

  // Reset form when catalog changes or modal opens/closes
  useEffect(() => {
    if (open && catalog) {
      const storageConfig = catalog.storageConfigInfo
      const defaultBaseLocation =
        catalog.properties?.["default-base-location"] || ""

      reset({
        defaultBaseLocation,
        storageType: storageConfig?.storageType || "S3",
        allowedLocations: storageConfig?.allowedLocations?.join(", ") || "",
        s3_region: storageConfig?.region || "",
        s3_roleArn: storageConfig?.roleArn || "",
        s3_externalId: storageConfig?.externalId || "",
        s3_endpoint: storageConfig?.endpoint || "",
        s3_endpointInternal: storageConfig?.endpointInternal || "",
        s3_stsEndpoint: storageConfig?.stsEndpoint || "",
        s3_stsUnavailable: storageConfig?.stsUnavailable || false,
        s3_pathStyleAccess: storageConfig?.pathStyleAccess || false,
        azure_tenantId: storageConfig?.tenantId || "",
        azure_multiTenantAppName: storageConfig?.multiTenantAppName || "",
        azure_consentUrl: storageConfig?.consentUrl || "",
        gcs_serviceAccount: storageConfig?.gcsServiceAccount || "",
        propertiesJson: JSON.stringify(catalog.properties || {}, null, 2),
      })
    } else if (!open) {
      reset()
    }
  }, [open, catalog, reset])

  if (!catalog) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit catalog</DialogTitle>
          <DialogDescription>
            Update catalog configuration. Name and type cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={catalog.name} disabled />
            <p className="text-xs text-muted-foreground">
              Catalog name cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Input value={catalog.type} disabled />
            <p className="text-xs text-muted-foreground">
              Catalog type cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultBaseLocation">Default base location</Label>
            <Input
              id="defaultBaseLocation"
              placeholder="e.g. s3://bucket/prefix or file:///path"
              {...register("defaultBaseLocation")}
            />
            {errors.defaultBaseLocation && (
              <p className="text-sm text-red-600">
                {errors.defaultBaseLocation.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Storage provider</Label>
            <Controller
              name="storageType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S3">S3</SelectItem>
                    <SelectItem value="AZURE">Azure</SelectItem>
                    <SelectItem value="GCS">GCS</SelectItem>
                    <SelectItem value="FILE">File</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Select the cloud/storage provider used by this catalog.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedLocations">
              Allowed locations (comma-separated)
            </Label>
            <Input
              id="allowedLocations"
              placeholder="s3://bucket1/, s3://bucket2/"
              {...register("allowedLocations")}
            />
            <p className="text-xs text-muted-foreground">
              Optional list of storage locations allowed for this catalog.
              Example: s3://bucket/prefix/
            </p>
          </div>

          {/* Provider-specific fields */}
          {storageType === "S3" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">S3 options</Label>
              <div className="space-y-2">
                <Input placeholder="Region" {...register("s3_region")} />
                <p className="mt-1 text-xs text-muted-foreground">
                  AWS region where data is stored, e.g., us-west-2.
                </p>
                <Input placeholder="Role ARN" {...register("s3_roleArn")} />
                <p className="mt-1 text-xs text-muted-foreground">
                  AWS IAM role ARN used to access S3 buckets.
                </p>
                <Input
                  placeholder="External ID"
                  {...register("s3_externalId")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional external ID for AWS trust relationship.
                </p>
                <Input placeholder="Endpoint" {...register("s3_endpoint")} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Public S3-compatible endpoint for clients, e.g.,
                  https://s3.example.com:1234.
                </p>
                <Input
                  placeholder="Internal Endpoint"
                  {...register("s3_endpointInternal")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Internal S3 endpoint used by Polaris servers. Defaults to
                  Endpoint if not set.
                </p>
                <Input
                  placeholder="STS Endpoint"
                  {...register("s3_stsEndpoint")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  STS endpoint used by Polaris servers when vending credentials.
                </p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register("s3_stsUnavailable")}
                  />{" "}
                  STS unavailable
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  If true, Polaris avoids using STS and will not vend storage
                  credentials.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register("s3_pathStyleAccess")}
                  />{" "}
                  Path-style access
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Whether S3 requests should use path-style addressing for
                  buckets.
                </p>
              </div>
            </div>
          )}

          {storageType === "AZURE" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Azure options</Label>
              <div className="space-y-2">
                <div>
                  <Input
                    placeholder="Tenant ID"
                    {...register("azure_tenantId")}
                  />
                  {errors.azure_tenantId && (
                    <p className="text-sm text-red-600">
                      {errors.azure_tenantId.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Azure Tenant ID that the storage accounts belong to.
                  </p>
                </div>
                <Input
                  placeholder="Multi-tenant app name"
                  {...register("azure_multiTenantAppName")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Name of the Azure client application for multi-tenant usage.
                </p>
                <Input
                  placeholder="Consent URL"
                  {...register("azure_consentUrl")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  URL to the Azure permissions request page.
                </p>
              </div>
            </div>
          )}

          {storageType === "GCS" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">GCS options</Label>
              <Input
                placeholder="Service account"
                {...register("gcs_serviceAccount")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Google Cloud Storage service account used to access data.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="propertiesJson">Properties (JSON format)</Label>
            <Textarea
              id="propertiesJson"
              placeholder='{"key": "value"}'
              rows={6}
              {...register("propertiesJson")}
            />
            <p className="text-xs text-muted-foreground">
              Catalog properties as JSON. You can also use key=value format,
              one per line.
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
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

