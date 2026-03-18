const STEPS = [
  { key: 'uploading',    label: 'Uploading video' },
  { key: 'transcribing', label: 'Transcribing audio' },
  { key: 'chunking',     label: 'Preparing text' },
  { key: 'embedding',    label: 'Building AI index' },
]

const PHASE_ORDER = ['uploading', 'transcribing', 'chunking', 'embedding', 'ready']

// 'waiting' and 'stalled' are both mid-transcription — show as 'transcribing' for the step list
function normalisePhase(phase) {
  if (phase === 'waiting' || phase === 'stalled') return 'transcribing'
  return phase
}

function getStepStatus(stepKey, phase) {
  const phaseIdx = PHASE_ORDER.indexOf(phase)
  const stepIdx  = PHASE_ORDER.indexOf(stepKey)
  if (phaseIdx === -1) return 'pending'
  if (phaseIdx > stepIdx) return 'done'
  if (phaseIdx === stepIdx) return 'active'
  return 'pending'
}

export default function ProcessingStatus({ phase, error, videoName, onReset, onRefresh }) {
  // ── Genuine failure ────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <section className="panel">
        <div className="ps-error">
          <div className="ps-error-icon">✕</div>
          <div>
            <p className="ps-error-title">Processing failed</p>
            <p className="ps-error-desc">{error || 'Something went wrong. Please try again.'}</p>
          </div>
        </div>
        <button className="btn small" style={{ marginTop: 20 }} onClick={onReset}>
          Try again
        </button>
      </section>
    )
  }

  // ── Step list (shared by all non-error phases) ─────────────────────────────
  const displayPhase = normalisePhase(phase)

  const stepList = (
    <div className="ps-steps">
      {STEPS.map(step => {
        const status = getStepStatus(step.key, displayPhase)
        return (
          <div key={step.key} className={`ps-step ps-step--${status}`}>
            <span className="ps-step-icon">
              {status === 'done'    && <span className="ps-check">✓</span>}
              {status === 'active'  && <span className="ps-spinner" />}
              {status === 'pending' && <span className="ps-dot" />}
            </span>
            <span className="ps-step-label">{step.label}</span>
            {status === 'active' && <span className="ps-ellipsis">…</span>}
          </div>
        )
      })}
    </div>
  )

  // ── Polling window expired — backend has NOT reported failure ──────────────
  if (phase === 'stalled') {
    return (
      <section className="panel">
        {videoName && <div className="ps-filename">{videoName}</div>}
        {stepList}
        <div className="ps-notice">
          <p className="ps-notice-title">Taking longer than usual</p>
          <p className="ps-notice-desc">
            Your video is still being processed in the background. Large files can take a while.
            You can leave this page and come back later.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={onRefresh}>
              Refresh status
            </button>
            <button className="btn small ghost" onClick={onReset}>
              Upload a different video
            </button>
          </div>
        </div>
      </section>
    )
  }

  // ── Active slow polling after 10 min — still tracking ─────────────────────
  if (phase === 'waiting') {
    return (
      <section className="panel">
        {videoName && <div className="ps-filename">{videoName}</div>}
        {stepList}
        <p className="ps-long-running">
          Still processing — long videos can take several minutes.
          You can leave this page and return later.
        </p>
      </section>
    )
  }

  // ── Normal active progress ─────────────────────────────────────────────────
  return (
    <section className="panel">
      {videoName && <div className="ps-filename">{videoName}</div>}
      {stepList}
      {phase === 'ready' && (
        <div className="ps-success">
          Video is ready — ask your questions below
        </div>
      )}
    </section>
  )
}
