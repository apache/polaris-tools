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

