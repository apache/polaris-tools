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

import { useQuery } from "@tanstack/react-query"
import { catalogsApi } from "@/api/management/catalogs"
import { principalsApi } from "@/api/management/principals"
import { namespacesApi } from "@/api/catalog/namespaces"
import { tablesApi } from "@/api/catalog/tables"
import { viewsApi } from "@/api/catalog/views"
import { type SearchResultType } from "@/types/search"

export type { SearchResultType }

export interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  sublabel: string
  path: string
}

export interface SearchData {
  results: SearchResult[]
  isLoading: boolean
}

interface NamespaceEntry {
  catalog: string
  namespace: string[]
}

interface ObjectEntry {
  catalog: string
  namespace: string[]
  name: string
}

function encodeNamespace(namespace: string[]): string {
  return namespace.join("\x1F")
}

export function useSearchData(enabled: boolean): SearchData {
  const { data: catalogs = [], isLoading: catalogsLoading } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
    enabled,
    staleTime: 30_000,
  })

  const { data: principals = [], isLoading: principalsLoading } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
    enabled,
    staleTime: 30_000,
  })

  const catalogNames = catalogs.map((c) => c.name).sort()

  const { data: namespacesMap = {}, isLoading: namespacesLoading } = useQuery({
    queryKey: ["search-namespaces", catalogNames],
    queryFn: async () => {
      // This fires one request per catalog. For large installations with many catalogs,
      // namespaces, tables and views this can result in hundreds of parallel requests.
      // TODO: add a cap or pagination strategy to handle large deployments.
      const results = await Promise.allSettled(
        catalogs.map(async (catalog) => {
          const nsList = await namespacesApi.list(catalog.name)
          return { catalog: catalog.name, namespaces: nsList.map((ns) => ns.namespace) }
        })
      )
      const map: Record<string, string[][]> = {}
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map[r.value.catalog] = r.value.namespaces
        }
      })
      return map
    },
    enabled: enabled && catalogs.length > 0,
    staleTime: 30_000,
  })

  const allNamespacePairs: NamespaceEntry[] = Object.entries(namespacesMap).flatMap(
    ([cat, nsList]) => nsList.map((ns) => ({ catalog: cat, namespace: ns }))
  )

  const pairKeys = allNamespacePairs.map((p) => `${p.catalog}/${p.namespace.join(".")}`).sort()

  const { data: tablesData = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["search-tables", pairKeys],
    queryFn: async () => {
      const results = await Promise.allSettled(
        allNamespacePairs.map(async ({ catalog, namespace }) => {
          const tables = await tablesApi.list(catalog, namespace)
          return tables.map(
            (t): ObjectEntry => ({
              catalog,
              namespace: t.namespace || namespace,
              name: t.name,
            })
          )
        })
      )
      return results
        .filter((r): r is PromiseFulfilledResult<ObjectEntry[]> => r.status === "fulfilled")
        .flatMap((r) => r.value)
    },
    enabled: enabled && allNamespacePairs.length > 0,
    staleTime: 30_000,
  })

  const { data: viewsData = [], isLoading: viewsLoading } = useQuery({
    queryKey: ["search-views", pairKeys],
    queryFn: async () => {
      const results = await Promise.allSettled(
        allNamespacePairs.map(async ({ catalog, namespace }) => {
          const views = await viewsApi.list(catalog, namespace)
          return views.map(
            (v): ObjectEntry => ({
              catalog,
              namespace: v.namespace || namespace,
              name: v.name,
            })
          )
        })
      )
      return results
        .filter((r): r is PromiseFulfilledResult<ObjectEntry[]> => r.status === "fulfilled")
        .flatMap((r) => r.value)
    },
    enabled: enabled && allNamespacePairs.length > 0,
    staleTime: 30_000,
  })

  const catalogResults: SearchResult[] = catalogs.map((c) => ({
    id: `catalog:${c.name}`,
    type: "catalog",
    label: c.name,
    sublabel: c.type || "",
    path: `/catalogs/${encodeURIComponent(c.name)}`,
  }))

  // TODO: when individual principal detail pages are added, update this path
  const principalResults: SearchResult[] = principals.map((p) => ({
    id: `principal:${p.name}`,
    type: "principal",
    label: p.name,
    sublabel: p.type || "principal",
    path: `/access-control`,
  }))

  const namespaceResults: SearchResult[] = Object.entries(namespacesMap).flatMap(
    ([catalogName, nsList]) =>
      nsList.map((ns) => ({
        id: `ns:${catalogName}/${ns.join(".")}`,
        type: "namespace" as SearchResultType,
        label: ns.join("."),
        sublabel: catalogName,
        path: `/catalogs/${encodeURIComponent(catalogName)}/namespaces/${encodeURIComponent(encodeNamespace(ns))}`,
      }))
  )

  const tableResults: SearchResult[] = tablesData.map((t) => ({
    id: `table:${t.catalog}/${t.namespace.join(".")}.${t.name}`,
    type: "table",
    label: t.name,
    sublabel: `${t.catalog} / ${t.namespace.join(".")}`,
    path: `/catalogs/${encodeURIComponent(t.catalog)}/namespaces/${encodeURIComponent(encodeNamespace(t.namespace))}/tables/${encodeURIComponent(t.name)}`,
  }))

  const viewResults: SearchResult[] = viewsData.map((v) => ({
    id: `view:${v.catalog}/${v.namespace.join(".")}.${v.name}`,
    type: "view",
    label: v.name,
    sublabel: `${v.catalog} / ${v.namespace.join(".")}`,
    path: `/catalogs/${encodeURIComponent(v.catalog)}/namespaces/${encodeURIComponent(encodeNamespace(v.namespace))}/views/${encodeURIComponent(v.name)}`,
  }))

  const isLoading =
    catalogsLoading || principalsLoading || namespacesLoading || tablesLoading || viewsLoading

  return {
    results: [
      ...catalogResults,
      ...principalResults,
      ...namespaceResults,
      ...tableResults,
      ...viewResults,
    ],
    isLoading,
  }
}
