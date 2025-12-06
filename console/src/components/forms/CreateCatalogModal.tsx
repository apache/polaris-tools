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
import type { CreateCatalogRequest, Catalog, ConnectionConfigInfo, StorageConfigInfo } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INTERNAL", "EXTERNAL"]),
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

  // External connection (only when type === EXTERNAL)
  connectionType: z.enum(["ICEBERG_REST", "HADOOP", "HIVE"]).optional(),
  conn_uri: z.string().optional(),
  auth_type: z.enum(["OAUTH", "BEARER", "SIGV4", "IMPLICIT"]).optional(),
  // OAUTH
  oauth_tokenUri: z.string().optional(),
  oauth_clientId: z.string().optional(),
  oauth_clientSecret: z.string().optional(),
  oauth_scopes: z.string().optional(), // comma separated
  // BEARER
  bearer_token: z.string().optional(),
  // SIGV4
  sigv4_roleArn: z.string().optional(),
  sigv4_roleSessionName: z.string().optional(),
  sigv4_externalId: z.string().optional(),
  sigv4_signingRegion: z.string().optional(),
  sigv4_signingName: z.string().optional(),
})
  .superRefine((val, ctx) => {
    if (val.type === "EXTERNAL") {
      if (!val.connectionType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Connection type is required", path: ["connectionType"] })
      if (!val.auth_type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Auth type is required", path: ["auth_type"] })
    }
    if (val.storageType === "AZURE" && !val.azure_tenantId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tenant ID is required for Azure", path: ["azure_tenantId"] })
    }
  })

type FormValues = z.infer<typeof schema>

interface CreateCatalogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function CreateCatalogModal({ open, onOpenChange, onCreated }: CreateCatalogModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "INTERNAL", storageType: "S3" },
  })

  const storageType = watch("storageType")
  const catalogType = watch("type")
  const authType = watch("auth_type")

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const allowedLocations = values.allowedLocations
        ? values.allowedLocations.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined

      const storageConfigInfo: StorageConfigInfo = {
        storageType: values.storageType,
      }
      if (allowedLocations && allowedLocations.length) storageConfigInfo.allowedLocations = allowedLocations
      if (values.storageType === "S3") {
        if (values.s3_region) storageConfigInfo.region = values.s3_region
        if (values.s3_roleArn) storageConfigInfo.roleArn = values.s3_roleArn
        if (values.s3_externalId) storageConfigInfo.externalId = values.s3_externalId
        if (values.s3_endpoint) storageConfigInfo.endpoint = values.s3_endpoint
        if (values.s3_endpointInternal) storageConfigInfo.endpointInternal = values.s3_endpointInternal
        if (values.s3_stsEndpoint) storageConfigInfo.stsEndpoint = values.s3_stsEndpoint
        if (typeof values.s3_stsUnavailable === "boolean") storageConfigInfo.stsUnavailable = values.s3_stsUnavailable
        if (typeof values.s3_pathStyleAccess === "boolean") storageConfigInfo.pathStyleAccess = values.s3_pathStyleAccess
      }
      if (values.storageType === "AZURE") {
        if (values.azure_tenantId) storageConfigInfo.tenantId = values.azure_tenantId
        if (values.azure_multiTenantAppName) storageConfigInfo.multiTenantAppName = values.azure_multiTenantAppName
        if (values.azure_consentUrl) storageConfigInfo.consentUrl = values.azure_consentUrl
      }
      if (values.storageType === "GCS") {
        if (values.gcs_serviceAccount) storageConfigInfo.gcsServiceAccount = values.gcs_serviceAccount
      }

      const catalog: Catalog = {
        name: values.name,
        type: values.type,
        // properties use kebab-case per spec
        properties: {
          "default-base-location": values.defaultBaseLocation,
        },
        storageConfigInfo,
      }

      if (values.type === "EXTERNAL") {
        const authenticationParameters: Record<string, unknown> | undefined = (() => {
          switch (values.auth_type) {
            case "OAUTH":
              return {
                authenticationType: "OAUTH",
                tokenUri: values.oauth_tokenUri,
                clientId: values.oauth_clientId,
                clientSecret: values.oauth_clientSecret,
                scopes: values.oauth_scopes
                  ? values.oauth_scopes.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined,
              }
            case "BEARER":
              return {
                authenticationType: "BEARER",
                bearerToken: values.bearer_token,
              }
            case "SIGV4":
              return {
                authenticationType: "SIGV4",
                roleArn: values.sigv4_roleArn,
                roleSessionName: values.sigv4_roleSessionName,
                externalId: values.sigv4_externalId,
                signingRegion: values.sigv4_signingRegion,
                signingName: values.sigv4_signingName,
              }
            case "IMPLICIT":
              return { authenticationType: "IMPLICIT" }
            default:
              return undefined
          }
        })()

        const connectionConfigInfo: ConnectionConfigInfo = {
          connectionType: values.connectionType!,
        }
        if (values.conn_uri) connectionConfigInfo.uri = values.conn_uri
        if (authenticationParameters) connectionConfigInfo.authenticationParameters = authenticationParameters

        catalog.connectionConfigInfo = connectionConfigInfo
      }

      const payload: CreateCatalogRequest = { catalog }
      return catalogsApi.create(payload)
    },
    onSuccess: () => {
      toast.success("Catalog created successfully")
      onOpenChange(false)
      reset()
      onCreated?.()
    },
    onError: (error: Error) => {
      toast.error("Failed to create catalog", {
        description: error.message || "An error occurred",
      })
    },
  })

  useEffect(() => {
    if (!open) {
      reset({
        name: "",
        type: "INTERNAL",
        storageType: "S3",
        defaultBaseLocation: "",
      })
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create catalog</DialogTitle>
          <DialogDescription>
            Provide basic details to create a new catalog. You can configure advanced storage options later.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. prod" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              onValueChange={(v) => setValue("type", v as FormValues["type"], { shouldValidate: true })}
              defaultValue="INTERNAL"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                <SelectItem value="EXTERNAL">EXTERNAL</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultBaseLocation">Default base location</Label>
            <Input id="defaultBaseLocation" placeholder="e.g. s3://bucket/prefix or file:///path" {...register("defaultBaseLocation")} />
            {errors.defaultBaseLocation && (
              <p className="text-sm text-red-600">{errors.defaultBaseLocation.message}</p>
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
              <p className="text-xs text-muted-foreground">Select the cloud/storage provider used by this catalog.</p>
          </div>
          <div className="space-y-2">
              <Label htmlFor="allowedLocations">Allowed locations (comma-separated)</Label>
              <Input id="allowedLocations" placeholder="s3://bucket1/, s3://bucket2/" {...register("allowedLocations")} />
              <p className="text-xs text-muted-foreground">Optional list of storage locations allowed for this catalog. Example: s3://bucket/prefix/</p>
            </div>

          {/* Provider-specific fields */}
          {storageType === "S3" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">S3 options</Label>
              <div className="space-y-2">
                <Input placeholder="Region" {...register("s3_region")} />
                <p className="mt-1 text-xs text-muted-foreground">AWS region where data is stored, e.g., us-west-2.</p>
                <Input placeholder="Role ARN" {...register("s3_roleArn")} />
                <p className="mt-1 text-xs text-muted-foreground">AWS IAM role ARN used to access S3 buckets.</p>
                <Input placeholder="External ID" {...register("s3_externalId")} />
                <p className="mt-1 text-xs text-muted-foreground">Optional external ID for AWS trust relationship.</p>
                <Input placeholder="Endpoint" {...register("s3_endpoint")} />
                <p className="mt-1 text-xs text-muted-foreground">Public S3-compatible endpoint for clients, e.g., https://s3.example.com:1234.</p>
                <Input placeholder="Internal Endpoint" {...register("s3_endpointInternal")} />
                <p className="mt-1 text-xs text-muted-foreground">Internal S3 endpoint used by Polaris servers. Defaults to Endpoint if not set.</p>
                <Input placeholder="STS Endpoint" {...register("s3_stsEndpoint")} />
                <p className="mt-1 text-xs text-muted-foreground">STS endpoint used by Polaris servers when vending credentials.</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("s3_stsUnavailable")} /> STS unavailable
                </label>
                <p className="mt-1 text-xs text-muted-foreground">If true, Polaris avoids using STS and will not vend storage credentials.</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("s3_pathStyleAccess")} /> Path-style access
                </label>
                <p className="mt-1 text-xs text-muted-foreground">Whether S3 requests should use path-style addressing for buckets.</p>
              </div>
            </div>
          )}

          {storageType === "AZURE" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Azure options</Label>
              <div className="space-y-2">
                <div>
                  <Input placeholder="Tenant ID" {...register("azure_tenantId")} />
                  {errors.azure_tenantId && (
                    <p className="text-sm text-red-600">{errors.azure_tenantId.message}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Azure Tenant ID that the storage accounts belong to.</p>
                </div>
                <Input placeholder="Multi-tenant app name" {...register("azure_multiTenantAppName")} />
                <p className="mt-1 text-xs text-muted-foreground">Name of the Azure client application for multi-tenant usage.</p>
                <Input placeholder="Consent URL" {...register("azure_consentUrl")} />
                <p className="mt-1 text-xs text-muted-foreground">URL to the Azure permissions request page.</p>
              </div>
            </div>
          )}

          {storageType === "GCS" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">GCS options</Label>
              <Input placeholder="Service account" {...register("gcs_serviceAccount")} />
              <p className="mt-1 text-xs text-muted-foreground">Google Cloud Storage service account used to access data.</p>
            </div>
          )}

          {/* External connection */}
          {catalogType === "EXTERNAL" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">External connection</Label>
              <div className="space-y-2">
                <Controller
                  name="connectionType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Connection type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ICEBERG_REST">ICEBERG_REST</SelectItem>
                        <SelectItem value="HADOOP">HADOOP</SelectItem>
                        <SelectItem value="HIVE">HIVE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">The remote catalog service type.</p>
                <Input placeholder="URI (optional)" {...register("conn_uri")} />
                <p className="mt-1 text-xs text-muted-foreground">URI to the remote catalog service (if applicable).</p>
              </div>
              <Controller
                name="auth_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Auth type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OAUTH">OAUTH</SelectItem>
                      <SelectItem value="BEARER">BEARER</SelectItem>
                      <SelectItem value="SIGV4">SIGV4</SelectItem>
                      <SelectItem value="IMPLICIT">IMPLICIT</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">Authentication method to use when connecting to the remote service.</p>
              {/* Auth-specific fields */}
              {authType === "OAUTH" && (
                <div className="space-y-2">
                  <Input placeholder="OAuth token URI" {...register("oauth_tokenUri")} />
                  <p className="mt-1 text-xs text-muted-foreground">Token server URI for exchanging client credentials.</p>
                  <Input placeholder="OAuth client ID" {...register("oauth_clientId")} />
                  <p className="mt-1 text-xs text-muted-foreground">OAuth client ID.</p>
                  <Input placeholder="OAuth client secret" {...register("oauth_clientSecret")} />
                  <p className="mt-1 text-xs text-muted-foreground">OAuth client secret.</p>
                  <Input placeholder="OAuth scopes (comma-separated)" {...register("oauth_scopes")} />
                  <p className="mt-1 text-xs text-muted-foreground">Optional list of scopes used when requesting access tokens.</p>
                </div>
              )}
              {authType === "BEARER" && (
                <div className="space-y-2">
                  <Input placeholder="Bearer token" {...register("bearer_token")} />
                  <p className="mt-1 text-xs text-muted-foreground">Bearer token to include in request Authorization headers.</p>
                </div>
              )}
              {authType === "SIGV4" && (
                <div className="space-y-2">
                  <Input placeholder="SigV4 role ARN" {...register("sigv4_roleArn")} />
                  <p className="mt-1 text-xs text-muted-foreground">IAM role ARN assumed when signing requests.</p>
                  <Input placeholder="SigV4 role session name" {...register("sigv4_roleSessionName")} />
                  <p className="mt-1 text-xs text-muted-foreground">Role session name used by SigV4 for signing.</p>
                  <Input placeholder="SigV4 external ID" {...register("sigv4_externalId")} />
                  <p className="mt-1 text-xs text-muted-foreground">Optional external ID for AWS trust relationship.</p>
                  <Input placeholder="SigV4 signing region" {...register("sigv4_signingRegion")} />
                  <p className="mt-1 text-xs text-muted-foreground">AWS region used for SigV4 signing.</p>
                  <Input placeholder="SigV4 signing name" {...register("sigv4_signingName")} />
                  <p className="mt-1 text-xs text-muted-foreground">Service name used for SigV4 signing (defaults to execute-api if not provided).</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
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

export default CreateCatalogModal


