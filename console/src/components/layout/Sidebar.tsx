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

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Home,
  Link as LinkIcon,
  Database,
  Shield,
  Layers,
  Settings,
  Sun,
  Moon,
  Monitor,
  Menu,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants"
import { useTheme } from "@/hooks/useTheme"
import { getCurrentWorkspace, loadWorkspacesConfig, setCurrentWorkspace } from "@/lib/workspaces"
import { apiClient } from "@/api/client"
import type { Workspace, WorkspacesConfig } from "@/types/workspaces"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const iconMap = {
  Layers,
  Home,
  Link: LinkIcon,
  Database,
  Shield,
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null)
  const [workspacesConfig, setWorkspacesConfig] = useState<WorkspacesConfig | null>(null)

  useEffect(() => {
    const workspace = getCurrentWorkspace()
    setCurrentWorkspaceState(workspace)

    loadWorkspacesConfig().then((config) => {
      setWorkspacesConfig(config)
    })
  }, [])

  const handleWorkspaceChange = (workspace: Workspace) => {
    const hasToken = apiClient.hasToken(workspace.name)

    if (!hasToken) {
      navigate(`/login?workspace=${encodeURIComponent(workspace.name)}`)
    } else {
      setCurrentWorkspace(workspace)
      setCurrentWorkspaceState(workspace)
      window.location.reload()
    }
  }

  const handleManageWorkspaces = () => {
    navigate("/workspaces")
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo and Workspace Dropdown */}
      <header className="h-14 border-b bg-background">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-14 w-full items-center justify-between px-6 hover:bg-accent transition-colors">
              <div className="flex gap-3 min-w-0">
                <img
                  src="/apache-polaris-logo.svg"
                  alt="Apache Polaris Logo"
                  className="h-8 w-8 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    Active workspace
                  </span>
                  <span className="text-sm font-semibold text-foreground truncate">
                    {currentWorkspace?.name || "No workspace"}
                  </span>
                </div>
              </div>
              <Menu className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspacesConfig?.workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.name}
                onClick={() => handleWorkspaceChange(workspace)}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span>{workspace.name}</span>
                  {currentWorkspace?.name === workspace.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleManageWorkspaces} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Manage workspaces</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap]
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Settings Dropdown */}
      <nav className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
      </nav>
    </div>
  )
}
