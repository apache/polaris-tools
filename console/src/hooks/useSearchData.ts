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

export type SearchResultType = "catalog" | "namespace" | "table" | "view" | "principal"

export interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  sublabel: string
  path: string
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

export function useSearchData(enabled: boolean): SearchResult[] {
  const { data: catalogs = [] } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
    enabled,
    staleTime: 30_000,
  })

  const { data: principals = [] } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
    enabled,
    staleTime: 30_000,
  })

  const catalogNames = catalogs.map((c) => c.name).sort()

  const { data: namespacesMap = {} } = useQuery({
    queryKey: ["search-namespaces", catalogNames],
    queryFn: async () => {
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

  const { data: tablesData = [] } = useQuery({
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

  const { data: viewsData = [] } = useQuery({
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

  return [
    ...catalogResults,
    ...principalResults,
    ...namespaceResults,
    ...tableResults,
    ...viewResults,
  ]
}
