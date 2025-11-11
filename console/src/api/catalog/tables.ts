import { apiClient } from "../client"
import type {
  Table,
  ListTablesResponse,
  CreateTableRequest,
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
}

