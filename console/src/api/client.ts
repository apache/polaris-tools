import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { navigate } from "@/lib/navigation"

// Always use relative URLs to go through the proxy (dev server or production server)
// This avoids CORS issues by proxying requests through the server
// The server.ts proxy handles /api routes in production, and Vite handles them in development
const API_BASE_URL = ""
const MANAGEMENT_BASE_URL = `${API_BASE_URL}/api/management/v1`
const CATALOG_BASE_URL = `${API_BASE_URL}/api/catalog/v1`

class ApiClient {
  private managementClient: AxiosInstance
  private catalogClient: AxiosInstance

  constructor() {
    this.managementClient = axios.create({
      baseURL: MANAGEMENT_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    })

    this.catalogClient = axios.create({
      baseURL: CATALOG_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    const requestInterceptor = (config: InternalAxiosRequestConfig) => {
      const token = this.getAccessToken()
      // Read realm from localStorage, fallback to environment variable for backward compatibility
      const realm = localStorage.getItem("polaris_realm") || import.meta.env.VITE_POLARIS_REALM

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      if (realm) {
        config.headers["Polaris-Realm"] = realm
      }

      return config
    }

    // Response interceptor for error handling
    const responseErrorInterceptor = (error: unknown) => {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          this.clearAccessToken()
          navigate("/login", true)
        }
      }
      return Promise.reject(error)
    }

    this.managementClient.interceptors.request.use(requestInterceptor)
    this.catalogClient.interceptors.request.use(requestInterceptor)
    this.managementClient.interceptors.response.use(
      (response) => response,
      responseErrorInterceptor
    )
    this.catalogClient.interceptors.response.use(
      (response) => response,
      responseErrorInterceptor
    )
  }

  getAccessToken(): string | null {
    return localStorage.getItem("polaris_access_token")
  }

  clearAccessToken(): void {
    localStorage.removeItem("polaris_access_token")
    localStorage.removeItem("polaris_realm")
  }

  setAccessToken(token: string): void {
    localStorage.setItem("polaris_access_token", token)
  }

  getManagementClient(): AxiosInstance {
    return this.managementClient
  }

  getCatalogClient(): AxiosInstance {
    return this.catalogClient
  }
}

export const apiClient = new ApiClient()

