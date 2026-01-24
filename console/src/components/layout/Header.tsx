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

import {useState, useEffect} from "react"
import {LogOut} from "lucide-react"
import {useAuth} from "@/hooks/useAuth"
import {useCurrentUser} from "@/hooks/useCurrentUser"
import {getCurrentWorkspace} from "@/lib/workspaces"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Logo} from "@/components/layout/Logo.tsx";

export function Header() {
  const {logout} = useAuth()
  const {principal, principalRoles, loading} = useCurrentUser()
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    name: string;
    realm: string;
    header: string
  } | null>(null)

  useEffect(() => {
    const workspace = getCurrentWorkspace()
    if (workspace) {
      setWorkspaceInfo({
        name: workspace.name,
        header: workspace["realm-header"] || "Polaris-Realm",
        realm: workspace.realm
      })
    }
  }, [])

  // Get display name and role
  const displayName =
    principal?.name ||
    principal?.properties?.displayName ||
    principal?.properties?.name ||
    "User"
  const primaryRole =
    principalRoles.length > 0
      ? principalRoles[0].name
      : principal?.properties?.role ||
      principal?.properties?.principalRole ||
      "USER"

  // Get initials for avatar
  const getInitials = (name: string): string => {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const initials = getInitials(displayName)

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <Logo clickable={false}/>
      </div>

      {/* Workspace and Realm Info - Right Side */}
      <div className="flex items-center gap-4">
        {workspaceInfo && (
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Workspace:</span>{" "}
              <span className="font-semibold text-foreground">{workspaceInfo.name}</span>
            </div>
            <div className="h-4 w-px bg-border"/>
            <div className="text-sm">
              <span className="text-muted-foreground">{workspaceInfo.header}:</span>{" "}
              <span className="font-semibold text-foreground">{workspaceInfo.realm}</span>
            </div>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-56">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {loading ? "..." : initials}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">
                  {loading ? "Loading..." : displayName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {loading ? "..." : primaryRole}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={logout}
                              className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4"/>
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

