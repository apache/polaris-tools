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

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AuthProvider } from "@/hooks/useAuth"
import { ThemeProvider, useTheme } from "@/hooks/useTheme"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Login } from "@/pages/Login"
import { AuthCallback } from "@/pages/AuthCallback"
import { Home } from "@/pages/Home"
import { Connections } from "@/pages/Connections"
import { Catalogs } from "@/pages/Catalogs"
import { CatalogDetails } from "@/pages/CatalogDetails"
import { NamespaceDetails } from "@/pages/NamespaceDetails"
import { AccessControl } from "@/pages/AccessControl"
import { TableDetails } from "@/pages/TableDetails"
import { ViewDetails } from "@/pages/ViewDetails"

function ThemedToaster() {
  const { effectiveTheme } = useTheme()
  return <Toaster position="top-right" richColors theme={effectiveTheme} />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Home />} />
                  <Route path="/connections" element={<Connections />} />
                  <Route path="/catalogs" element={<Catalogs />} />
                  <Route path="/catalogs/:catalogName" element={<CatalogDetails />} />
                  <Route
                    path="/catalogs/:catalogName/namespaces/:namespace"
                    element={<NamespaceDetails />}
                  />
                  <Route
                    path="/catalogs/:catalogName/namespaces/:namespace/tables/:tableName"
                    element={<TableDetails />}
                  />
                  <Route
                    path="/catalogs/:catalogName/namespaces/:namespace/views/:viewName"
                    element={<ViewDetails />}
                  />
                  <Route path="/access-control" element={<AccessControl />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <ThemedToaster />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
