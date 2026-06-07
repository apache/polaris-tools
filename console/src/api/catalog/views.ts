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

import { apiClient } from "../client"
import type { ListViewsResponse, CreateViewRequest, LoadViewResult } from "@/types/api"

/**
 * Encodes a namespace array to URL format.
 * Namespace parts are separated by the unit separator character (0x1F).
 */
function encodeNamespace(namespace: string[]): string {
  return namespace.join("\x1F")
}

export const viewsApi = {
  /**
   * List views in a namespace.
   * @param prefix - The catalog name (prefix)
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   */
  list: async (
    prefix: string,
    namespace: string[]
  ): Promise<Array<{ namespace: string[]; name: string }>> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .get<ListViewsResponse>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/views`
      )
    return response.data.identifiers
  },

  /**
   * Get view details.
   * @param prefix - The catalog name
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   * @param viewName - View name
   */
  get: async (prefix: string, namespace: string[], viewName: string): Promise<LoadViewResult> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .get<LoadViewResult>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/views/${encodeURIComponent(viewName)}`
      )
    return response.data
  },

  /**
   * Delete a view.
   * @param prefix - The catalog name
   * @param namespace - Namespace array
   * @param viewName - View name
   */
  delete: async (prefix: string, namespace: string[], viewName: string): Promise<void> => {
    const namespaceStr = encodeNamespace(namespace)
    await apiClient
      .getCatalogClient()
      .delete(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/views/${encodeURIComponent(viewName)}`
      )
  },

  /**
   * Create a view in a namespace.
   * @param prefix - The catalog name
   * @param namespace - Namespace array
   * @param request - Create view request body
   */
  create: async (
    prefix: string,
    namespace: string[],
    request: CreateViewRequest
  ): Promise<LoadViewResult> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .post<LoadViewResult>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/views`,
        request
      )
    return response.data
  },
}
