import { useState } from 'react'
import { askVideo } from '../services/api'

export default function AskPanel({ videoId }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [showChunks, setShowChunks] = useState(false)

  const canAsk = !!videoId && question.trim().length > 0

  async function handleAsk() {
    if (!canAsk) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await askVideo(videoId, question.trim(), 3)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !loading && canAsk) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <section className="panel">
      <h2>Ask a question</h2>
      <p className="panel-subtitle">
        Ask anything about the video. Press Enter or click Ask.
      </p>

      <div className="ask-input-row">
        <textarea
          className="ask-textarea"
          placeholder="e.g. What is the main topic of this video?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={!videoId}
        />
        <div className="ask-controls">
          <button
            className="btn primary"
            onClick={handleAsk}
            disabled={!canAsk || loading}
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </div>

      {error && <p className="msg error">{error}</p>}

      {result && (
        <div className="answer-area">
          <div className="answer-question">
            <span className="label">Q:</span> {result.question}
          </div>
          <div className="answer-body">
            <span className="label">A:</span>
            <p>{result.answer}</p>
          </div>

          {result.retrieved_chunks?.length > 0 && (
            <div className="answer-chunks">
              <button
                className="btn small ghost"
                onClick={() => setShowChunks(s => !s)}
              >
                {showChunks
                  ? 'Hide sources'
                  : `Show ${result.retrieved_chunks.length} sources`}
              </button>
              {showChunks && (
                <div className="chunk-list">
                  {result.retrieved_chunks.map((c) => (
                    <ChunkCard key={c.id} chunk={c} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ChunkCard({ chunk }) {
  return (
    <div className="chunk-card">
      <div className="chunk-meta">
        <span className="badge">Chunk #{chunk.chunk_index}</span>
        <span className="badge score">
          Score: {chunk.similarity_score?.toFixed(3) ?? '—'}
        </span>
        <span className="badge muted">
          chars {chunk.start_char}–{chunk.end_char}
        </span>
      </div>
      <p className="chunk-content">{chunk.content}</p>
    </div>
  )
}
