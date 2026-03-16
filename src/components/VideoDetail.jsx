import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  listVideos, getSummary, quizVideo,
  createChatSession, getChatSessions,
} from '../services/api'

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

export default function VideoDetail() {
  const { id } = useParams()
  const videoId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()

  // Use video passed via navigation state as initial value; fetch if missing
  const [video, setVideo]       = useState(location.state?.video ?? null)
  const [sessions, setSessions] = useState([])
  const [summary, setSummary]   = useState(null)
  const [quiz, setQuiz]         = useState(null)
  const [quizAnswers, setQuizAnswers]   = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const [loadingVideo, setLoadingVideo]     = useState(!location.state?.video)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingChat, setLoadingChat]       = useState(false)
  const [loadingQuiz, setLoadingQuiz]       = useState(false)

  const [videoError, setVideoError]     = useState(null)
  const [chatError, setChatError]       = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [quizError, setQuizError]       = useState(null)

  useEffect(() => {
    async function load() {
      // Fetch video from list if not already available
      if (!video) {
        setLoadingVideo(true)
        try {
          const all = await listVideos()
          const found = all.find(v => v.id === videoId)
          if (!found) { setVideoError('Video not found.'); return }
          setVideo(found)
        } catch (err) {
          setVideoError(err.message)
          return
        } finally {
          setLoadingVideo(false)
        }
      }

      // Fetch all sessions and filter to this video
      try {
        const all = await getChatSessions()
        setSessions(all.filter(s => s.video_id === videoId))
      } catch (_) {
        // Non-fatal — sessions list just stays empty
      }
    }
    load()
  }, [videoId])

  async function handleGetSummary() {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      setSummary(await getSummary(videoId))
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleStartChat() {
    setLoadingChat(true)
    setChatError(null)
    try {
      const session = await createChatSession(videoId)
      navigate(`/chat/${session.id}`, { state: { session, video } })
    } catch (err) {
      setChatError(err.message)
    } finally {
      setLoadingChat(false)
    }
  }

  async function handleTakeQuiz() {
    setLoadingQuiz(true)
    setQuizError(null)
    setQuiz(null)
    setQuizAnswers({})
    setQuizSubmitted(false)
    try {
      setQuiz(await quizVideo(videoId, 5))
    } catch (err) {
      setQuizError(err.message)
    } finally {
      setLoadingQuiz(false)
    }
  }

  if (loadingVideo) {
    return <p className="msg hint" style={{ marginTop: 24 }}>Loading video…</p>
  }
  if (videoError) {
    return <p className="msg error" style={{ marginTop: 24 }}>{videoError}</p>
  }
  if (!video) return null

  const hasTranscript = video.status === 'done' || video.status === 'processing'
  const isDone = video.status === 'done'

  const quizScore = quiz && quizSubmitted
    ? quiz.questions.filter((q, i) => quizAnswers[i] === q.correct_answer).length
    : null

  return (
    <div>
      <button className="btn ghost small back-btn" onClick={() => navigate('/')}>
        ← Back
      </button>

      <section className="panel">
        <h2>{video.title || 'Untitled Video'}</h2>
        <div className="video-detail-meta">
          <span className={isDone ? 'badge badge--success' : 'badge badge--muted'}>
            {statusLabel(video.status)}
          </span>
          <span className="text-muted">ID: {video.id}</span>
          <span className="text-muted">{new Date(video.created_at).toLocaleString()}</span>
        </div>

        <div className="action-row">
          {isDone && (
            <button className="btn" onClick={handleGetSummary} disabled={loadingSummary}>
              {loadingSummary ? 'Loading…' : 'Get Summary'}
            </button>
          )}
          <button className="btn primary" onClick={handleStartChat} disabled={loadingChat}>
            {loadingChat ? 'Starting…' : 'Start Chat'}
          </button>
          {isDone && (
            <button className="btn" onClick={handleTakeQuiz} disabled={loadingQuiz}>
              {loadingQuiz ? 'Generating…' : 'Take Quiz'}
            </button>
          )}
        </div>

        {chatError    && <p className="msg error" style={{ marginTop: 12 }}>{chatError}</p>}
        {summaryError && <p className="msg error" style={{ marginTop: 12 }}>{summaryError}</p>}
        {quizError    && <p className="msg error" style={{ marginTop: 12 }}>{quizError}</p>}
      </section>

      {summary && <SummaryCard summary={summary} />}

      {quiz && (
        <QuizCard
          quiz={quiz}
          answers={quizAnswers}
          submitted={quizSubmitted}
          score={quizScore}
          onChange={(i, val) => setQuizAnswers(prev => ({ ...prev, [i]: val }))}
          onSubmit={() => setQuizSubmitted(true)}
          onRetry={() => { setQuizAnswers({}); setQuizSubmitted(false) }}
        />
      )}

      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Chat Sessions</h2>
        {sessions.length === 0 ? (
          <p className="msg hint">No sessions yet. Click "Start Chat" above.</p>
        ) : (
          <div className="session-list">
            {sessions.map(s => (
              <div
                key={s.id}
                className="session-item"
                onClick={() => navigate(`/chat/${s.id}`, { state: { session: s, video } })}
              >
                <span className="session-title">{s.title || 'Untitled Session'}</span>
                <span className="session-date">{new Date(s.updated_at).toLocaleString()}</span>
                <span className="btn small ghost">Open →</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────

function SummaryCard({ summary }) {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Summary — {summary.video_title}</h2>
      <p className="summary-text">{summary.summary}</p>

      {summary.key_points?.length > 0 && (
        <div className="summary-section">
          <h3>Key Points</h3>
          <ul className="key-points-list">
            {summary.key_points.map((pt, i) => <li key={i}>{pt}</li>)}
          </ul>
        </div>
      )}

      {summary.important_terms?.length > 0 && (
        <div className="summary-section">
          <h3>Important Terms</h3>
          <dl className="terms-list">
            {summary.important_terms.map((entry, i) => {
              const sep  = entry.indexOf(': ')
              const term = sep >= 0 ? entry.slice(0, sep) : entry
              const def  = sep >= 0 ? entry.slice(sep + 2) : ''
              return (
                <div key={i} className="term-entry">
                  <dt><strong>{term}</strong></dt>
                  {def && <dd>{def}</dd>}
                </div>
              )
            })}
          </dl>
        </div>
      )}
    </section>
  )
}

// ── Quiz ──────────────────────────────────────────────────────────────────

function QuizCard({ quiz, answers, submitted, score, onChange, onSubmit, onRetry }) {
  const total = quiz.questions.length
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title-row">
        <h2>Quiz — {quiz.video_title}</h2>
        {submitted && (
          <div className="quiz-score">
            {score}/{total}
            <button className="btn small ghost" style={{ marginLeft: 10 }} onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="quiz-questions">
        {quiz.questions.map((q, i) => (
          <div key={i} className="quiz-question">
            <p className="quiz-q-text"><strong>Q{i + 1}.</strong> {q.question}</p>
            <div className="quiz-options">
              {q.options.map((opt, j) => {
                const isSelected = answers[i] === opt
                const isCorrect  = submitted && opt === q.correct_answer
                const isWrong    = submitted && isSelected && opt !== q.correct_answer
                return (
                  <label
                    key={j}
                    className={`quiz-option${isCorrect ? ' correct' : ''}${isWrong ? ' wrong' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`q${i}`}
                      value={opt}
                      checked={isSelected}
                      disabled={submitted}
                      onChange={() => onChange(i, opt)}
                    />
                    {opt}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <button
          className="btn primary"
          style={{ marginTop: 20 }}
          disabled={Object.keys(answers).length < total}
          onClick={onSubmit}
        >
          Submit Quiz
        </button>
      )}
    </section>
  )
}
