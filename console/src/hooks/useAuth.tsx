import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "sonner"
import { authApi } from "@/api/auth"

interface AuthContextType {
  isAuthenticated: boolean
  login: (clientId: string, clientSecret: string, realm: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem("polaris_access_token")
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  const login = async (clientId: string, clientSecret: string, realm: string) => {
    try {
      // Store realm in localStorage
      if (realm) {
        localStorage.setItem("polaris_realm", realm)
      }
      await authApi.getToken(clientId, clientSecret, realm)
      setIsAuthenticated(true)
    } catch (error) {
      setIsAuthenticated(false)
      throw error
    }
  }

  const logout = () => {
    toast.success("Logged out successfully")
    authApi.logout()
    setIsAuthenticated(false)
    // Clear realm from localStorage on logout
    localStorage.removeItem("polaris_realm")
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

