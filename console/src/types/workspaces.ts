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

export const AuthProviderType = {
  INTERNAL: "internal",
  OIDC: "oidc",
} as const

export type AuthProviderType = (typeof AuthProviderType)[keyof typeof AuthProviderType]

export interface InternalAuthConfig {
  type: "internal"
  url: string
  scope: string
}

export interface OIDCAuthConfig {
  type: "oidc"
  url: string
  client_id: string
  scope: string
}

export type AuthConfig = InternalAuthConfig | OIDCAuthConfig

export interface ServerConfig {
  api: string
}

export interface Workspace {
  name: string
  description: string
  is_default: boolean
  "realm-header": string
  realm: string
  server?: ServerConfig
  auth: AuthConfig[]
}

export interface WorkspacesConfig {
  workspaces: Workspace[]
}
