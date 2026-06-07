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

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { navigate } from "@/lib/navigation"
import { config as appConfig } from "@/lib/config"

const API_BASE_URL = appConfig.POLARIS_API_URL
const MANAGEMENT_BASE_URL = `${API_BASE_URL}/api/management/v1`
const CATALOG_BASE_URL = `${API_BASE_URL}/api/catalog/v1`
const GENERIC_TABLES_BASE_URL = `${API_BASE_URL}/api/catalog/polaris/v1`

class ApiClient {
  private managementClient: AxiosInstance
  private catalogClient: AxiosInstance
  private polarisClient: AxiosInstance
  private accessToken: string | null = null

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

    this.polarisClient = axios.create({
      baseURL: GENERIC_TABLES_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    const requestInterceptor = (config: InternalAxiosRequestConfig) => {
      const token = this.getAccessToken()

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      if (appConfig.POLARIS_REALM) {
        config.headers[appConfig.REALM_HEADER_NAME] = appConfig.POLARIS_REALM
      }

      return config
    }

    const responseErrorInterceptor = (error: unknown) => {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          this.clearAccessToken()
          const errorMessage =
            error.response?.data?.message ||
            "Authentication failed. User may not exist in Polaris or token is invalid."
          sessionStorage.setItem("auth_error", errorMessage)
          navigate("/login", true)
        }
      }
      return Promise.reject(error)
    }

    this.managementClient.interceptors.request.use(requestInterceptor)
    this.catalogClient.interceptors.request.use(requestInterceptor)
    this.polarisClient.interceptors.request.use(requestInterceptor)
    this.managementClient.interceptors.response.use(
      (response) => response,
      responseErrorInterceptor
    )
    this.catalogClient.interceptors.response.use((response) => response, responseErrorInterceptor)
    this.polarisClient.interceptors.response.use((response) => response, responseErrorInterceptor)
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  clearAccessToken(): void {
    this.accessToken = null
  }

  setAccessToken(token: string): void {
    this.accessToken = token
  }

  getManagementClient(): AxiosInstance {
    return this.managementClient
  }

  getCatalogClient(): AxiosInstance {
    return this.catalogClient
  }

  getPolarisClient(): AxiosInstance {
    return this.polarisClient
  }
}

export const apiClient = new ApiClient()
