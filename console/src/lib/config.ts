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

interface AppConfig {
  VITE_POLARIS_API_URL?: string
  VITE_POLARIS_REALM?: string
  VITE_POLARIS_PRINCIPAL_SCOPE: string
  VITE_OAUTH_TOKEN_URL?: string
  VITE_POLARIS_REALM_HEADER_NAME?: string
  VITE_OIDC_ISSUER_URL?: string
  VITE_OIDC_CLIENT_ID?: string
  VITE_OIDC_REDIRECT_URI?: string
  VITE_OIDC_SCOPE?: string
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig
  }
}

function getConfig(key: keyof AppConfig, defaultValue: string = ""): string {
  const runtimeValue = window.APP_CONFIG?.[key]
  if (runtimeValue !== undefined && runtimeValue !== "") {
    return runtimeValue
  }

  const buildTimeValue = import.meta.env[key]
  if (buildTimeValue !== undefined && buildTimeValue !== "") {
    return buildTimeValue
  }

  return defaultValue
}

export const config = {
  POLARIS_API_URL: getConfig("VITE_POLARIS_API_URL", ""),
  POLARIS_REALM: getConfig("VITE_POLARIS_REALM", "POLARIS"),
  POLARIS_PRINCIPAL_SCOPE: getConfig("VITE_POLARIS_PRINCIPAL_SCOPE", ""),
  OAUTH_TOKEN_URL: getConfig("VITE_OAUTH_TOKEN_URL", ""),
  REALM_HEADER_NAME: getConfig("VITE_POLARIS_REALM_HEADER_NAME", "Polaris-Realm"),
  OIDC_ISSUER_URL: getConfig("VITE_OIDC_ISSUER_URL", ""),
  OIDC_CLIENT_ID: getConfig("VITE_OIDC_CLIENT_ID", ""),
  OIDC_REDIRECT_URI: getConfig("VITE_OIDC_REDIRECT_URI", ""),
  OIDC_SCOPE: getConfig("VITE_OIDC_SCOPE", "openid profile email"),
}
