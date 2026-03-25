import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authRegister } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Your password is too long. Please choose a shorter password.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await authRegister(fullName.trim(), email.trim(), password)
      login(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyRegisterError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel panel">
        <h2>Create your account</h2>
        <p className="panel-subtitle">Start learning smarter with AI-powered tutor chat.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              className="input-full"
              placeholder="Jane Smith"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className="input-full"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="input-full"
              placeholder="Choose a strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="input-hint">Use at least 8 characters. Avoid emoji or very long passwords.</p>
          </div>

          {error && <p className="msg error">{error}</p>}

          <button type="submit" className="btn primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

function friendlyRegisterError(msg) {
  const m = (msg || '').toLowerCase()
  if (m.includes('already') || m.includes('exists') || m.includes('duplicate')) {
    return 'An account with this email already exists.'
  }
  if (m.includes('password') || m.includes('value_error')) {
    return 'Your password is too long or contains unsupported characters. Please choose a different password.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Cannot reach the server. Check your connection.'
  }
  return msg || 'Something went wrong. Please try again.'
}
