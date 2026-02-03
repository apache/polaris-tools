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

// Management Service API Types

export interface StorageConfigInfo {
  storageType: "S3" | "AZURE" | "GCS" | "FILE"
  allowedLocations?: string[]
  // S3-specific
  roleArn?: string
  externalId?: string
  userArn?: string
  region?: string
  endpoint?: string
  endpointInternal?: string
  stsEndpoint?: string
  stsUnavailable?: boolean
  pathStyleAccess?: boolean
  // Azure-specific
  tenantId?: string
  multiTenantAppName?: string
  consentUrl?: string
  // GCS-specific
  gcsServiceAccount?: string
}

export interface ConnectionConfigInfo {
  connectionType: "ICEBERG_REST" | "HADOOP" | "HIVE"
  uri?: string
  authenticationParameters?: unknown
  serviceIdentity?: unknown
}

export interface Catalog {
  type: "INTERNAL" | "EXTERNAL"
  name: string
  properties?: Record<string, string>
  currentEntityVersion?: number
  entityVersion?: number
  createTimestamp?: number
  lastUpdateTimestamp?: number
  storageConfigInfo?: StorageConfigInfo
  connectionConfigInfo?: ConnectionConfigInfo
}

export interface CreateCatalogRequest {
  catalog: Catalog & {
    storageType?: string
    defaultBaseLocation?: string
    endpoint?: string
    endpointInternal?: string
    stsEndpoint?: string
    pathStyleAccess?: boolean
    allowedLocations?: string[]
    roleArn?: string
    region?: string
    externalId?: string
    tenantId?: string
    multiTenantAppName?: string
    consentUrl?: string
    serviceAccount?: string
    catalogConnectionType?: string
    icebergRemoteCatalogName?: string
    hadoopWarehouse?: string
    catalogAuthenticationType?: string
    catalogServiceIdentityType?: string
    catalogServiceIdentityIamArn?: string
    catalogUri?: string
    catalogTokenUri?: string
    catalogClientId?: string
    catalogClientSecret?: string
    catalogClientScope?: string[]
    catalogBearerToken?: string
    catalogRoleArn?: string
    catalogRoleSessionName?: string
    catalogExternalId?: string
    catalogSigningRegion?: string
    catalogSigningName?: string
  }
}

export interface UpdateCatalogRequest {
  properties?: Record<string, string>
  storageConfigInfo?: StorageConfigInfo
  currentEntityVersion?: number
}

export interface CatalogsResponse {
  catalogs: Catalog[]
}

// Principals
export interface Principal {
  name: string
  type?: string
  properties?: Record<string, string>
  currentEntityVersion?: string
}

export interface CreatePrincipalRequest {
  principal: {
    name: string
    properties?: Record<string, string>
  }
  credentialRotationRequired?: boolean
}

export interface PrincipalWithCredentials {
  principal: Principal
  credentials: {
    clientId: string
    clientSecret: string
  }
}

export interface PrincipalsResponse {
  principals: Principal[]
}

// Principal Roles
export interface PrincipalRole {
  name: string
  properties?: Record<string, string>
  currentEntityVersion?: string
}

export interface PrincipalRolesResponse {
  roles?: PrincipalRole[]
  principalRoles?: PrincipalRole[]
}

export interface PrincipalRoleRequest {
  name: string
  properties?: Record<string, string>
}

// Catalog Roles
export interface CatalogRole {
  name: string
  catalogName?: string // May not be present in API response, we add it when fetching
  properties?: Record<string, string>
  currentEntityVersion?: string
  entityVersion?: number // API returns this field
  createTimestamp?: number
  lastUpdateTimestamp?: number
}

export interface CatalogRolesResponse {
  catalogRoles: CatalogRole[]
  roles?: CatalogRole[] // API may return this format
}

// Catalog Service API Types (Iceberg REST)
export interface Namespace {
  namespace: string[]
  properties?: Record<string, string>
}

export interface CreateNamespaceRequest {
  namespace: string[]
  properties?: Record<string, string>
}

export interface ListNamespacesResponse {
  // API can return either format:
  // 1. Array of namespace arrays: [["ns1"], ["ns2"]]
  // 2. Array of namespace objects: [{namespace: ["ns1"]}, {namespace: ["ns2"]}]
  namespaces: Namespace[] | string[][]
  nextPageToken?: string | null
  "next-page-token"?: string | null
}

