import { useState } from 'react'

export default function UploadPanel({ onFileSelected }) {
  const [file, setFile] = useState(null)

  function handleChange(e) {
    setFile(e.target.files[0] || null)
  }

  function handleUpload() {
    if (file) onFileSelected(file)
  }

  return (
    <section className="panel panel--upload">
      <h2>Upload a video</h2>
      <p className="panel-subtitle">
        Upload a lecture, talk, or any video — we'll transcribe it and let you ask questions about it.
      </p>

      <div className="upload-zone">
        <input
          id="file-input"
          type="file"
          accept="video/*,audio/*"
          className="upload-file-input"
          onChange={handleChange}
        />
        <label htmlFor="file-input" className={`upload-label ${file ? 'upload-label--has-file' : ''}`}>
          {file ? file.name : 'Choose a file'}
        </label>
        <button
          className="btn primary"
          disabled={!file}
          onClick={handleUpload}
        >
          Upload
        </button>
      </div>
    </section>
  )
}
