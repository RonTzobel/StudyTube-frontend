# StudyTube — Frontend

The React/Vite frontend for [StudyTube](https://www.studytubeapp.com), an AI-powered learning platform that lets users upload lecture videos and interact with them through AI-generated transcripts, summaries, quizzes, and a context-aware chat interface.

This is the client layer of a full-stack production system deployed on AWS EC2. It communicates with a FastAPI backend over a versioned REST API and is purpose-built around the UX challenges of long-running, asynchronous AI processing pipelines.

**Live:** [https://www.studytubeapp.com](https://www.studytubeapp.com)

---

## Table of Contents

- [Project Overview](#project-overview)
- [Core Features](#core-features)
- [User Experience Flow](#user-experience-flow)
- [Application Architecture](#application-architecture)
- [API Integration](#api-integration)
- [State Management and Component Design](#state-management-and-component-design)
- [Authentication](#authentication)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Engineering Challenges Solved](#engineering-challenges-solved)
- [Future Improvements](#future-improvements)
- [Tech Stack](#tech-stack)

---

## Project Overview

StudyTube addresses a real friction point in self-directed learning: long lecture videos are passive and hard to engage with. The platform lets users upload a lecture video, transcribes it automatically using a Whisper-based backend worker, chunks and embeds the transcript for semantic retrieval, then exposes the content through three AI interfaces — conversational chat, an on-demand multiple-choice quiz, and a structured summary.

The frontend is responsible for:

- Accepting video file uploads and providing accurate, real-time feedback throughout a multi-stage backend pipeline
- Tracking and rendering processing status as the backend worker moves through `queued → transcribing → embedding → completed`
- Gating UI features (chat, quiz, summary) on verified backend readiness — not on optimistic local state
- Supporting multiple persistent chat sessions per video with per-message answer source attribution
- Authenticating users via email/password or Google OAuth, with session restoration on page refresh

---

## Core Features

### Video Upload and Processing Pipeline

- File selection via drag-and-drop upload panel
- 4-step visual progress card: **Uploading → Transcribing audio → Preparing text → Building AI index**
- Adaptive polling: fast interval (3 s) for the first 10 minutes, slower (30 s) after that
- `stalled` state for jobs that exceed the 1-hour polling window — distinguishes "still running" from a genuine failure and surfaces a manual "Refresh status" action
- Background auto-poll resumes when navigating back to the home page mid-pipeline

### AI Features (unlocked when `status === "completed"`)

- **Chat** — multi-turn conversation over the lecture content. Supports two modes toggled per message:
  - *Ask about lecture* — RAG-grounded answers retrieved from the embedded transcript
  - *Ask generally* — open-ended LLM response
  - Per-message source attribution badge: **From lecture** or **General answer**
- **Quiz** — on-demand 5-question multiple-choice quiz generated from the lecture, with inline scoring and correct/incorrect highlighting on submit
- **Summary** — structured AI-generated summary with key points and important terms

### Video Library

- Per-user video list with real-time status badges
- Badge states: Uploaded (muted), Queued / Processing / Transcribing / Indexing (amber), Ready (green), Failed (red)
- Video deletion with a confirmation modal

### Authentication

- Email/password registration with client-side validation (min/max length, UTF-8 byte-length check)
- Google OAuth via backend-initiated redirect flow
- JWT session restored from `localStorage` on startup with no flash of unauthenticated content

---

## User Experience Flow

```
1. User registers or logs in
   └── email/password  OR  Google OAuth (redirect → /auth/callback)

          │
          ▼
2. Home page — video library
   ├── Empty state  : drag-and-drop upload panel
   └── Non-empty    : video cards with status badges

          │  user selects a video file
          ▼
3. Upload pipeline — inline progress card

   [✓] Uploading video
   [↻] Transcribing audio      ← backend Whisper worker running
   [ ] Preparing text
   [ ] Building AI index

          │  backend worker reaches status = "completed"
          ▼
4. Progress card completes — all four steps green

   [✓] Uploading video
   [✓] Transcribing audio
   [✓] Preparing text
   [✓] Building AI index
       "Video is ready — ask your questions below"

          │  user clicks View on the video card
          ▼
5. Video detail page
   ├── Status badge : Ready
   ├── [Get Summary]  [Start Chat]  [Take Quiz]  ← all enabled
   └── Previous chat sessions listed below

          │  user clicks Start Chat
          ▼
6. Chat view
   ├── Mode toggle: "Ask about lecture" / "Ask generally"
   ├── Typing indicator while awaiting response
   ├── Source badge per assistant reply
   └── Session persists; user can return to it later
```

---

## Application Architecture

```
src/
├── App.jsx                  # BrowserRouter, AuthProvider, route tree, ProtectedRoute guard
├── context/
│   └── AuthContext.jsx      # JWT state, login/logout, Google OAuth two-step flow, startup rehydration
├── services/
│   └── api.js               # All fetch calls — single request() helper with auth injection,
│                            #   error normalisation, 202/204 handling
└── components/
    ├── VideoList.jsx         # Home: video library, upload pipeline, polling orchestration
    ├── VideoDetail.jsx       # Video page: readiness gating, summary, quiz, chat session list
    ├── ChatView.jsx          # Multi-turn chat, question mode selector, answer source badges
    ├── ProcessingStatus.jsx  # 4-step progress card (phase-driven, stateless rendering)
    ├── UploadPanel.jsx       # File input / drag-and-drop
    ├── ConfirmModal.jsx      # Reusable confirmation dialog (video deletion)
    ├── LoginPage.jsx         # Email/password + Google OAuth login
    ├── RegisterPage.jsx      # Registration with client-side password validation
    └── AuthCallback.jsx      # Handles /auth/callback?token=... after Google redirect
```

### Route Structure

| Path | Access | Component |
|---|---|---|
| `/login` | Public | `LoginPage` |
| `/register` | Public | `RegisterPage` |
| `/auth/callback` | Public | `AuthCallback` |
| `/` | Protected | `VideoList` |
| `/videos/:id` | Protected | `VideoDetail` |
| `/chat/:sessionId` | Protected | `ChatView` |

`ProtectedRoute` suspends rendering until `AuthContext` resolves its startup token verification, preventing any flash of unauthenticated content or spurious redirects.

---

## API Integration

All network calls are routed through a single `request()` helper in `src/services/api.js`. Responsibilities:

- **JWT injection** — reads `st_token` from `localStorage` and sets `Authorization: Bearer <token>` on every request
- **401 handling** — clears the stored token and hard-redirects to `/login` via `window.location.href`, since `api.js` is intentionally decoupled from React Router and AuthContext
- **422 error normalisation** — FastAPI validation errors return `detail` as an array of `{ loc, msg, type }` objects; the helper detects the array case and joins the `msg` fields into a readable string before surfacing the error to the UI
- **202 Accepted** — used by the transcription endpoint (background job queued); response body is optional and both cases are handled cleanly
- **204 No Content** — returns `null` for delete operations without attempting JSON parsing

### Frontend-to-Backend Interaction Flow

```
Browser                         Nginx                 FastAPI               RQ Worker
   │                               │                      │                      │
   │─ POST /api/v1/videos/upload ──►│──────────────────────►│                      │
   │◄─ 200 { id, status:"uploaded" }│◄─────────────────────│                      │
   │                               │                      │                      │
   │─ POST /api/v1/videos/{id}/transcribe ────────────────►│─── enqueue job ─────►│
   │◄─ 202 Accepted ────────────────────────────────────── │                      │
   │                               │                      │   [Whisper running]   │
   │─ GET /api/v1/videos/{id}/status (poll) ──────────────►│                      │
   │◄─ 200 { status: "transcribing" } ──────────────────── │                      │
   │                               │                      │   [chunk + embed]     │
   │─ GET /api/v1/videos/{id}/status (poll) ──────────────►│                      │
   │◄─ 200 { status: "embedding" } ─────────────────────── │                      │
   │                               │                      │   [pipeline done] ───►│
   │─ GET /api/v1/videos/{id}/status (poll) ──────────────►│                      │
   │◄─ 200 { status: "completed" } ─────────────────────── │                      │
   │                               │                      │                      │
   │  [polling stops; Chat / Quiz / Summary unlock]        │                      │
   │                               │                      │                      │
   │─ POST /api/v1/chat/sessions ─────────────────────────►│                      │
   │─ POST /api/v1/chat/sessions/{id}/messages ───────────►│  [RAG retrieval      │
   │◄─ { user_message, assistant_message, answer_source } ─│   + LLM inference]   │
```

---

## State Management and Component Design

The application uses React's built-in `useState`, `useEffect`, and Context API exclusively — no external state management library. The component tree is shallow enough that prop passing and a single context are sufficient without the overhead of Redux or Zustand.

`AuthContext` is the only global context. All other state is co-located with the component that owns it.

### Upload Pipeline State Machine (`VideoList.jsx`)

The most complex stateful flow in the application. After upload and transcription trigger, a `pollUntilReady()` async function drives a local `phase` state through the following transitions:

```
idle → uploading → transcribing → [embedding] → ready
                        │               │
                      waiting         (phase set by onStatusChange callback)
                        │
                      stalled
                        │ (user clicks "Refresh status")
                      [resumes polling or transitions to ready/error]
```

Key design decisions:

- `phase` is a **frontend-local variable** that drives `ProcessingStatus`. It is not directly the backend `status` string. This decoupling means the progress UI never breaks due to a backend status rename.
- An `onStatusChange` callback is passed to `pollUntilReady`. When the backend reports `embedding`, the local phase advances to `embedding`, causing all preceding steps to render as complete and the final step to spin. When `completed` arrives, polling stops and `phase` is set to `ready`.
- An `AbortController` ref cancels in-flight polling on unmount or when a new upload starts, preventing stale state updates.
- `IN_PROGRESS_STATUSES` is a `Set` used in both the active polling loop and the background auto-poll effect, so both stop consistently when the backend reaches `completed` or `failed`.

### ProcessingStatus Component

`ProcessingStatus` is **stateless** — it receives a `phase` prop and derives each step's visual state from a position comparison in a fixed `PHASE_ORDER` array:

```js
const PHASE_ORDER = ['uploading', 'transcribing', 'chunking', 'embedding', 'ready']

function getStepStatus(stepKey, phase) {
  const phaseIdx = PHASE_ORDER.indexOf(phase)
  const stepIdx  = PHASE_ORDER.indexOf(stepKey)
  if (phaseIdx > stepIdx) return 'done'
  if (phaseIdx === stepIdx) return 'active'
  return 'pending'
}
```

This makes the rendering logic trivially predictable and decoupled from all network concerns.

### Feature Gating in VideoDetail

Availability of chat, quiz, and summary is derived from two booleans computed at render time:

```js
const isDone = video.status === 'completed'
  || video.status === 'ready'
  || video.status === 'done'

const isAiReady = video.status === 'completed'
  || video.status === 'ready'
  || (video.status === 'done' && !loadingChunks && embeddedChunkCount > 0)
```

`completed` is the current backend signal. `ready` and `done` are handled for backwards compatibility with videos processed before the pipeline was updated. For legacy `done` videos, readiness is inferred from a secondary chunk-count check against `GET /videos/{id}/chunks`.

### Navigation State for Zero-Latency Transitions

When navigating from `VideoList` to `VideoDetail`, the video object is passed via React Router's `location.state`. The detail page renders immediately with full data rather than waiting for a network fetch. If the state is absent (e.g. direct URL access), the component falls back to fetching from the API.

### Chat Answer Source Attribution

The send-message endpoint returns `answer_source: "lecture" | "general"` alongside each assistant message. This field is only present for messages sent in the current browser session — not for history loaded via `GET /sessions/{id}/messages`. Rather than mutating the message objects, a separate `sources` map keyed by message ID is maintained in component state. This avoids a shape mismatch between in-session and historical messages.

---

## Authentication

### Email/Password

1. `POST /auth/register` or `POST /auth/login` → `{ access_token, user }`
2. `AuthContext.login(token, user)` stores the token in `localStorage` and updates context
3. On every page load, `authMe()` verifies the stored token with the backend and rehydrates `user`; if the token is expired or invalid, it is cleared and the user is redirected to `/login`

### Google OAuth

1. User clicks "Continue with Google" → browser is redirected to `GET /api/v1/auth/google/login`
2. Backend handles the full OAuth dance with Google; Google redirects back to `/auth/callback?token=<backend_jwt>`
3. `AuthCallback` reads the query parameter, calls `authMe()` to fetch the user object, then calls `login(token, user)`

Both flows produce the same JWT format and converge on the same authenticated application state.

### Password Validation

Client-side validation runs before any request is sent:

- Minimum 8 characters
- `new TextEncoder().encode(password).length > 72` → rejected with a friendly message

The byte-length check matches the bcrypt 72-byte processing limit enforced by the backend. Using `TextEncoder` rather than `.length` ensures emoji and multi-byte characters are correctly counted in bytes, not JavaScript UTF-16 code units.

---

## Environment Configuration

The frontend uses Vite's `import.meta.env` for build-time environment variables:

| Variable | Purpose | Production value |
|---|---|---|
| `VITE_API_URL` | Backend base URL (without `/v1`) | `/api` (nginx reverse proxy) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | GCP project credential |

In production, `VITE_API_URL=/api` and nginx proxies `/api/` to the FastAPI process on the same EC2 instance. This keeps the frontend and backend on the same origin, avoiding CORS headers entirely.

**Local development:**

```bash
# .env.local
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=<your-gcp-client-id>
```

---

## Deployment

The frontend ships as a static Vite build served by nginx on AWS EC2.

### CI/CD Pipeline

Defined in `.github/workflows/deploy.yml`. Triggered on every push to `main`:

```
push to main
    │
    ▼
GitHub Actions (ubuntu-latest)
    ├── npm ci
    ├── npm run build           → dist/
    ├── rsync dist/ over SSH    → EC2:/var/www/studytube/
    └── ssh "sudo systemctl reload nginx"
```

The Vite build runs in the Actions runner — not on the EC2 instance — keeping the server free of build tooling. Deployment credentials (`EC2_SSH_KEY`, `EC2_USER`, `EC2_HOST`) are stored as GitHub repository secrets.

### nginx Configuration

- Serves `dist/` as the document root
- SPA fallback: `try_files $uri /index.html` so client-side routes work on direct URL access and page refresh
- Reverse-proxies `/api/` to the FastAPI process (same host)

### Local Build

```bash
npm install
npm run dev       # Vite dev server with HMR at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Serve the production build locally for verification
```

---

## Engineering Challenges Solved

### 1. Long-Running Pipeline with Tiered Polling and Graceful Degradation

Video processing can take anywhere from 30 seconds to several minutes. A fixed polling interval either hammers the server for short videos or feels unresponsive for long ones. The solution uses a **fast → slow → stalled** tiered strategy:

- `FAST_POLL_MS = 3_000` for the first 10 minutes
- `SLOW_POLL_MS = 30_000` after 10 minutes
- After 1 hour: return the `POLL_GAVE_UP` sentinel (not a thrown error) and enter the `stalled` state

The `stalled` state explicitly communicates "the job is still running, we just stopped watching" rather than presenting a failure. The user can leave the page and return later, or manually trigger a status check that resumes polling if the job is still in progress.

### 2. Progress UI Decoupled from Backend Status Strings

The backend's status vocabulary evolved during development. Because `ProcessingStatus` renders from a local `phase` string rather than directly from `video.status`, and because `phase` is only advanced by explicit calls (`setPhase(...)`) in response to backend data, a backend status rename does not silently break the UI. The `onStatusChange` callback pattern means the progress card advances correctly (`transcribing` → `embedding` → `ready`) without the polling function needing to know anything about React rendering.

### 3. FastAPI 422 Validation Errors Surfaced as Readable Messages

FastAPI returns structured validation errors as `detail: [{ loc, msg, type }]`. Assigning this array directly to `new Error(message)` produces `[object Object]` — unreadable and impossible to map to friendly UI copy. The `request()` helper detects the array case early and joins the `msg` fields into a plain string, ensuring all error handling downstream receives consistent input.

### 4. No Flash of Unauthenticated Content on Startup

`AuthContext` initialises with `loading: true`. `ProtectedRoute` renders nothing while `loading` is true. Only after `authMe()` resolves (or the stored token is found to be absent) does the route render. This eliminates the common pattern of briefly rendering the login screen before snapping to the authenticated view.

### 5. Backend/Frontend Status Contract Kept Explicit

Rather than scattering `status === 'processing'` string comparisons throughout components, in-progress states are centralised in an `IN_PROGRESS_STATUSES` Set. Feature readiness is derived in one place per component through `isDone` and `isAiReady` booleans. When the backend contract changes, there is one place to update per concern.

---

## Future Improvements

Deferred engineering work, not missing features:

- **Streaming chat responses** — replace the request/response chat with SSE so the assistant reply streams token-by-token, improving perceived latency on longer answers
- **Resumable uploads** — large files over slow connections would benefit from a chunked upload protocol (e.g. tus) with client-side resume on network failure
- **Optimistic chat UI** — append the user message immediately and show a typing indicator for the assistant, rather than waiting for the full round-trip before displaying either
- **Pagination on the video list** — current implementation fetches all videos in a single request; a cursor-based pagination approach is needed as the library grows per user
- **TypeScript migration** — the codebase is structured cleanly enough that incremental adoption would be low-friction; a TS-typed status union would have caught the status-string drift issues at compile time
- **End-to-end tests for the upload pipeline** — the multi-phase polling flow is the highest-risk path in the application and the most valuable target for Playwright or Cypress coverage

---

## Tech Stack

| | |
|---|---|
| Framework | React 18 |
| Build tool | Vite 5 |
| Language | JavaScript (JSX) |
| Routing | React Router v6 |
| HTTP | Native `fetch` API with a hand-rolled `request()` helper |
| Auth | JWT (localStorage) + Google OAuth redirect flow |
| Styling | Custom CSS — no component library |
| CI/CD | GitHub Actions |
| Web server | nginx (SPA fallback + API reverse proxy) |
| Hosting | AWS EC2 |
| Backend | FastAPI (separate repository) |

---

Live: [https://www.studytubeapp.com](https://www.studytubeapp.com)