// Tables
export interface Table {
  name: string
  namespace: string[]
  metadata?: {
    location?: string
    schema?: TableSchema
    [key: string]: unknown
  }
}

export interface TableSchema {
  type: string
  fields: SchemaField[]
  "schema-id"?: number
}

export interface SchemaField {
  id: number
  name: string
  type: string | { type: string; [key: string]: unknown }
  required: boolean
  comment?: string
}

export interface CreateTableRequest {
  name: string
  schema: TableSchema
  partitionSpec?: unknown
  properties?: Record<string, string>
}

export interface CreateGenericTableRequest {
  name: string
  format: string
  "base-location"?: string
  doc?: string
  properties?: Record<string, string>
}

export interface GenericTable {
  name: string
  format: string
  "base-location"?: string
  doc?: string
  properties?: Record<string, string>
}

export interface LoadGenericTableResponse {
  table: GenericTable
}

export interface GenericTableIdentifier {
  namespace: string[]
  name: string
  type?: string
  createTime?: string
}

export interface ListTablesResponse {
  identifiers: Array<{
    namespace: string[]
    name: string
  }>
  nextPageToken?: string
}

// Views
export interface ListViewsResponse {
  identifiers: Array<{
    namespace: string[]
    name: string
  }>
  nextPageToken?: string
}

export interface ViewSchemaField {
  id: number
  name: string
  type: string
  required: boolean
  doc?: string
}

export interface IcebergSchema {
  type: "struct"
  fields: ViewSchemaField[]
  "schema-id"?: number
  "identifier-field-ids"?: number[]
}

export interface SQLViewRepresentation {
  type: "sql"
  sql: string
  dialect: string
}

export interface ViewVersion {
  "version-id": number
  "timestamp-ms": number
  "schema-id": number
  summary: Record<string, string>
  representations: SQLViewRepresentation[]
  "default-namespace": string[]
}

export interface CreateViewRequest {
  name: string
  location?: string
  schema: IcebergSchema
  "view-version": ViewVersion
  properties: Record<string, string>
}

export interface ViewMetadata {
  "view-uuid": string
  "format-version": number
  location: string
  "current-version-id": number
  versions: ViewVersion[]
  "version-log": Array<{
    "version-id": number
    "timestamp-ms": number
  }>
  schemas: IcebergSchema[]
  properties?: Record<string, string>
}

export interface LoadViewResult {
  "metadata-location": string
  metadata: ViewMetadata
  config?: Record<string, string>
}

// LoadTableResult - response from GET /v1/{prefix}/namespaces/{namespace}/tables/{table}
export interface LoadTableResult {
  "metadata-location"?: string | null
  metadata: TableMetadata
  config?: Record<string, string>
  "storage-credentials"?: Array<{
    prefix: string
    config: Record<string, string>
  }>
}

export interface TableMetadata {
  "format-version": number
  "table-uuid": string
  location?: string
  "last-updated-ms"?: number
  properties?: Record<string, string>
  schemas: Array<TableSchema>
  "current-schema-id": number
  "last-column-id"?: number
  "partition-specs"?: Array<{
    "spec-id": number
    fields: Array<{
      "field-id"?: number
      "source-id": number
      name: string
      transform: string
    }>
  }>
  "default-spec-id"?: number
  "last-partition-id"?: number
  "sort-orders"?: Array<{
    "order-id": number
    fields: Array<{
      "source-id": number
      transform: string
      direction: string
      "null-order": string
    }>
  }>
  "default-sort-order-id"?: number
  snapshots?: Array<{
    "snapshot-id": number
    "parent-snapshot-id"?: number
    "sequence-number"?: number
    "timestamp-ms": number
    "manifest-list": string
    summary: {
      operation: string
      [key: string]: unknown
    }
    "schema-id"?: number
  }>
  refs?: Record<
    string,
    {
      type: string
      "snapshot-id": number
      "max-ref-age-ms"?: number
      "max-snapshot-age-ms"?: number
      "min-snapshots-to-keep"?: number
    }
  >
  "current-snapshot-id"?: number
  "last-sequence-number"?: number
  "snapshot-log"?: Array<{
    "snapshot-id": number
    "timestamp-ms": number
  }>
  "metadata-log"?: Array<{
    "metadata-file": string
    "timestamp-ms": number
  }>
  statistics?: Array<{
    "snapshot-id": number
    "statistics-path": string
    "file-size-in-bytes": number
    "file-footer-size-in-bytes": number
    "blob-metadata": Array<{
      type: string
      "snapshot-id": number
      "sequence-number": number
      fields: number[]
      properties?: Record<string, string>
    }>
  }>
  "partition-statistics"?: Array<{
    "snapshot-id": number
    "statistics-path": string
    "file-size-in-bytes": number
  }>
}

