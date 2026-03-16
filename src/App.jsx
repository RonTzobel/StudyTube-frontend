import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import VideoList from './components/VideoList'
import VideoDetail from './components/VideoDetail'
import ChatView from './components/ChatView'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <header className="app-header">
          <Link to="/" className="app-logo" style={{ textDecoration: 'none' }}>
            StudyTube
          </Link>
          <p className="app-tagline">Upload a lecture and chat with it.</p>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<VideoList />} />
            <Route path="/videos/:id" element={<VideoDetail />} />
            <Route path="/chat/:sessionId" element={<ChatView />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <span>StudyTube &mdash; backend at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}</span>
        </footer>
      </div>
    </BrowserRouter>
  )
}
