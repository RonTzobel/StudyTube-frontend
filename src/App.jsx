import { useState } from 'react'
import UploadPanel from './components/UploadPanel'
import ProcessingStatus from './components/ProcessingStatus'
import AskPanel from './components/AskPanel'
import VideoInfoPanel from './components/VideoInfoPanel'
import PipelineActionsPanel from './components/PipelineActionsPanel'
import SearchPanel from './components/SearchPanel'
import { uploadVideo, transcribeVideo, chunkVideo, embedVideo } from './services/api'
import './App.css'

// phase: idle | uploading | transcribing | chunking | embedding | ready | error
export default function App() {
  const [video, setVideo]                   = useState(null)
  const [phase, setPhase]                   = useState('idle')
  const [pipelineError, setPipelineError]   = useState(null)
  const [devMode, setDevMode]               = useState(false)

  const videoId = video?.id ?? video?.video_id ?? null

  async function handleFileSelected(file) {
    setVideo(null)
    setPipelineError(null)
    setPhase('uploading')
    try {
      const data = await uploadVideo(file)
      const id = data?.id ?? data?.video_id
      setVideo(data)

      setPhase('transcribing')
      await transcribeVideo(id)

      setPhase('chunking')
      await chunkVideo(id)

      setPhase('embedding')
      await embedVideo(id)

      setPhase('ready')
    } catch (err) {
      setPipelineError(err.message)
      setPhase('error')
    }
  }

  function handleReset() {
    setVideo(null)
    setPhase('idle')
    setPipelineError(null)
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="app-logo">StudyTube</div>
        <p className="app-tagline">Upload a lecture and chat with it.</p>
      </header>

      <main className="app-main">
        {phase === 'idle' && (
          <UploadPanel onFileSelected={handleFileSelected} />
        )}

        {phase !== 'idle' && (
          <ProcessingStatus
            phase={phase}
            error={pipelineError}
            videoName={video?.title ?? video?.filename ?? null}
            onReset={handleReset}
          />
        )}

        {phase === 'ready' && (
          <AskPanel videoId={videoId} />
        )}

        {devMode && (
          <div className="dev-section">
            <div className="dev-section-header">Developer tools</div>
            <VideoInfoPanel video={video} />
            <PipelineActionsPanel videoId={videoId} />
            <SearchPanel videoId={videoId} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>StudyTube &mdash; backend at {import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001'}</span>
        <button className="btn ghost btn-devmode" onClick={() => setDevMode(d => !d)}>
          {devMode ? 'Hide dev tools' : 'Dev tools'}
        </button>
      </footer>
    </div>
  )
}