// OAuth2
export interface OAuthTokenRequest {
  grant_type: string
  client_id?: string
  client_secret?: string
  subject_token?: string
  subject_token_type?: string
  actor_token?: string
  actor_token_type?: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  issued_token_type?: string
  refresh_token?: string
  id_token?: string
  scope?: string
}

// Error Responses
export interface ApiError {
  type: string
  message: string
  code?: number
}

// Privileges and Grants
export type CatalogPrivilege =
  | "CATALOG_MANAGE_ACCESS"
  | "CATALOG_MANAGE_CONTENT"
  | "CATALOG_MANAGE_METADATA"
  | "CATALOG_READ_PROPERTIES"
  | "CATALOG_WRITE_PROPERTIES"
  | "NAMESPACE_CREATE"
  | "TABLE_CREATE"
  | "VIEW_CREATE"
  | "NAMESPACE_DROP"
  | "TABLE_DROP"
  | "VIEW_DROP"
  | "NAMESPACE_LIST"
  | "TABLE_LIST"
  | "VIEW_LIST"
  | "NAMESPACE_READ_PROPERTIES"
  | "TABLE_READ_PROPERTIES"
  | "VIEW_READ_PROPERTIES"
  | "NAMESPACE_WRITE_PROPERTIES"
  | "TABLE_WRITE_PROPERTIES"
  | "VIEW_WRITE_PROPERTIES"
  | "TABLE_READ_DATA"
  | "TABLE_WRITE_DATA"
  | "NAMESPACE_FULL_METADATA"
  | "TABLE_FULL_METADATA"
  | "VIEW_FULL_METADATA"
  | "POLICY_CREATE"
  | "POLICY_WRITE"
  | "POLICY_READ"
  | "POLICY_DROP"
  | "POLICY_LIST"
  | "POLICY_FULL_METADATA"
  | "CATALOG_ATTACH_POLICY"
  | "CATALOG_DETACH_POLICY"
  | "TABLE_ASSIGN_UUID"
  | "TABLE_UPGRADE_FORMAT_VERSION"
  | "TABLE_ADD_SCHEMA"
  | "TABLE_SET_CURRENT_SCHEMA"
  | "TABLE_ADD_PARTITION_SPEC"
  | "TABLE_ADD_SORT_ORDER"
  | "TABLE_SET_DEFAULT_SORT_ORDER"
  | "TABLE_ADD_SNAPSHOT"
  | "TABLE_SET_SNAPSHOT_REF"
  | "TABLE_REMOVE_SNAPSHOTS"
  | "TABLE_REMOVE_SNAPSHOT_REF"
  | "TABLE_SET_LOCATION"
  | "TABLE_SET_PROPERTIES"
  | "TABLE_REMOVE_PROPERTIES"
  | "TABLE_SET_STATISTICS"
  | "TABLE_REMOVE_STATISTICS"
  | "TABLE_REMOVE_PARTITION_SPECS"
  | "TABLE_MANAGE_STRUCTURE"

