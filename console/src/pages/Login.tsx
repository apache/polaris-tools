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
import {Settings, ExternalLink, AlertTriangle} from "lucide-react"
import {AuthProviderType} from "@/types/workspaces"
import {toast} from "sonner"

export function Login() {
  const [workspacesConfig, setWorkspacesConfig] = useState<WorkspacesConfig | null>(null)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedAuthProvider, setSelectedAuthProvider] = useState<AuthConfig | null>(null)
  const [principalId, setPrincipalId] = useState("")
  const [principalPassword, setPrincipalPassword] = useState("")
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
    setPrincipalId("")
    setPrincipalPassword("")
    setError("")
  }

  const handleAuthProviderChange = (provider: AuthConfig) => {
    setSelectedAuthProvider(provider)
    setPrincipalId("")
    setPrincipalPassword("")
    setError("")
  }

  const handleOIDCLogin = () => {
    if (!selectedAuthProvider || selectedAuthProvider.type !== AuthProviderType.OIDC) {
      return
    }
    toast.warning("OIDC authentication is not yet implemented", {
      description: "This feature will be available in the next release. Please use Internal authentication for now.",
      duration: 5000,
    })
  }

  const handleInternalLogin = async (e: React.FormEvent) => {
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
        principalId,
        principalPassword,
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
            {workspacesConfig && (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div className="space-y-2">
                    <WorkspaceSelector
                      workspaces={workspacesConfig.workspaces}
                      selectedWorkspace={selectedWorkspace}
                      onSelectWorkspace={handleWorkspaceChange}
                    />
                  </div>
                  <Link to="/workspaces/config">
                    <Button variant="outline" size="icon" type="button">
                      <Settings className="h-4 w-4"/>
                    </Button>
                  </Link>
                </div>

                {selectedWorkspace && (
                  <div className="text-sm text-muted-foreground">
                    {selectedWorkspace["realm-header"]}: {selectedWorkspace.realm}
                  </div>
                )}

                {selectedWorkspace && selectedWorkspace.auth.length > 0 && (
                  <AuthProviderSelector
                    authProviders={selectedWorkspace.auth}
                    selectedProvider={selectedAuthProvider}
                    onSelectProvider={handleAuthProviderChange}
                  />
                )}

                {selectedAuthProvider && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t"/>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Authentication
                        </span>
                      </div>
                    </div>

                    {selectedAuthProvider.type === AuthProviderType.INTERNAL ? (
                      <form onSubmit={handleInternalLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="principalId">Principal</Label>
                          <Input
                            id="principalId"
                            type="text"
                            value={principalId}
                            onChange={(e) => setPrincipalId(e.target.value)}
                            required
                            placeholder="Principal Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="principalPassword">Principal Password</Label>
                          <Input
                            id="principalPassword"
                            type="password"
                            value={principalPassword}
                            onChange={(e) => setPrincipalPassword(e.target.value)}
                            required
                            placeholder="Password"
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
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-600 dark:text-yellow-500">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0"/>
                            <div>
                              <div className="font-medium">OIDC Not Yet Implemented</div>
                              <div className="text-xs mt-1">
                                This feature will be available in the next release. Please use Internal authentication for now.
                              </div>
                              <div className="text-xs mt-2">
                                Follow{" "}
                                <a
                                  href="https://github.com/apache/polaris-tools/issues/125"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-yellow-700 dark:hover:text-yellow-400"
                                >
                                  apache/polaris-tools/issue #125
                                </a>
                                {" "}for updates.
                              </div>
                            </div>
                          </div>
                        </div>
                        {error && (
                          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleOIDCLogin}
                          disabled
                        >
                          <ExternalLink className="mr-2 h-4 w-4"/>
                          Sign in with OIDC
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer/>
    </div>
  )
}
