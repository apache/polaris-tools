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
import { config } from "@/lib/config"
import type { OAuthTokenResponse } from "@/types/api"
import {
  generatePKCE,
  generateState,
  storePKCEVerifier,
  getPKCEVerifier,
  storeState,
  getState,
  clearPKCESession,
} from "@/lib/pkce"
import { discoverOIDCEndpoints } from "@/lib/oidc-discovery"

const TOKEN_URL = config.OAUTH_TOKEN_URL || `${config.POLARIS_API_URL}/api/catalog/v1/oauth/tokens`

export const authApi = {
  getToken: async (
    clientId: string,
    clientSecret: string,
    scope: string
  ): Promise<OAuthTokenResponse> => {
    const formData = new URLSearchParams()
    formData.append("grant_type", "client_credentials")
    formData.append("client_id", clientId)
    formData.append("client_secret", clientSecret)
    formData.append("scope", scope)

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    }

    if (config.POLARIS_REALM) {
      headers[config.REALM_HEADER_NAME] = config.POLARIS_REALM
    }

    const response = await axios.post<OAuthTokenResponse>(TOKEN_URL, formData, {
      headers,
    })

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

    const response = await axios.post<OAuthTokenResponse>(TOKEN_URL, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${apiClient.getAccessToken()}`,
      },
    })

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

    const response = await axios.post<OAuthTokenResponse>(TOKEN_URL, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    if (response.data.access_token) {
      apiClient.setAccessToken(response.data.access_token)
    }

    return response.data
  },

  logout: (): void => {
    apiClient.clearAccessToken()
    clearPKCESession()
    setTimeout(() => {
      navigate("/login", true)
    }, 100)
  },

  initiateOIDCFlow: async (): Promise<void> => {
    const issuerUrl = config.OIDC_ISSUER_URL
    const clientId = config.OIDC_CLIENT_ID
    const redirectUri = config.OIDC_REDIRECT_URI
    const scope = config.OIDC_SCOPE

    if (!issuerUrl || !clientId || !redirectUri) {
      throw new Error("OIDC configuration is incomplete. Please check environment variables.")
    }

    clearPKCESession()

    const discovery = await discoverOIDCEndpoints(issuerUrl)
    const authorizationUrl = discovery.authorization_endpoint

    const { verifier, challenge } = await generatePKCE()
    const state = generateState()

    storePKCEVerifier(verifier)
    storeState(state)

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "login",
    })

    window.location.href = `${authorizationUrl}?${params.toString()}`
  },

  handleOIDCCallback: async (code: string, state: string): Promise<OAuthTokenResponse> => {
    const storedState = getState()
    if (!storedState || storedState !== state) {
      clearPKCESession()
      throw new Error("Invalid state parameter. Possible CSRF attack.")
    }

    const verifier = getPKCEVerifier()
    if (!verifier) {
      clearPKCESession()
      throw new Error("Code verifier not found. Please restart the login process.")
    }

    const redirectUri = config.OIDC_REDIRECT_URI
    if (!redirectUri) {
      clearPKCESession()
      throw new Error("Redirect URI not configured.")
    }

    try {
      const oidcTokenResponse = await authApi.exchangeAuthCode(code, verifier, redirectUri)
      clearPKCESession()
      return oidcTokenResponse
    } catch (error) {
      clearPKCESession()
      throw error
    }
  },

  exchangeAuthCode: async (
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> => {
    const issuerUrl = config.OIDC_ISSUER_URL
    const clientId = config.OIDC_CLIENT_ID

    if (!issuerUrl || !clientId) {
      throw new Error("OIDC configuration is incomplete. Please check environment variables.")
    }

    const discovery = await discoverOIDCEndpoints(issuerUrl)
    const tokenUrl = discovery.token_endpoint

    const formData = new URLSearchParams()
    formData.append("grant_type", "authorization_code")
    formData.append("code", code)
    formData.append("client_id", clientId)
    formData.append("redirect_uri", redirectUri)
    formData.append("code_verifier", codeVerifier)

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    }

    const response = await axios.post<OAuthTokenResponse>(tokenUrl, formData, {
      headers,
    })

    if (response.data.access_token) {
      apiClient.setAccessToken(response.data.access_token)
    }

    return response.data
  },
}
