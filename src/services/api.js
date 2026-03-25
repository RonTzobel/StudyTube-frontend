const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API = `${BASE_URL}/v1`

// Generic request helper — surfaces errors from JSON body if available.
// Returns null for 204 No Content responses.
// Automatically attaches the stored JWT as Authorization: Bearer <token>.
async function request(method, path, body = null, isFormData = false) {
  const options = { method, headers: {} }

  // Attach JWT if present — set by AuthContext after login / register / Google OAuth
  const token = localStorage.getItem('st_token')
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`
  }

  if (body && !isFormData) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (body && isFormData) {
    // Let the browser set the multipart/form-data boundary automatically
    options.body = body
  }

  const res = await fetch(`${API}${path}`, options)

  if (!res.ok) {
    // Central 401 handler: token is missing, expired, or invalid.
    // Clear local storage and hard-redirect to /login so the user can re-authenticate.
    // We use window.location.href because api.js has no access to React Router or
    // AuthContext — this is the cleanest decoupled approach.
    if (res.status === 401) {
      localStorage.removeItem('st_token')
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }

    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      if (Array.isArray(err.detail)) {
        // FastAPI/Pydantic 422 validation errors: [{ loc, msg, type }, ...]
        // Join the human-readable msg fields so callers get a plain string.
        message = err.detail.map(d => d.msg).filter(Boolean).join(' ') || JSON.stringify(err)
      } else {
        message = err.detail || err.message || JSON.stringify(err)
      }
    } catch (_) {
      // ignore parse errors, keep generic message
    }
    throw new Error(message)
  }

  if (res.status === 204) return null

  // 202 Accepted — backend started a background job; body may or may not be present
  if (res.status === 202) {
    const text = await res.text()
    if (!text.trim()) return null
    try { return JSON.parse(text) } catch (_) { return null }
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────

// POST /api/v1/auth/login  body: { email, password }
// → { access_token: string, token_type: "bearer", user: {...} }
export function authLogin(email, password) {
  return request('POST', '/auth/login', { email, password })
}

// POST /api/v1/auth/register  body: { full_name, email, password }
// → { access_token: string, token_type: "bearer", user: {...} }
export function authRegister(fullName, email, password) {
  return request('POST', '/auth/register', { full_name: fullName, email, password })
}

// GET /api/v1/auth/me  → user object (requires Authorization header)
export function authMe() {
  return request('GET', '/auth/me')
}

// Google OAuth entry point — NOT a fetch call.
// Returns the URL the browser should be sent to (full path including /api/v1).
// The backend handles the full Google OAuth dance, then redirects back to
// /auth/callback?token=<backend_JWT> so both auth paths end with the same token.
export function getGoogleLoginUrl() {
  return `${API}/auth/google/login`
}

// ── Videos ────────────────────────────────────────────────────────────────

// GET /api/v1/videos/  → List[VideoRead]
export function listVideos() {
  return request('GET', '/videos/')
}

// GET /api/v1/videos/{id}/status  → VideoRead (used for polling; the bare /{id} route is DELETE-only)
export function getVideo(videoId) {
  return request('GET', `/videos/${videoId}/status`)
}

// POST /api/v1/videos/upload  (multipart/form-data, field: "file")  → VideoRead
export function uploadVideo(file) {
  const form = new FormData()
  form.append('file', file)
  return request('POST', '/videos/upload', form, true)
}

// POST /api/v1/videos/{id}/transcribe  → 202 Accepted (background job started)
// Poll GET /api/v1/videos/{id} until status === 'done' or 'failed'.
export function transcribeVideo(videoId) {
  return request('POST', `/videos/${videoId}/transcribe`)
}

// GET /api/v1/videos/{id}/transcript  → TranscriptRead
export function getTranscript(videoId) {
  return request('GET', `/videos/${videoId}/transcript`)
}

// POST /api/v1/videos/{id}/chunk  → List[ChunkRead]
export function chunkVideo(videoId) {
  return request('POST', `/videos/${videoId}/chunk`)
}

// GET /api/v1/videos/{id}/chunks  → List[ChunkRead]
export function getChunks(videoId) {
  return request('GET', `/videos/${videoId}/chunks`)
}

// POST /api/v1/videos/{id}/embed  → List[ChunkRead]
export function embedVideo(videoId) {
  return request('POST', `/videos/${videoId}/embed`)
}

// DELETE /api/v1/videos/{id}  → 204 No Content
export function deleteVideo(videoId) {
  return request('DELETE', `/videos/${videoId}`)
}

// POST /api/v1/videos/{id}/search  body: { query, top_k }  → List[RetrievedChunkRead]
export function searchVideo(videoId, query, topK = 3) {
  return request('POST', `/videos/${videoId}/search`, { query, top_k: topK })
}

// POST /api/v1/videos/{id}/ask  body: { question, top_k }  → AskResponse
export function askVideo(videoId, question, topK = 3) {
  return request('POST', `/videos/${videoId}/ask`, { question, top_k: topK })
}

// ── Tutor ─────────────────────────────────────────────────────────────────

// POST /api/v1/tutor/videos/{id}/summary  → StudySummaryResponse
export function getSummary(videoId) {
  return request('POST', `/tutor/videos/${videoId}/summary`)
}

// POST /api/v1/tutor/videos/{id}/explain  body: { question, top_k? }  → ExplainResponse
export function explainVideo(videoId, question, topK = 5) {
  return request('POST', `/tutor/videos/${videoId}/explain`, { question, top_k: topK })
}

// POST /api/v1/tutor/videos/{id}/quiz  body: { num_questions? }  → StudyQuizResponse
export function quizVideo(videoId, numQuestions = 5) {
  return request('POST', `/tutor/videos/${videoId}/quiz`, { num_questions: numQuestions })
}

// ── Chat ──────────────────────────────────────────────────────────────────

// POST /api/v1/chat/sessions  body: { video_id, title? }  → ChatSessionResponse (201)
export function createChatSession(videoId, title = null) {
  const body = { video_id: videoId }
  if (title) body.title = title
  return request('POST', '/chat/sessions', body)
}

// GET /api/v1/chat/sessions  → List[ChatSessionResponse]
export function getChatSessions() {
  return request('GET', '/chat/sessions')
}

// GET /api/v1/chat/sessions/{id}  → ChatSessionResponse
export function getChatSession(sessionId) {
  return request('GET', `/chat/sessions/${sessionId}`)
}

// GET /api/v1/chat/sessions/{id}/messages  → List[ChatMessageResponse]
export function getChatMessages(sessionId) {
  return request('GET', `/chat/sessions/${sessionId}/messages`)
}

// POST /api/v1/chat/sessions/{id}/messages  body: { message, question_mode }  → SendMessageResponse
export function sendChatMessage(sessionId, message, questionMode = 'lecture') {
  return request('POST', `/chat/sessions/${sessionId}/messages`, {
    message,
    question_mode: questionMode,
  })
}

// DELETE /api/v1/chat/sessions/{id}  → 204 No Content
export function deleteChatSession(sessionId) {
  return request('DELETE', `/chat/sessions/${sessionId}`)
}
