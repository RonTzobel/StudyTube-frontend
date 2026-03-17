import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import VideoList    from './components/VideoList'
import VideoDetail  from './components/VideoDetail'
import ChatView     from './components/ChatView'
import LoginPage    from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import AuthCallback from './components/AuthCallback'
import './App.css'

// Redirects unauthenticated users to /login.
// Shows a blank screen (not a flash of content) while restoring session on startup.
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="auth-loading">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// The inner shell — needs to be inside BrowserRouter to use useNavigate,
// and inside AuthProvider to use useAuth.
function AppShell() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="app-header-top">
          <Link to="/" className="app-logo" style={{ textDecoration: 'none' }}>
            StudyTube
          </Link>
          {isAuthenticated && (
            <div className="header-user">
              <span className="header-username">{user?.full_name || user?.email}</span>
              <button className="btn ghost small" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
        <p className="app-tagline">Upload a lecture and chat with it.</p>
      </header>

      <main className="app-main">
        <Routes>
          {/* Public */}
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/register"      element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected */}
          <Route path="/"              element={<ProtectedRoute><VideoList /></ProtectedRoute>} />
          <Route path="/videos/:id"    element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
          <Route path="/chat/:sessionId" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
        </Routes>
      </main>

      <footer className="app-footer">
        <span>StudyTube &mdash; backend at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}
