import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listVideos, getVideo, uploadVideo, transcribeVideo, chunkVideo, embedVideo, deleteVideo } from '../services/api'
import UploadPanel from './UploadPanel'
import ProcessingStatus from './ProcessingStatus'
import ConfirmModal from './ConfirmModal'

const FAST_POLL_MS     = 3_000          // interval during first 10 min
const SLOW_POLL_MS     = 30_000         // interval after 10 min
const SLOW_AFTER_MS    = 10 * 60 * 1000 // switch to slow polling after this
const GIVE_UP_AFTER_MS = 60 * 60 * 1000 // stop polling entirely after this
const POLL_INTERVAL_MS = 5000           // background card-list poll interval (ms)

// Returned (never thrown) when 1 hour passes and the backend has not yet
// reported done or failed. This is NOT a failure — the job may still be running.
const POLL_GAVE_UP = Symbol('poll-gave-up')

// Resolves with a VideoRead on success.
// Returns POLL_GAVE_UP if the 1-hour window expires while backend is still 'processing'.
// Throws only on genuine backend failure or network errors.
async function pollUntilReady(videoId, signal, onLongRunning) {
  const start = Date.now()
  let slowPhaseNotified = false

  while (true) {
    const elapsed  = Date.now() - start

    // 1-hour hard ceiling: return a sentinel instead of throwing
    if (elapsed >= GIVE_UP_AFTER_MS) return POLL_GAVE_UP

    const interval = elapsed < SLOW_AFTER_MS ? FAST_POLL_MS : SLOW_POLL_MS
    await new Promise(r => setTimeout(r, interval))
    if (signal?.aborted) throw new Error('Cancelled')

    const vid = await getVideo(videoId)
    if (vid.status === 'done' || vid.status === 'ready') return vid
    if (vid.status === 'failed') throw new Error('Transcription failed on the server. Please try again.')

    // Transition to slow phase: notify once so the UI can update its message
    if (!slowPhaseNotified && elapsed >= SLOW_AFTER_MS) {
      slowPhaseNotified = true
      onLongRunning?.()
    }
  }
}

function statusLabel(status) {
  switch (status) {
    case 'ready':       return 'Ready'
    case 'pending':
    case 'uploaded':    return 'Uploaded'
    case 'processing':  return 'Processing…'
    case 'done':        return 'Transcribed'
    case 'failed':      return 'Failed'
    default:            return status || 'Unknown'
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'ready':       return 'badge badge--success'
    case 'done':        return 'badge badge--warn'
    case 'processing':  return 'badge badge--warn'
    case 'failed':      return 'badge badge--error'
    default:            return 'badge badge--muted'
  }
}

