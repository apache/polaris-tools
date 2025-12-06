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
import type {
  Namespace,
  ListNamespacesResponse,
  CreateNamespaceRequest,
} from "@/types/api"

/**
 * Encodes a namespace array to URL format.
 * Namespace parts are separated by the unit separator character (0x1F).
 */
function encodeNamespace(namespace: string[]): string {
  return namespace.join("\x1F")
}


export const namespacesApi = {
  /**
   * List namespaces for a catalog, optionally filtering by parent namespace.
   * @param prefix - The catalog name (prefix)
   * @param parent - Optional parent namespace array (e.g., ["accounting", "tax"])
   */
  list: async (
    prefix: string,
    parent?: string[]
  ): Promise<Namespace[]> => {
    const params: Record<string, string> = {}
    if (parent && parent.length > 0) {
      params.parent = encodeNamespace(parent)
    }

    const response = await apiClient
      .getCatalogClient()
      .get<ListNamespacesResponse>(
        `/${encodeURIComponent(prefix)}/namespaces`,
        { params }
      )
    
    // Transform API response to expected format
    // API may return namespaces as array of arrays: [["ns1"], ["ns2"]]
    // Or as array of objects: [{namespace: ["ns1"]}, {namespace: ["ns2"]}]
    const namespaces = response.data.namespaces || []
    
    return namespaces.map((ns): Namespace => {
      // Check if it's already in the expected format (object with namespace property)
      if (ns && typeof ns === 'object' && 'namespace' in ns) {
        const namespaceObj = ns as Namespace
        if (Array.isArray(namespaceObj.namespace)) {
          return namespaceObj
        }
      }
      // Otherwise, it's an array of strings (namespace path) like ["ns1"]
      if (Array.isArray(ns) && ns.every(item => typeof item === 'string')) {
        return {
          namespace: ns,
        }
      }
      // Fallback for unexpected format
      return {
        namespace: [],
      }
    })
  },

  /**
   * Get namespace metadata.
   * @param prefix - The catalog name
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   */
  get: async (
    prefix: string,
    namespace: string[]
  ): Promise<Namespace> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .get<Namespace>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}`
      )
    return response.data
  },

  /**
   * Create a namespace.
   * @param prefix - The catalog name
   * @param request - Namespace creation request
   */
  create: async (
    prefix: string,
    request: CreateNamespaceRequest
  ): Promise<Namespace> => {
    const response = await apiClient
      .getCatalogClient()
      .post<Namespace>(
        `/${encodeURIComponent(prefix)}/namespaces`,
        request
      )
    return response.data
  },

  /**
   * Delete a namespace.
   * @param prefix - The catalog name
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   */
  delete: async (
    prefix: string,
    namespace: string[]
  ): Promise<void> => {
    const namespaceStr = encodeNamespace(namespace)
    await apiClient
      .getCatalogClient()
      .delete(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}`
      )
  },
}

