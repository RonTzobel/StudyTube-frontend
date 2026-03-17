import { createContext, useContext, useEffect, useState } from 'react'
import { authMe } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore token from localStorage on first render
  const [token, setToken]     = useState(() => localStorage.getItem('st_token'))
  const [user, setUser]       = useState(null)
  // loading=true while we verify the stored token on startup
  const [loading, setLoading] = useState(true)

  // On startup: if a token exists in localStorage, verify it with the backend
  // and rehydrate the current user. If it's expired/invalid, clear it.
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    authMe()
      .then(u => setUser(u))
      .catch(() => {
        localStorage.removeItem('st_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // Call after a successful login or register — stores token + user
  function login(newToken, newUser) {
    localStorage.setItem('st_token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  // Call when Google OAuth callback returns a token but we still need to fetch user
  function setTokenOnly(newToken) {
    localStorage.setItem('st_token', newToken)
    setToken(newToken)
  }

  function logout() {
    localStorage.removeItem('st_token')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    setTokenOnly,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
