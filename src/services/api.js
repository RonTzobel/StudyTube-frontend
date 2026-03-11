const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001'
const API = `${BASE_URL}/api/v1`

// Generic request helper — surfaces errors from JSON body if available
async function request(method, path, body = null, isFormData = false) {
  const options = { method, headers: {} }

  if (body && !isFormData) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (body && isFormData) {
    // Let the browser set multipart/form-data boundary automatically
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

  return res.json()
}

// --- Video Upload ---
// POST /api/v1/videos/upload
// Expects: FormData with a "file" field
// Returns: video object including video_id
export function uploadVideo(file) {
  const form = new FormData()
  form.append('file', file)
  return request('POST', '/videos/upload', form, true)
}

// --- Transcription ---
// POST /api/v1/videos/{video_id}/transcribe
// Returns: transcript text / status object
export function transcribeVideo(videoId) {
  return request('POST', `/videos/${videoId}/transcribe`)
}

// --- Get Transcript ---
// GET /api/v1/videos/{video_id}/transcript
export function getTranscript(videoId) {
  return request('GET', `/videos/${videoId}/transcript`)
}

// --- Chunk ---
// POST /api/v1/videos/{video_id}/chunk
export function chunkVideo(videoId) {
  return request('POST', `/videos/${videoId}/chunk`)
}

// --- Get Chunks ---
// GET /api/v1/videos/{video_id}/chunks
export function getChunks(videoId) {
  return request('GET', `/videos/${videoId}/chunks`)
}

// --- Embed ---
// POST /api/v1/videos/{video_id}/embed
export function embedVideo(videoId) {
  return request('POST', `/videos/${videoId}/embed`)
}

// --- Semantic Search ---
// POST /api/v1/videos/{video_id}/search
// Body: { query: string, top_k: number }
export function searchVideo(videoId, query, topK = 3) {
  return request('POST', `/videos/${videoId}/search`, { query, top_k: topK })
}

// --- Ask (RAG) ---
// POST /api/v1/videos/{video_id}/ask
// Body: { question: string, top_k: number }
export function askVideo(videoId, question, topK = 3) {
  return request('POST', `/videos/${videoId}/ask`, { question, top_k: topK })
}
