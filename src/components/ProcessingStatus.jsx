const STEPS = [
  { key: 'uploading',    label: 'Uploading video' },
  { key: 'transcribing', label: 'Transcribing audio' },
  { key: 'chunking',     label: 'Preparing text' },
  { key: 'embedding',    label: 'Building AI index' },
]

// Order used to compare current phase against each step
const PHASE_ORDER = ['uploading', 'transcribing', 'chunking', 'embedding', 'ready']

function getStepStatus(stepKey, phase) {
  const phaseIdx = PHASE_ORDER.indexOf(phase)
  const stepIdx  = PHASE_ORDER.indexOf(stepKey)
  if (phaseIdx === -1) return 'pending' // 'error' or unknown
  if (phaseIdx > stepIdx) return 'done'
  if (phaseIdx === stepIdx) return 'active'
  return 'pending'
}

export default function ProcessingStatus({ phase, error, videoName, onReset }) {
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

  return (
    <section className="panel">
      {videoName && (
        <div className="ps-filename">{videoName}</div>
      )}

      <div className="ps-steps">
        {STEPS.map(step => {
          const status = getStepStatus(step.key, phase)
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

      {phase === 'ready' && (
        <div className="ps-success">
          Video is ready — ask your questions below
        </div>
      )}
    </section>
  )
}
