export default function VideoInfoPanel({ video }) {
  if (!video) {
    return (
      <section className="panel muted">
        <h2>Current Video</h2>
        <p>No video uploaded yet. Upload a video to get started.</p>
      </section>
    )
  }

  const rows = [
    { label: 'Video ID', value: video.id ?? video.video_id ?? '—' },
    { label: 'Title', value: video.title ?? video.filename ?? video.file_name ?? '—' },
    { label: 'Status', value: video.status ?? '—' },
    { label: 'File path', value: video.file_path ?? video.path ?? '—' },
    { label: 'Created at', value: video.created_at ?? '—' },
  ]

  return (
    <section className="panel highlight">
      <h2>Current Video</h2>
      <table className="info-table">
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label}>
              <td className="info-label">{label}</td>
              <td className="info-value">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
