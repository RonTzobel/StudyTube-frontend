const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API = `${BASE_URL}/api/v1`

// Generic request helper — surfaces errors from JSON body if available.
// Returns null for 204 No Content responses.
async function request(method, path, body = null, isFormData = false) {
  const options = { method, headers: {} }

  if (body && !isFormData) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (body && isFormData) {
    // Let the browser set the multipart/form-data boundary automatically
    options.body = body
  }

  const res = await fetch(`${API}${path}`, options)

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      message = err.detail || err.message || JSON.stringify(err)
    } catch (_) {
      // ignore parse errors, keep generic message
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}

// ── Videos ────────────────────────────────────────────────────────────────

// GET /api/v1/videos/  → List[VideoRead]
export function listVideos() {
  return request('GET', '/videos/')
}

// POST /api/v1/videos/upload  (multipart/form-data, field: "file")  → VideoRead
export function uploadVideo(file) {
  const form = new FormData()
  form.append('file', file)
  return request('POST', '/videos/upload', form, true)
}

// POST /api/v1/videos/{id}/transcribe  → TranscriptRead
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
