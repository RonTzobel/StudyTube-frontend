import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authMe } from '../services/api'
import { useAuth } from '../context/AuthContext'

/**
 * Handles the redirect back from Google OAuth.
 *
 * Flow:
 *   1. User clicks "Continue with Google" on LoginPage
 *   2. Browser navigates to backend /auth/google/login
 *   3. Backend handles the full OAuth dance with Google
 *   4. Backend redirects browser here: /auth/callback?token=<backend_JWT>
 *   5. This component reads ?token=, stores it, fetches /auth/me, then goes to /
 *
 * The stored token is the backend's own JWT — identical to a regular login token.
 * Google tokens never touch the frontend.
 */
export default function AuthCallback() {
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const { login }        = useAuth()
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setError('No token received from Google login. Please try again.')
      return
    }

    // Temporarily write the token to localStorage so the authMe request
    // picks it up via the Authorization header in api.js.
    localStorage.setItem('st_token', token)

    authMe()
      .then(user => {
        // login() officially stores token + user in AuthContext state
        login(token, user)
        navigate('/', { replace: true })
      })
      .catch(err => {
        localStorage.removeItem('st_token')
        setError(err.message || 'Google sign-in failed. Please try again.')
      })
  }, [])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-panel panel">
          <h2>Sign-in failed</h2>
          <p className="msg error" style={{ marginTop: 12 }}>{error}</p>
          <Link to="/login" className="btn primary btn-block" style={{ marginTop: 16, textDecoration: 'none', textAlign: 'center' }}>
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-panel panel">
        <p className="msg hint" style={{ textAlign: 'center' }}>
          Completing Google sign-in…
        </p>
      </div>
    </div>
  )
}
