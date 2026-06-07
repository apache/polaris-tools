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

import { useEffect, useState, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Logo } from "@/components/layout/Logo"
import { Footer } from "@/components/layout/Footer"
import { Loader2 } from "lucide-react"

export function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { completeOIDCLogin } = useAuth()
  const [error, setError] = useState<string>("")
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) {
      return
    }

    const handleCallback = async () => {
      const code = searchParams.get("code")
      const state = searchParams.get("state")
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (errorParam) {
        setError(errorDescription || errorParam)
        setTimeout(() => navigate("/login"), 3000)
        return
      }

      if (!code || !state) {
        setError("Missing authorization code or state parameter")
        setTimeout(() => navigate("/login"), 3000)
        return
      }

      hasProcessed.current = true

      try {
        await completeOIDCLogin(code, state)
        navigate("/")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Authentication failed"
        setError(errorMessage)
        sessionStorage.setItem("auth_error", errorMessage)
        setTimeout(() => navigate("/login"), 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate, completeOIDCLogin])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Logo clickable={false} />
            </div>
          </CardHeader>
          <CardContent className="text-center">
            {error ? (
              <div className="space-y-4">
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
                <p className="text-sm text-muted-foreground">Redirecting to login...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Completing authentication...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
