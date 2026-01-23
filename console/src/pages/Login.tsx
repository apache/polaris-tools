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
import {useNavigate, Link} from "react-router-dom"
import {useAuth} from "@/hooks/useAuth"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Card, CardContent, CardHeader} from "@/components/ui/card"
import {Logo} from "@/components/layout/Logo"
import {Footer} from "@/components/layout/Footer"
import {WorkspaceSelector} from "@/components/workspace/WorkspaceSelector"
import {AuthProviderSelector} from "@/components/workspace/AuthProviderSelector"
import {loadWorkspacesConfig, getDefaultWorkspace} from "@/lib/workspaces"
import type {Workspace, AuthConfig, WorkspacesConfig} from "@/types/workspaces"
import {Settings} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip.tsx";

export function Login() {
  const [workspacesConfig, setWorkspacesConfig] = useState<WorkspacesConfig | null>(null)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedAuthProvider, setSelectedAuthProvider] = useState<AuthConfig | null>(null)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const {login} = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadWorkspacesConfig().then(config => {
      setWorkspacesConfig(config)
      const defaultWs = getDefaultWorkspace(config)
      setSelectedWorkspace(defaultWs)
      if (defaultWs.auth.length > 0) {
        setSelectedAuthProvider(defaultWs.auth[0])
      }
    })
  }, [])

  const handleWorkspaceChange = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    if (workspace.auth.length > 0) {
      setSelectedAuthProvider(workspace.auth[0])
    } else {
      setSelectedAuthProvider(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!selectedWorkspace || !selectedAuthProvider) {
      setError("Please select a workspace and authentication method")
      setLoading(false)
      return
    }

    try {
      await login(
        clientId,
        clientSecret,
        selectedAuthProvider.scope,
        selectedWorkspace.realm,
        selectedWorkspace
      )
      navigate("/")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to authenticate. Please check your credentials."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Logo clickable={false}/>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  placeholder="Enter your client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                  placeholder="Enter your client secret"
                />
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              {workspacesConfig && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t"/>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Workspace
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <div className="space-y-2">
                      <WorkspaceSelector
                        workspaces={workspacesConfig.workspaces}
                        selectedWorkspace={selectedWorkspace}
                        onSelectWorkspace={handleWorkspaceChange}
                      />
                    </div>
                    <div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to="/workspaces">
                              <Button variant="outline" size="icon" type="button">
                                <Settings className="h-4 w-4"/>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Configure workspaces
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {selectedWorkspace && (
                    <AuthProviderSelector
                      authProviders={selectedWorkspace.auth}
                      selectedProvider={selectedAuthProvider}
                      onSelectProvider={setSelectedAuthProvider}
                    />
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer/>
    </div>
  )
}
