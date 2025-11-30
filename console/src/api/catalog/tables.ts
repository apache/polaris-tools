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
  Table,
  ListTablesResponse,
  CreateTableRequest,
  CreateGenericTableRequest,
  LoadTableResult,
} from "@/types/api"

/**
 * Encodes a namespace array to URL format.
 * Namespace parts are separated by the unit separator character (0x1F).
 */
function encodeNamespace(namespace: string[]): string {
  return namespace.join("\x1F")
}

export const tablesApi = {
  /**
   * List tables in a namespace.
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
      .get<ListTablesResponse>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/tables`
      )
    return response.data.identifiers
  },

  /**
   * Get table details (LoadTableResult).
   * @param prefix - The catalog name
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   * @param tableName - Table name
   */
  get: async (
    prefix: string,
    namespace: string[],
    tableName: string
  ): Promise<LoadTableResult> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .get<LoadTableResult>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/tables/${encodeURIComponent(tableName)}`
      )
    return response.data
  },

  /**
   * Create a table.
   * @param prefix - The catalog name
   * @param namespace - Namespace array
   * @param request - Table creation request
   */
  create: async (
    prefix: string,
    namespace: string[],
    request: CreateTableRequest
  ): Promise<Table> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getCatalogClient()
      .post<Table>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/tables`,
        request
      )
    return response.data
  },

  /**
   * Delete a table.
   * @param prefix - The catalog name
   * @param namespace - Namespace array
   * @param tableName - Table name
   */
  delete: async (
    prefix: string,
    namespace: string[],
    tableName: string
  ): Promise<void> => {
    const namespaceStr = encodeNamespace(namespace)
    await apiClient
      .getCatalogClient()
      .delete(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/tables/${encodeURIComponent(tableName)}`
      )
  },

  /**
   * Rename a table (same-namespace by default).
   */
  rename: async (
    prefix: string,
    sourceNamespace: string[],
    sourceName: string,
    destinationNamespace: string[],
    destinationName: string
  ): Promise<void> => {
    const payload = {
      source: {
        namespace: sourceNamespace,
        name: sourceName,
      },
      destination: {
        namespace: destinationNamespace,
        name: destinationName,
      },
    }
    await apiClient
      .getCatalogClient()
      .post(
        `/${encodeURIComponent(prefix)}/tables/rename`,
        payload
      )
  },

  /**
   * Update table properties using commit API.
   * Sends set-properties and/or remove-properties updates.
   */
  updateProperties: async (
    prefix: string,
    namespace: string[],
    tableName: string,
    updates: Record<string, string>,
    removals: string[]
  ): Promise<void> => {
    const namespaceStr = encodeNamespace(namespace)
    const body = {
      requirements: [],
      updates: [
        ...(Object.keys(updates || {}).length > 0
          ? [{ action: "set-properties", updates }] as Array<unknown>
          : []),
        ...(removals && removals.length > 0
          ? [{ action: "remove-properties", removals }] as Array<unknown>
          : []),
      ],
    }
    await apiClient
      .getCatalogClient()
      .post(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/tables/${encodeURIComponent(tableName)}`,
        body
      )
  },

  /**
   * List generic tables in a namespace.
   * @param prefix - The catalog name (prefix)
   * @param namespace - Namespace array (e.g., ["accounting", "tax"])
   */
  listGeneric: async (
    prefix: string,
    namespace: string[]
  ): Promise<Array<{ namespace: string[]; name: string; type?: string; createTime?: string }>> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getPolarisClient()
      .get<ListTablesResponse>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/generic-tables`
      )
    const identifiers = response.data.identifiers || []
    return identifiers.map((id) => ({
      ...id,
      type: "Generic",
    }))
  },

  /**
   * Create a generic table.
   * @param prefix - The catalog name
   * @param namespace - Namespace array
   * @param request - Generic table creation request
   */
  createGeneric: async (
    prefix: string,
    namespace: string[],
    request: CreateGenericTableRequest
  ): Promise<unknown> => {
    const namespaceStr = encodeNamespace(namespace)
    const response = await apiClient
      .getPolarisClient()
      .post<unknown>(
        `/${encodeURIComponent(prefix)}/namespaces/${encodeURIComponent(namespaceStr)}/generic-tables`,
        request
      )
    return response.data
  },
}

