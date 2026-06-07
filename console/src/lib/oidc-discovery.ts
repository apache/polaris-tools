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

import axios from "axios"

interface OIDCDiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
  end_session_endpoint?: string
}

const DISCOVERY_CACHE_KEY = "oidc_discovery_cache"
const CACHE_TTL_MS = 3600000

interface CachedDiscovery {
  document: OIDCDiscoveryDocument
  timestamp: number
}

function getCachedDiscovery(issuer: string): OIDCDiscoveryDocument | null {
  try {
    const cached = sessionStorage.getItem(`${DISCOVERY_CACHE_KEY}_${issuer}`)
    if (!cached) return null

    const parsed: CachedDiscovery = JSON.parse(cached)
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${DISCOVERY_CACHE_KEY}_${issuer}`)
      return null
    }

    return parsed.document
  } catch {
    return null
  }
}

function setCachedDiscovery(issuer: string, document: OIDCDiscoveryDocument): void {
  try {
    const cached: CachedDiscovery = {
      document,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(`${DISCOVERY_CACHE_KEY}_${issuer}`, JSON.stringify(cached))
  } catch {
    // Ignore cache errors
  }
}

export async function discoverOIDCEndpoints(issuer: string): Promise<OIDCDiscoveryDocument> {
  const cached = getCachedDiscovery(issuer)
  if (cached) {
    return cached
  }

  const wellKnownUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`

  try {
    const response = await axios.get<OIDCDiscoveryDocument>(wellKnownUrl, {
      timeout: 5000,
    })

    if (!response.data.authorization_endpoint || !response.data.token_endpoint) {
      throw new Error("Invalid OIDC discovery document: missing required endpoints")
    }

    setCachedDiscovery(issuer, response.data)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to discover OIDC endpoints from ${wellKnownUrl}: ${error.message}`)
    }
    throw error
  }
}
