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

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Database, Table2, Eye, FolderOpen, User, Clock, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useSearchData, type SearchResult, type SearchResultType } from "@/hooks/useSearchData"
import { useRecentlyViewed, type RecentItem } from "@/hooks/useRecentlyViewed"

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TYPE_ICONS: Record<SearchResultType | "recent", React.ReactNode> = {
  catalog: <Database className="h-4 w-4 shrink-0 text-muted-foreground" />,
  namespace: <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />,
  table: <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />,
  view: <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />,
  principal: <User className="h-4 w-4 shrink-0 text-muted-foreground" />,
  recent: <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />,
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  catalog: "Catalog",
  namespace: "Namespace",
  table: "Table",
  view: "View",
  principal: "Principal",
}

const TYPE_ORDER: SearchResultType[] = ["catalog", "namespace", "table", "view", "principal"]

/**
 * Word-prefix match: the query must match the start of at least one
 * word/segment in the text (split on spaces, underscores, hyphens, dots, slashes).
 * "on"  → matches "online_store"   ✓  (word "online" starts with "on")
 * "sto" → matches "online_store"   ✓  (word "store" starts with "sto")
 * "a"   → does NOT match "online_store" ✗  (no word starts with "a")
 * "a"   → matches "accounting"     ✓  (word "accounting" starts with "a")
 */
function matchesQuery(text: string, query: string): boolean {
  const q = query.toLowerCase()
  return text
    .toLowerCase()
    .split(/[\s_\-./]+/)
    .some((word) => word.startsWith(q))
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { items: recentItems, trackVisit, clearAll } = useRecentlyViewed()
  const { results: allResults, isLoading } = useSearchData(open)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const filtered =
    query.trim().length > 0
      ? allResults.filter((r) => matchesQuery(r.label, query) || matchesQuery(r.sublabel, query))
      : []

  const grouped = filtered.reduce<Partial<Record<SearchResultType, SearchResult[]>>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type]!.push(r)
    return acc
  }, {})

  const handleSelect = (item: SearchResult | RecentItem) => {
    trackVisit({
      id: item.id,
      type: item.type,
      label: item.label,
      sublabel: item.sublabel,
      path: item.path,
    })
    navigate(item.path)
    onOpenChange(false)
  }

  const hasResults = filtered.length > 0
  const showRecent = query.trim().length === 0 && recentItems.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-separator]]:mx-2"
        >
          <CommandInput
            placeholder="Search catalogs, namespaces, tables, views, principals…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasResults && !showRecent && (
              <CommandEmpty>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </span>
                ) : query.trim().length > 0 ? (
                  "No results found."
                ) : (
                  "Start typing to search…"
                )}
              </CommandEmpty>
            )}

            {showRecent && (
              <CommandGroup
                heading={
                  <span className="flex items-center justify-between">
                    <span>Recently Viewed</span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </span>
                }
              >
                {recentItems.map((item: RecentItem) => (
                  <CommandItem
                    key={item.id}
                    value={`recent-${item.id}`}
                    onSelect={() => handleSelect(item)}
                  >
                    {TYPE_ICONS.recent}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="truncate text-xs text-muted-foreground max-w-[180px]">
                        {item.sublabel}
                      </span>
                    )}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(() => {
              let firstGroup = true
              return TYPE_ORDER.map((type) => {
                const results = grouped[type]
                if (!results?.length) return null
                const showSep = !firstGroup
                firstGroup = false
                return (
                  <div key={type}>
                    {showSep && <CommandSeparator />}
                    <CommandGroup heading={`${TYPE_LABELS[type]}s`}>
                      {results.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleSelect(result)}
                        >
                          {TYPE_ICONS[result.type]}
                          <span className="flex-1 truncate">{result.label}</span>
                          {result.sublabel && (
                            <span className="truncate text-xs text-muted-foreground max-w-[200px]">
                              {result.sublabel}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                )
              })
            })()}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
