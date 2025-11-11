import { apiClient } from "../client"
import type {
  Catalog,
  CatalogsResponse,
  CreateCatalogRequest,
  UpdateCatalogRequest,
} from "@/types/api"

export const catalogsApi = {
  list: async (): Promise<Catalog[]> => {
    const response = await apiClient
      .getManagementClient()
      .get<CatalogsResponse>("/catalogs")
    return response.data.catalogs
  },

  get: async (catalogName: string): Promise<Catalog> => {
    const response = await apiClient
      .getManagementClient()
      .get<Catalog>(`/catalogs/${encodeURIComponent(catalogName)}`)
    return response.data
  },

  create: async (request: CreateCatalogRequest): Promise<Catalog> => {
    const response = await apiClient
      .getManagementClient()
      .post<Catalog>("/catalogs", request)
    return response.data
  },

  update: async (
    catalogName: string,
    request: UpdateCatalogRequest
  ): Promise<Catalog> => {
    const response = await apiClient
      .getManagementClient()
      .put<Catalog>(
        `/catalogs/${encodeURIComponent(catalogName)}`,
        request
      )
    return response.data
  },

  delete: async (catalogName: string): Promise<void> => {
    await apiClient
      .getManagementClient()
      .delete(`/catalogs/${encodeURIComponent(catalogName)}`)
  },
}

