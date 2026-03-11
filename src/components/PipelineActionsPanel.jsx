import { useState } from 'react'
import {
  transcribeVideo,
  getTranscript,
  chunkVideo,
  getChunks,
  embedVideo,
} from '../services/api'

// Manages state for a single pipeline step
function usePipelineStep(apiFn) {
  const [loading, setLoading] = useState(false)
  const [data, setData]       = useState(null)
  const [error, setError]     = useState(null)

  async function run(videoId) {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn(videoId)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { loading, data, error, run }
}

export default function PipelineActionsPanel({ videoId }) {
  const transcribe = usePipelineStep(transcribeVideo)
  const transcript = usePipelineStep(getTranscript)
  const chunk      = usePipelineStep(chunkVideo)
  const chunks     = usePipelineStep(getChunks)
  const embed      = usePipelineStep(embedVideo)

  const steps = [
    {
      label: 'Transcribe',
      hint:  'Run Whisper on the video audio to generate a transcript.',
      step:  transcribe,
    },
    {
      label: 'Get Transcript',
      hint:  'Fetch the stored transcript text from the backend.',
      step:  transcript,
    },
    {
      label: 'Chunk Transcript',
      hint:  'Split the transcript into overlapping text chunks for retrieval.',
      step:  chunk,
    },
    {
      label: 'Get Chunks',
      hint:  'Fetch all stored chunks and inspect them.',
      step:  chunks,
    },
    {
      label: 'Embed Chunks',
      hint:  'Generate sentence-transformer embeddings for all chunks (required for search and Q&A).',
      step:  embed,
    },
  ]

  const noVideo = !videoId

  return (
    <section className="panel">
      <h2>Pipeline Actions</h2>
      <p className="panel-subtitle">
        Run these steps in order to prepare the video for question answering.
        Transcribe &rarr; Chunk &rarr; Embed, then you can Ask or Search.
      </p>

      <div className="pipeline-grid">
        {steps.map(({ label, hint, step }) => (
          <div key={label} className="pipeline-step">
            <div className="step-header">
              <span className="step-label">{label}</span>
              <button
                className="btn"
                disabled={noVideo || step.loading}
                onClick={() => step.run(videoId)}
              >
                {step.loading ? 'Running…' : 'Run'}
              </button>
            </div>
            <p className="step-hint">{hint}</p>
            {step.error && <p className="msg error">{step.error}</p>}
            {step.data   && <StepResult label={label} data={step.data} />}
          </div>
        ))}
      </div>

      {noVideo && (
        <p className="msg hint">Upload a video first to enable pipeline actions.</p>
      )}
    </section>
  )
}

function StepResult({ label, data }) {
  const [open, setOpen] = useState(false)

  let summary = null

  if (label === 'Transcribe') {
    summary = <p className="msg success">Transcription complete.</p>
  }

  if (label === 'Get Transcript') {
    const text =
      data?.transcript?.text ||
      data?.text           ||
      data?.content        ||
      (typeof data === 'string' ? data : null)
    summary = text ? (
      <p className="transcript-preview">
        {text.slice(0, 500)}{text.length > 500 ? '…' : ''}
      </p>
    ) : (
      <p className="msg success">Transcript received.</p>
    )
  }

  if (label === 'Chunk Transcript') {
    const list = Array.isArray(data) ? data : data?.chunks ?? []
    summary = (
      <p className="msg success">
        {list.length} chunk{list.length !== 1 ? 's' : ''} created.
      </p>
    )
  }

  if (label === 'Get Chunks') {
    const list = Array.isArray(data) ? data : data?.chunks ?? []
    const embedded = list.filter((c) => c.is_embedded).length
    summary = (
      <p className="msg success">
        {list.length} chunk{list.length !== 1 ? 's' : ''} &mdash; {embedded} embedded.
      </p>
    )
  }

  if (label === 'Embed Chunks') {
    summary = <p className="msg success">Embeddings generated successfully.</p>
  }

  return (
    <div>
      {summary}
      <button className="btn small ghost" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide raw JSON' : 'Show raw JSON'}
      </button>
      {open && <pre className="code-block">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
