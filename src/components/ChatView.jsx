import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getChatSession, getChatMessages, sendChatMessage } from '../services/api'

export default function ChatView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [session, setSession]                 = useState(location.state?.session ?? null)
  const [messages, setMessages]               = useState([])
  // sources: { [assistantMessageId]: "lecture" | "general" }
  // Only populated for messages sent in this tab — not available for historical messages.
  const [sources, setSources]                 = useState({})
  const [input, setInput]                     = useState('')
  const [questionMode, setQuestionMode]       = useState('lecture')
  const [sending, setSending]                 = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [error, setError]                     = useState(null)

  const messagesEndRef = useRef(null)
  const video = location.state?.video

  useEffect(() => {
    async function load() {
      try {
        if (!session) {
          setSession(await getChatSession(sessionId))
        }
        setMessages(await getChatMessages(sessionId))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingMessages(false)
      }
    }
    load()
  }, [sessionId])

  // Scroll to bottom whenever messages update or the typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setError(null)
    try {
      const result = await sendChatMessage(sessionId, text, questionMode)
      setMessages(prev => [...prev, result.user_message, result.assistant_message])
      // Record answer_source for this assistant message so we can show the badge
      if (result.answer_source) {
        setSources(prev => ({ ...prev, [result.assistant_message.id]: result.answer_source }))
      }
    } catch (err) {
      // Give a clear message when the video hasn't been embedded yet
      const detail = err.message || ''
      if (detail.toLowerCase().includes('embedded') || detail.toLowerCase().includes('chunk')) {
        setError(
          'This video is not ready for chat yet — embeddings have not been generated. ' +
          'Go back and run the Chunk → Embed steps first.'
        )
      } else {
        setError(detail)
      }
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault()
      handleSend()
    }
  }

  const backPath = video ? `/videos/${session?.video_id ?? video.id}` : '/'

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="btn ghost small" onClick={() => navigate(backPath, { state: { video } })}>
          ← Back
        </button>
        <div className="chat-header-title">
          {session?.title || 'Untitled Session'}
          {video && <span className="chat-header-video"> — {video.title}</span>}
        </div>
      </div>

      <div className="chat-messages">
        {loadingMessages && (
          <p className="msg hint" style={{ padding: 16 }}>Loading messages…</p>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message message--${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
            {msg.role === 'assistant' && sources[msg.id] && (
              <span className={`source-badge source-badge--${sources[msg.id]}`}>
                {sources[msg.id] === 'lecture' ? 'From lecture' : 'General answer'}
              </span>
            )}
            <div className="message-time">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {sending && (
          <div className="message message--assistant">
            <div className="message-bubble typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <p className="msg error" style={{ margin: '0 0 8px' }}>{error}</p>
      )}

      <div className="chat-mode-selector">
        <button
          className={`btn small ${questionMode === 'lecture' ? 'mode-active' : 'ghost'}`}
          onClick={() => setQuestionMode('lecture')}
          disabled={sending}
        >
          Ask about lecture
        </button>
        <button
          className={`btn small ${questionMode === 'general' ? 'mode-active' : 'ghost'}`}
          onClick={() => setQuestionMode('general')}
          disabled={sending}
        >
          Ask generally
        </button>
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-textarea"
          placeholder={
            questionMode === 'lecture'
              ? 'Ask about the lecture… (Enter to send)'
              : 'Ask any question… (Enter to send)'
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
          rows={2}
        />
        <button
          className="btn primary"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
