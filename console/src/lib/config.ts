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
  VITE_OAUTH_TOKEN_URL?: string
  VITE_POLARIS_REALM_HEADER_NAME?: string
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig
  }
}

function getConfig<T extends string | undefined>(
  key: keyof AppConfig,
  defaultValue?: T
): T {
  // First try runtime config
  const runtimeValue = window.APP_CONFIG?.[key]
  if (runtimeValue !== undefined && runtimeValue !== '') {
    return runtimeValue as T
  }
  
  // Then try build-time config
  const buildTimeValue = import.meta.env[key]
  if (buildTimeValue !== undefined && buildTimeValue !== '') {
    return buildTimeValue as T
  }
  
  // Finally use default
  return defaultValue as T
}

export const config = {
  POLARIS_API_URL: getConfig('VITE_POLARIS_API_URL', ''),
  POLARIS_REALM: getConfig('VITE_POLARIS_REALM', ''),
  OAUTH_TOKEN_URL: getConfig('VITE_OAUTH_TOKEN_URL', ''),
  REALM_HEADER_NAME: getConfig('VITE_POLARIS_REALM_HEADER_NAME', 'Polaris-Realm'),
}