export default function VideoList() {
  const navigate = useNavigate()
  const [videos, setVideos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [deleteError, setDeleteError]   = useState(null)
  const [confirmVideo, setConfirmVideo] = useState(null)

  // Upload pipeline state
  const [phase, setPhase]               = useState('idle')
  const [uploadError, setUploadError]   = useState(null)
  const [uploadedVideo, setUploadedVideo] = useState(null)

  // Ref for cancelling in-flight polling when component unmounts
  const abortRef = useRef(null)
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort() }, [])

  async function fetchVideos() {
    setLoading(true)
    setFetchError(null)
    try {
      const data = await listVideos()
      setVideos(Array.isArray(data) ? data : [])
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVideos() }, [])

  // Refresh the list once the upload pipeline finishes
  useEffect(() => {
    if (phase === 'ready') fetchVideos()
  }, [phase])

  // Auto-poll any videos that are already in 'processing' state
  // (handles page refresh mid-transcription)
  const hasProcessing = videos.some(v => v.status === 'processing')
  useEffect(() => {
    if (!hasProcessing) return
    let live = true

    async function tick() {
      if (!live) return
      try {
        const all = await listVideos()
        if (!live) return
        setVideos(Array.isArray(all) ? all : [])
        if (live && (Array.isArray(all) ? all : []).some(v => v.status === 'processing')) {
          setTimeout(tick, POLL_INTERVAL_MS)
        }
      } catch (_) {
        // non-fatal — stop polling silently on error
      }
    }

    setTimeout(tick, POLL_INTERVAL_MS)
    return () => { live = false }
  }, [hasProcessing])

  // Runs chunk + embed after transcription is confirmed done.
  async function runPostTranscript(id, signal) {
    setPhase('chunking')
    await chunkVideo(id)
    if (signal?.aborted) throw new Error('Cancelled')
    setPhase('embedding')
    await embedVideo(id)
    setPhase('ready')
  }

  async function handleFileSelected(file) {
    setUploadedVideo(null)
    setUploadError(null)
    setPhase('uploading')

    // Cancel any previous in-flight polling
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const data = await uploadVideo(file)
      const id = data?.id ?? data?.video_id
      setUploadedVideo(data)

      // Start transcription — backend returns 202 immediately
      setPhase('transcribing')
      await transcribeVideo(id)

      // Poll until done; switch to slow poll + neutral UI after 10 min
      const result = await pollUntilReady(id, controller.signal, () => setPhase('waiting'))

      if (result === POLL_GAVE_UP) {
        // Backend has not failed — job is still running. Show "stalled" state,
        // not an error. The user can manually check back or refresh.
        setPhase('stalled')
        return
      }

      // result is a VideoRead with status === 'done'
      await runPostTranscript(id, controller.signal)
    } catch (err) {
      if (err.message === 'Cancelled') return // component unmounted — ignore
      setUploadError(err.message)
      setPhase('error')
    }
  }

  // Called from the 'stalled' UI: check current video status and resume or report.
  async function handleCheckStalled() {
    const id = uploadedVideo?.id ?? uploadedVideo?.video_id
    if (!id) return handleReset()

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const vid = await getVideo(id)

      if (vid.status === 'failed') {
        setUploadError('Transcription failed on the server. Please try again.')
        setPhase('error')
      } else if (vid.status === 'done') {
        // Transcription finished while we weren't watching — continue pipeline
        await runPostTranscript(id, controller.signal)
      } else {
        // Still processing — restart slow polling loop
        setPhase('waiting')
        const result = await pollUntilReady(id, controller.signal, () => {})
        if (result === POLL_GAVE_UP) {
          setPhase('stalled')
        } else {
          await runPostTranscript(id, controller.signal)
        }
      }
    } catch (err) {
      if (err.message === 'Cancelled') return
      setUploadError(err.message)
      setPhase('error')
    }
  }

  function handleReset() {
    if (abortRef.current) abortRef.current.abort()
    setPhase('idle')
    setUploadError(null)
    setUploadedVideo(null)
  }

  function handleDelete(video) {
    setDeleteError(null)
    setConfirmVideo(video)
  }

  async function handleConfirmDelete() {
    if (!confirmVideo) return
    setDeletingId(confirmVideo.id)
    setDeleteError(null)
    try {
      await deleteVideo(confirmVideo.id)
      setVideos(prev => prev.filter(v => v.id !== confirmVideo.id))
      setConfirmVideo(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleCancelDelete() {
    if (deletingId) return
    setConfirmVideo(null)
    setDeleteError(null)
  }

  return (
    <div>
      <ConfirmModal
        isOpen={confirmVideo !== null}
        title="Delete video?"
        message="Are you sure you want to delete this video? This action cannot be undone."
        itemName={confirmVideo?.title || 'Untitled'}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deletingId === confirmVideo?.id}
        danger
        error={deleteError}
      />

      {phase === 'idle' ? (
        <UploadPanel onFileSelected={handleFileSelected} />
      ) : (
        <ProcessingStatus
          phase={phase}
          error={uploadError}
          videoName={uploadedVideo?.title ?? uploadedVideo?.filename ?? null}
          onReset={handleReset}
          onRefresh={handleCheckStalled}
        />
      )}

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-title-row">
          <h2>Your Videos</h2>
          <button className="btn small ghost" onClick={fetchVideos} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {fetchError && <p className="msg error">{fetchError}</p>}

        {!loading && !fetchError && videos.length === 0 && (
          <p className="msg hint">No videos yet. Upload one above to get started.</p>
        )}

        {videos.length > 0 && (
          <div className="video-grid">
            {videos.map(v => (
              <div key={v.id} className="video-card">
                <div className="video-card-top">
                  <span className="video-card-title">{v.title || 'Untitled'}</span>
                  <span className={statusBadgeClass(v.status)}>{statusLabel(v.status)}</span>
                </div>
                <div className="video-card-meta">
                  {new Date(v.created_at).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn small primary"
                    onClick={() => navigate(`/videos/${v.id}`, { state: { video: v } })}
                  >
                    View
                  </button>
                  <button
                    className="btn small danger"
                    onClick={() => handleDelete(v)}
                    disabled={deletingId === v.id}
                  >
                    {deletingId === v.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
