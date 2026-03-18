import { useEffect, useRef, useCallback } from 'react'

export default function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message,
  itemName,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
  error = null,
}) {
  const cancelRef = useRef(null)
  const modalRef  = useRef(null)

  // Focus cancel button when modal opens
  useEffect(() => {
    if (isOpen) {
      // slight delay so the animation has started
      const id = setTimeout(() => cancelRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  // Prevent background scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape to close + focus trap
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !loading) {
      onCancel()
      return
    }
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = Array.from(
        modalRef.current.querySelectorAll(
          'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [loading, onCancel])

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget && !loading) onCancel()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
        className="modal-box"
      >
        {/* Trash icon */}
        <div className={`modal-icon${danger ? ' modal-icon--danger' : ''}`} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </div>

        <h2 id="modal-title" className="modal-title">{title}</h2>

        {message && (
          <p id="modal-desc" className="modal-message">{message}</p>
        )}

        {itemName && (
          <div className="modal-item-name" title={itemName}>{itemName}</div>
        )}

        {error && (
          <p className="msg error modal-error" role="alert">{error}</p>
        )}

        <div className="modal-actions">
          <button
            ref={cancelRef}
            className="btn modal-cancel"
            onClick={onCancel}
            disabled={loading}
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            className={`btn modal-confirm${danger ? ' modal-confirm--danger' : ''}`}
            onClick={onConfirm}
            disabled={loading}
            aria-label={loading ? 'Deleting…' : confirmText}
            aria-busy={loading}
          >
            {loading && (
              <span className="modal-spinner" aria-hidden="true" />
            )}
            {loading ? 'Deleting…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
