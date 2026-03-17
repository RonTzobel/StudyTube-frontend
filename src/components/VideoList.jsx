import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listVideos, uploadVideo, transcribeVideo, chunkVideo, embedVideo, deleteVideo } from '../services/api'
import UploadPanel from './UploadPanel'
import ProcessingStatus from './ProcessingStatus'

function statusLabel(status) {
  switch (status) {
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
    case 'done':        return 'badge badge--success'
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
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  // Upload pipeline state (mirrors App.jsx's original logic)
  const [phase, setPhase]               = useState('idle')
  const [uploadError, setUploadError]   = useState(null)
  const [uploadedVideo, setUploadedVideo] = useState(null)

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

  async function handleFileSelected(file) {
    setUploadedVideo(null)
    setUploadError(null)
    setPhase('uploading')
    try {
      const data = await uploadVideo(file)
      const id = data?.id ?? data?.video_id
      setUploadedVideo(data)

      setPhase('transcribing')
      await transcribeVideo(id)

      setPhase('chunking')
      await chunkVideo(id)

      setPhase('embedding')
      await embedVideo(id)

      setPhase('ready')
    } catch (err) {
      setUploadError(err.message)
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('idle')
    setUploadError(null)
    setUploadedVideo(null)
  }

  async function handleDelete(video) {
    if (!window.confirm(`Delete "${video.title || 'Untitled'}"? This cannot be undone.`)) return
    setDeletingId(video.id)
    setDeleteError(null)
    try {
      await deleteVideo(video.id)
      setVideos(prev => prev.filter(v => v.id !== video.id))
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {phase === 'idle' ? (
        <UploadPanel onFileSelected={handleFileSelected} />
      ) : (
        <ProcessingStatus
          phase={phase}
          error={uploadError}
          videoName={uploadedVideo?.title ?? uploadedVideo?.filename ?? null}
          onReset={handleReset}
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
        {deleteError && <p className="msg error">{deleteError}</p>}

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
