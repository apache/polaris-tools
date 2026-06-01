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

import type { SetupConfig, CatalogSetupConfig } from "@/types/setup-config"

export interface PresetParam {
  key: string
  label: string
  placeholder: string
  required: boolean
}

export interface Preset {
  id: string
  label: string
  description: string
  badge?: string
  storageType: "file" | "s3" | "azure" | "gcs"
  params: PresetParam[]
  buildConfig: (params: Record<string, string>) => SetupConfig
}

const QUICKSTART_CONFIG: SetupConfig = {
  principal_roles: ["quickstart_user_role"],
  principals: { quickstart_user: { roles: ["quickstart_user_role"] } },
  catalogs: [
    {
      name: "quickstart_catalog",
      type: "INTERNAL",
      storage_type: "file",
      default_base_location: "file:///var/tmp/quickstart_catalog/",
      allowed_locations: ["file:///var/tmp/quickstart_catalog/"],
      roles: {
        quickstart_catalog_role: {
          assign_to: ["quickstart_user_role"],
          privileges: { catalog: ["CATALOG_MANAGE_CONTENT"] },
        },
      },
      namespaces: ["dev_namespace"],
    },
  ],
}

function buildQuickstartConfig(): SetupConfig {
  return structuredClone(QUICKSTART_CONFIG)
}

function buildCloudConfig(
  prefix: string,
  storageConfig: Partial<CatalogSetupConfig>,
  baseLocation: string
): SetupConfig {
  return {
    principal_roles: [`${prefix}_admin_role`],
    principals: { [`${prefix}_admin`]: { roles: [`${prefix}_admin_role`] } },
    catalogs: [
      {
        name: `${prefix}_catalog`,
        default_base_location: baseLocation,
        allowed_locations: [baseLocation],
        ...storageConfig,
        roles: {
          [`${prefix}_catalog_role`]: {
            assign_to: [`${prefix}_admin_role`],
            privileges: { catalog: ["CATALOG_MANAGE_CONTENT"] },
          },
        },
        namespaces: ["default"],
      } as CatalogSetupConfig,
    ],
  }
}

function buildS3Config(p: Record<string, string>): SetupConfig {
  return buildCloudConfig(
    "s3",
    {
      storage_type: "s3",
      role_arn: p.roleArn,
      region: p.region,
      allowed_locations: [`s3://${p.bucket}/`],
    },
    `s3://${p.bucket}/polaris/`
  )
}

function buildAzureConfig(p: Record<string, string>): SetupConfig {
  const base = `abfss://${p.container}@${p.storageAccount}.dfs.core.windows.net/polaris/`
  return buildCloudConfig("azure", { storage_type: "azure", tenant_id: p.tenantId }, base)
}

function buildGcsConfig(p: Record<string, string>): SetupConfig {
  return buildCloudConfig(
    "gcs",
    { storage_type: "gcs", service_account: p.serviceAccount || undefined },
    `gs://${p.bucket}/polaris/`
  )
}

export const PRESETS: Preset[] = [
  {
    id: "quickstart",
    label: "Quickstart",
    description: "Local file storage. No cloud credentials needed. Perfect for trying Polaris.",
    badge: "Recommended",
    storageType: "file",
    params: [],
    buildConfig: buildQuickstartConfig,
  },
  {
    id: "s3",
    label: "AWS S3",
    description: "Internal catalog backed by Amazon S3.",
    storageType: "s3",
    params: [
      { key: "bucket", label: "S3 Bucket Name", placeholder: "my-polaris-bucket", required: true },
      { key: "region", label: "AWS Region", placeholder: "us-east-1", required: true },
      {
        key: "roleArn",
        label: "IAM Role ARN",
        placeholder: "arn:aws:iam::123456789012:role/PolarisRole",
        required: true,
      },
    ],
    buildConfig: buildS3Config,
  },
  {
    id: "azure",
    label: "Azure ADLS Gen2",
    description: "Internal catalog backed by Azure Data Lake Storage.",
    storageType: "azure",
    params: [
      {
        key: "storageAccount",
        label: "Storage Account Name",
        placeholder: "myaccount",
        required: true,
      },
      { key: "container", label: "Container Name", placeholder: "polaris", required: true },
      {
        key: "tenantId",
        label: "Azure Tenant ID",
        placeholder: "12345678-1234-1234-1234-123456789abc",
        required: true,
      },
    ],
    buildConfig: buildAzureConfig,
  },
  {
    id: "gcs",
    label: "Google Cloud Storage",
    description: "Internal catalog backed by Google Cloud Storage.",
    storageType: "gcs",
    params: [
      { key: "bucket", label: "GCS Bucket Name", placeholder: "my-polaris-bucket", required: true },
      {
        key: "serviceAccount",
        label: "Service Account Email (optional)",
        placeholder: "polaris@project.iam.gserviceaccount.com",
        required: false,
      },
    ],
    buildConfig: buildGcsConfig,
  },
]
