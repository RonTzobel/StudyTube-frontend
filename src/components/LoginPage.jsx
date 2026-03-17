import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authLogin, getGoogleLoginUrl } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const data = await authLogin(email.trim(), password)
      login(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err.message))
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    // Full-page redirect — the backend owns the entire OAuth dance with Google.
    // After it completes, the backend redirects back to /auth/callback?token=<JWT>.
    window.location.href = getGoogleLoginUrl()
  }

  return (
    <div className="auth-page">
      <div className="auth-panel panel">
        <h2>Sign in to StudyTube</h2>
        <p className="panel-subtitle">Continue your AI-powered learning journey.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="input-full"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="input-full"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="msg error">{error}</p>}

          <button type="submit" className="btn primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="btn btn-block btn-google" onClick={handleGoogle} type="button">
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// Map raw backend errors to short human-readable messages
function friendlyAuthError(msg) {
  const m = (msg || '').toLowerCase()
  if (m.includes('incorrect') || m.includes('invalid') || m.includes('401') || m.includes('unauthorized')) {
    return 'Incorrect email or password.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Cannot reach the server. Check your connection.'
  }
  return msg || 'Something went wrong. Please try again.'
}
