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

import { useState, useCallback } from "react"

export type RecentItemType = "catalog" | "namespace" | "table" | "view" | "principal"

export interface RecentItem {
  id: string
  type: RecentItemType
  label: string
  sublabel?: string
  path: string
}

const STORAGE_KEY = "polaris-recently-viewed"
const MAX_ITEMS = 8

function loadItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentItem[]) : []
  } catch {
    return []
  }
}

function saveItems(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore storage errors
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(loadItems)

  const trackVisit = useCallback((item: RecentItem) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id)
      const updated = [item, ...filtered].slice(0, MAX_ITEMS)
      saveItems(updated)
      return updated
    })
  }, [])

  const clearAll = useCallback(() => {
    saveItems([])
    setItems([])
  }, [])

  return { items, trackVisit, clearAll }
}
