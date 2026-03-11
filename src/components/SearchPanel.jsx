import { useState } from 'react'
import { searchVideo } from '../services/api'

export default function SearchPanel({ videoId }) {
  const [query, setQuery]     = useState('')
  const [topK, setTopK]       = useState(3)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError]     = useState(null)

  const disabled = !videoId || !query.trim()

  async function handleSearch() {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const data = await searchVideo(videoId, query.trim(), Number(topK))
      // Backend may return an array directly or { chunks: [...] }
      const list = Array.isArray(data) ? data : data?.chunks ?? data?.results ?? []
      setResults(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !disabled && !loading) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <section className="panel">
      <h2>Semantic Search</h2>
      <p className="panel-subtitle">
        Search the transcript chunks directly by semantic similarity. Useful for
        debugging the RAG pipeline or exploring the video content.
      </p>

      <div className="ask-input-row">
        <input
          type="text"
          className="input-full"
          placeholder="e.g. What are they presenting?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          disabled={!videoId}
        />
        <div className="ask-controls">
          <label className="label-inline">
            Top K
            <input
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              className="input-small"
              disabled={!videoId}
            />
          </label>
          <button
            className="btn"
            onClick={handleSearch}
            disabled={disabled || loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {!videoId && (
        <p className="msg hint">Upload a video first to enable this section.</p>
      )}

      {error && <p className="msg error">Error: {error}</p>}

      {results !== null && results.length === 0 && (
        <p className="msg hint">No results found. Make sure embeddings have been generated.</p>
      )}

      {results && results.length > 0 && (
        <div className="chunk-list">
          <p className="msg success">{results.length} result{results.length !== 1 ? 's' : ''} found.</p>
          {results.map((c, i) => (
            <div key={c.id ?? i} className="chunk-card">
              <div className="chunk-meta">
                <span className="badge">Chunk #{c.chunk_index ?? i}</span>
                <span className="badge score">
                  Score: {c.similarity_score?.toFixed(3) ?? '—'}
                </span>
                <span className="badge muted">
                  chars {c.start_char ?? '?'}–{c.end_char ?? '?'}
                </span>
              </div>
              <p className="chunk-content">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
