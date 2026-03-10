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

import { LogOut, ChevronDown, Sun, Moon, Monitor } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useTheme } from "@/hooks/useTheme"
import { config } from "@/lib/config"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function Header() {
  const { logout } = useAuth()
  const { principal, principalRoles, loading } = useCurrentUser()
  const { theme, setTheme } = useTheme()

  // Get display name and role
  const displayName =
    principal?.name || principal?.properties?.displayName || principal?.properties?.name || "User"
  const primaryRole =
    principalRoles.length > 0
      ? principalRoles[0].name
      : principal?.properties?.role || principal?.properties?.principalRole || "USER"

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
      {/* Theme Toggle - Left Side */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            {theme === "light" ? (
              <Sun className="h-5 w-5" />
            ) : theme === "dark" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as "light" | "dark" | "auto")}
          >
            <DropdownMenuRadioItem value="light">
              <Sun className="mr-2 h-4 w-4" />
              <span>Light</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="auto">
              <Monitor className="mr-2 h-4 w-4" />
              <span>Auto</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Profile with Dropdown - Right Side */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {loading ? "..." : initials}
            </div>
            <div className="min-w-0 text-left">
              <div className="text-sm font-medium text-foreground truncate">
                {loading ? "Loading..." : displayName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {loading ? "..." : primaryRole}
              </div>
              <div className="text-xs text-muted-foreground/70 truncate">
                {config.POLARIS_REALM}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
