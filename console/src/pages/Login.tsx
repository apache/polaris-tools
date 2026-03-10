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
import { useNavigate } from "react-router-dom"
import { Info } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Logo } from "@/components/layout/Logo"
import { Footer } from "@/components/layout/Footer"
import { config } from "@/lib/config"

export function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [scope, setScope] = useState(config.POLARIS_PRINCIPAL_SCOPE)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login, loginWithOIDC } = useAuth()
  const navigate = useNavigate()
  const isOIDCConfigured = !!(
    config.OIDC_ISSUER_URL &&
    config.OIDC_CLIENT_ID &&
    config.OIDC_REDIRECT_URI
  )

  useEffect(() => {
    const authError = sessionStorage.getItem("auth_error")
    if (authError) {
      setError(authError)
      sessionStorage.removeItem("auth_error")
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(username, password, scope)
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

  const handleOIDCLogin = async () => {
    setError("")
    setLoading(true)

    try {
      await loginWithOIDC()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate OIDC login.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Logo clickable={false} />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{config.REALM_HEADER_NAME}:</span>
                    <span className="font-medium">{config.POLARIS_REALM}</span>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Realm Configuration</h4>
                        <p className="text-xs text-muted-foreground">
                          This UI console is configured to connect to a specific Polaris server
                          realm.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Input
                  id="scope"
                  type="text"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  required
                  placeholder="Enter the scope"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              {isOIDCConfigured && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">External IDP</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleOIDCLogin}
                    disabled={loading}
                  >
                    {loading ? "Redirecting..." : "Sign in with OIDC"}
                  </Button>
                </>
              )}
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