export type NamespacePrivilege =
  | "CATALOG_MANAGE_ACCESS"
  | "CATALOG_MANAGE_CONTENT"
  | "CATALOG_MANAGE_METADATA"
  | "NAMESPACE_CREATE"
  | "TABLE_CREATE"
  | "VIEW_CREATE"
  | "NAMESPACE_DROP"
  | "TABLE_DROP"
  | "VIEW_DROP"
  | "NAMESPACE_LIST"
  | "TABLE_LIST"
  | "VIEW_LIST"
  | "NAMESPACE_READ_PROPERTIES"
  | "TABLE_READ_PROPERTIES"
  | "VIEW_READ_PROPERTIES"
  | "NAMESPACE_WRITE_PROPERTIES"
  | "TABLE_WRITE_PROPERTIES"
  | "VIEW_WRITE_PROPERTIES"
  | "TABLE_READ_DATA"
  | "TABLE_WRITE_DATA"
  | "NAMESPACE_FULL_METADATA"
  | "TABLE_FULL_METADATA"
  | "VIEW_FULL_METADATA"
  | "POLICY_CREATE"
  | "POLICY_WRITE"
  | "POLICY_READ"
  | "POLICY_DROP"
  | "POLICY_LIST"
  | "POLICY_FULL_METADATA"
  | "NAMESPACE_ATTACH_POLICY"
  | "NAMESPACE_DETACH_POLICY"
  | "TABLE_ASSIGN_UUID"
  | "TABLE_UPGRADE_FORMAT_VERSION"
  | "TABLE_ADD_SCHEMA"
  | "TABLE_SET_CURRENT_SCHEMA"
  | "TABLE_ADD_PARTITION_SPEC"
  | "TABLE_ADD_SORT_ORDER"
  | "TABLE_SET_DEFAULT_SORT_ORDER"
  | "TABLE_ADD_SNAPSHOT"
  | "TABLE_SET_SNAPSHOT_REF"
  | "TABLE_REMOVE_SNAPSHOTS"
  | "TABLE_REMOVE_SNAPSHOT_REF"
  | "TABLE_SET_LOCATION"
  | "TABLE_SET_PROPERTIES"
  | "TABLE_REMOVE_PROPERTIES"
  | "TABLE_SET_STATISTICS"
  | "TABLE_REMOVE_STATISTICS"
  | "TABLE_REMOVE_PARTITION_SPECS"
  | "TABLE_MANAGE_STRUCTURE"

export type TablePrivilege =
  | "CATALOG_MANAGE_ACCESS"
  | "TABLE_DROP"
  | "TABLE_LIST"
  | "TABLE_READ_PROPERTIES"
  | "TABLE_WRITE_PROPERTIES"
  | "TABLE_READ_DATA"
  | "TABLE_WRITE_DATA"
  | "TABLE_FULL_METADATA"
  | "TABLE_ATTACH_POLICY"
  | "TABLE_DETACH_POLICY"
  | "TABLE_ASSIGN_UUID"
  | "TABLE_UPGRADE_FORMAT_VERSION"
  | "TABLE_ADD_SCHEMA"
  | "TABLE_SET_CURRENT_SCHEMA"
  | "TABLE_ADD_PARTITION_SPEC"
  | "TABLE_ADD_SORT_ORDER"
  | "TABLE_SET_DEFAULT_SORT_ORDER"
  | "TABLE_ADD_SNAPSHOT"
  | "TABLE_SET_SNAPSHOT_REF"
  | "TABLE_REMOVE_SNAPSHOTS"
  | "TABLE_REMOVE_SNAPSHOT_REF"
  | "TABLE_SET_LOCATION"
  | "TABLE_SET_PROPERTIES"
  | "TABLE_REMOVE_PROPERTIES"
  | "TABLE_SET_STATISTICS"
  | "TABLE_REMOVE_STATISTICS"
  | "TABLE_REMOVE_PARTITION_SPECS"
  | "TABLE_MANAGE_STRUCTURE"

export type ViewPrivilege =
  | "CATALOG_MANAGE_ACCESS"
  | "VIEW_DROP"
  | "VIEW_LIST"
  | "VIEW_READ_PROPERTIES"
  | "VIEW_WRITE_PROPERTIES"
  | "VIEW_FULL_METADATA"

export type PolicyPrivilege =
  | "CATALOG_MANAGE_ACCESS"
  | "POLICY_READ"
  | "POLICY_DROP"
  | "POLICY_WRITE"
  | "POLICY_LIST"
  | "POLICY_FULL_METADATA"
  | "POLICY_ATTACH"
  | "POLICY_DETACH"

// Grant Resource Types (Discriminated Union)
export type GrantResource = CatalogGrant | NamespaceGrant | TableGrant | ViewGrant | PolicyGrant

export interface CatalogGrant {
  type: "catalog"
  privilege: CatalogPrivilege
}

export interface NamespaceGrant {
  type: "namespace"
  namespace: string[]
  privilege: NamespacePrivilege
}

export interface TableGrant {
  type: "table"
  namespace: string[]
  tableName: string
  privilege: TablePrivilege
}

export interface ViewGrant {
  type: "view"
  namespace: string[]
  viewName: string
  privilege: ViewPrivilege
}

export interface PolicyGrant {
  type: "policy"
  namespace: string[]
  policyName: string
  privilege: PolicyPrivilege
}

// Request/Response Types
export interface GrantResources {
  grants: GrantResource[]
}

export interface AddGrantRequest {
  grant: GrantResource
}

export interface RevokeGrantRequest {
  grant: GrantResource
}
