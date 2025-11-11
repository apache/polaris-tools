import axios from "axios"
import { apiClient } from "./client"
import { navigate } from "@/lib/navigation"
import type { OAuthTokenResponse } from "@/types/api"

// In development, always use relative URL to go through Vite proxy
// This avoids CORS issues by proxying requests through the dev server
const TOKEN_URL =
  import.meta.env.PROD && import.meta.env.VITE_OAUTH_TOKEN_URL
    ? import.meta.env.VITE_OAUTH_TOKEN_URL
    : "/api/catalog/v1/oauth/tokens"

// Log OAuth URL in development only
if (import.meta.env.DEV) {
  console.log("🔐 Using OAuth token URL:", TOKEN_URL)
}

export const authApi = {
  getToken: async (
    clientId: string,
    clientSecret: string
  ): Promise<OAuthTokenResponse> => {
    const formData = new URLSearchParams()
    formData.append("grant_type", "client_credentials")
    formData.append("client_id", clientId)
    formData.append("client_secret", clientSecret)
    formData.append("scope", "PRINCIPAL_ROLE:ALL")

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
    // Use a small delay to allow toast to show before redirect
    setTimeout(() => {
      navigate("/login", true)
    }, 100)
  },
}

