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

export interface SetupConfig {
  principal_roles?: string[]
  principals?: Record<string, PrincipalConfig>
  catalogs?: CatalogSetupConfig[]
}

export interface PrincipalConfig {
  type?: "SERVICE" | "USER"
  roles?: string[]
  properties?: Record<string, string>
}

export interface CatalogSetupConfig {
  name: string
  type?: "INTERNAL" | "EXTERNAL"
  storage_type: "file" | "s3" | "azure" | "gcs"
  default_base_location: string
  allowed_locations?: string[]
  // S3-specific (top-level in YAML)
  role_arn?: string
  external_id?: string
  user_arn?: string
  region?: string
  endpoint?: string
  sts_unavailable?: boolean
  path_style_access?: boolean
  // Azure-specific (top-level in YAML)
  tenant_id?: string
  multi_tenant_app_name?: string
  consent_url?: string
  // GCS-specific (top-level in YAML)
  service_account?: string
  // General
  properties?: Record<string, string>
  roles?: Record<string, CatalogRoleSetupConfig>
  namespaces?: (string | NamespaceSetupConfig)[]
  policies?: Record<string, unknown>
}

export interface CatalogRoleSetupConfig {
  assign_to?: string[]
  privileges?: {
    catalog?: string[]
    namespace?: Record<string, string[]>
  }
}

export interface NamespaceSetupConfig {
  name: string
  children?: string[]
  properties?: Record<string, string>
}
