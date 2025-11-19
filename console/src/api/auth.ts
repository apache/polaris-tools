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
import { apiClient } from "./client"
import { navigate } from "@/lib/navigation"
import { REALM_HEADER_NAME } from "@/lib/constants"
import type { OAuthTokenResponse } from "@/types/api"

// Always use relative URL to go through the proxy (dev server or production server)
// This avoids CORS issues by proxying requests through the server
// The server.ts proxy handles /api routes in production, and Vite handles them in development
const TOKEN_URL = "/api/catalog/v1/oauth/tokens"

// Log OAuth URL in development only
if (import.meta.env.DEV) {
  console.log("🔐 Using OAuth token URL:", TOKEN_URL)
}

export const authApi = {
  getToken: async (
    clientId: string,
    clientSecret: string,
    realm?: string
  ): Promise<OAuthTokenResponse> => {
    const formData = new URLSearchParams()
    formData.append("grant_type", "client_credentials")
    formData.append("client_id", clientId)
    formData.append("client_secret", clientSecret)
    formData.append("scope", "PRINCIPAL_ROLE:ALL")

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    }

    // Add realm header if provided
    if (realm) {
      headers[REALM_HEADER_NAME] = realm
    }

    const response = await axios.post<OAuthTokenResponse>(
      TOKEN_URL,
      formData,
      {
        headers,
      }
    )

    if (response.data.access_token) {
      apiClient.setAccessToken(response.data.access_token)
    }

    return response.data
  },

  exchangeToken: async (
    subjectToken: string,
    subjectTokenType: string
  ): Promise<OAuthTokenResponse> => {
    const formData = new URLSearchParams()
    formData.append("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange")
    formData.append("subject_token", subjectToken)
    formData.append("subject_token_type", subjectTokenType)

    const response = await axios.post<OAuthTokenResponse>(
      TOKEN_URL,
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${apiClient.getAccessToken()}`,
        },
      }
    )

    if (response.data.access_token) {
      apiClient.setAccessToken(response.data.access_token)
    }

    return response.data
  },

  refreshToken: async (accessToken: string): Promise<OAuthTokenResponse> => {
    const formData = new URLSearchParams()
    formData.append("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange")
    formData.append("subject_token", accessToken)
    formData.append("subject_token_type", "urn:ietf:params:oauth:token-type:access_token")

    const response = await axios.post<OAuthTokenResponse>(
      TOKEN_URL,
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )

    if (response.data.access_token) {
      apiClient.setAccessToken(response.data.access_token)
    }

    return response.data
  },

  logout: (): void => {
    localStorage.removeItem("polaris_access_token")
    localStorage.removeItem("polaris_realm")
    // Use a small delay to allow toast to show before redirect
    setTimeout(() => {
      navigate("/login", true)
    }, 100)
  },
}

