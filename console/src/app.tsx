import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AuthProvider } from "@/hooks/useAuth"
import { ThemeProvider, useTheme } from "@/hooks/useTheme"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Login } from "@/pages/Login"
import { Home } from "@/pages/Home"
import { Connections } from "@/pages/Connections"
import { Catalogs } from "@/pages/Catalogs"
import { CatalogDetails } from "@/pages/CatalogDetails"
import { NamespaceDetails } from "@/pages/NamespaceDetails"
import { Users } from "@/pages/Users"
import { TableDetails } from "@/pages/TableDetails"

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
                  <Route path="/catalogs/:catalogName/namespaces/:namespace" element={<NamespaceDetails />} />
                  <Route path="/catalogs/:catalogName/namespaces/:namespace/tables/:tableName" element={<TableDetails />} />
                  <Route path="/users" element={<Users />} />
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
