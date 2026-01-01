# ARCHITECTURE.md

> **This is a living document.** AI agents should read this file when starting work and update it whenever changes affect the system architecture, project structure, or data flows.

## Overview

SubtitleGem is an AI-powered subtitle generation application that uses Google's Gemini API to automatically generate, translate, and style subtitles for video files. It supports bilingual subtitles, real-time preview, and FFmpeg-based video export with burned-in subtitles.

---

## 1. Project Structure

```
subtitlegem/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes (12 endpoints)
│   │   │   ├── download/       # File download handler
│   │   │   ├── drafts/         # Draft project persistence
│   │   │   ├── export/         # Video export with subtitles
│   │   │   ├── ffmpeg/         # FFmpeg capability detection
│   │   │   ├── models/         # Available Gemini models list
│   │   │   ├── process/        # Video upload + AI transcription
│   │   │   ├── queue/          # Job queue management
│   │   │   ├── settings/       # Global settings CRUD
│   │   │   ├── storage/        # File streaming handler
│   │   │   ├── stream/         # Live video transcoding
│   │   │   ├── translate/      # Subtitle translation
│   │   │   └── video-info/     # Video metadata probe
│   │   ├── globals.css         # Tailwind + global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main application page
│   │
  │   ├── components/             # React UI Components (21 files)
  │   │   ├── ConfigPanel.tsx     # Subtitle style configuration
  │   │   ├── DraftsSidebar.tsx   # Project drafts list (collapsible sidebar)
  │   │   ├── ExportControls.tsx  # Export button + options
  │   │   ├── FFmpegConfigPanel.tsx # Hardware encoder settings
  │   │   ├── FindReplaceDialog.tsx # Find and replace in subtitles
  │   │   ├── GlobalSettingsDialog.tsx # App-wide settings
  │   │   ├── KeyboardShortcutsDialog.tsx # Shortcut reference overlay
  │   │   ├── MenuBar.tsx         # Top navigation bar (File, Edit, View, Help) with Recent Drafts submenu
  │   │   ├── ProjectSettingsDialog.tsx # Per-project settings
  │   │   ├── QueueDrawer.tsx     # Export queue overlay
  │   │   ├── ShiftTimingsDialog.tsx # Offset all subtitle times
  │   │   ├── SubtitleList.tsx    # Editable subtitle lines
  │   │   ├── SubtitleTimeline.tsx # Visual timeline editor (zoomable, scrubbable)
│   │   ├── TrackStyleEditor.tsx # Font/color/margin controls
│   │   ├── VideoPreview.tsx    # Video player with overlays
│   │   ├── VideoUpload.tsx     # Drag-drop file uploader
  │   │   └── ui/                 # Reusable UI primitives
  │   │       └── Menu.tsx        # Accessible dropdown menu (keyboard nav, ARIA, nested flyouts)
│   │
│   ├── lib/                    # Core Business Logic (17 files)
│   │   ├── ass-utils.ts        # ASS subtitle file generation
│   │   ├── draft-store.ts      # SQLite draft persistence
│   │   ├── ffmpeg-probe.ts     # FFmpeg capability detection
│   │   ├── ffmpeg-utils.ts     # Video processing (child_process)
│   │   ├── gemini.ts           # Google Gemini AI integration
│   │   ├── global-settings-store.ts # Settings persistence
│   │   ├── job-processor.ts    # Export job execution
│   │   ├── queue-db.ts         # SQLite queue persistence
│   │   ├── queue-manager.ts    # Job queue state machine
│   │   ├── srt-utils.ts        # SRT subtitle generation
│   │   ├── storage-config.ts   # File path configuration
│   │   ├── style-resolver.ts   # Style inheritance resolver
│   │   └── timeline-utils.ts   # Multi-video timeline calculations
│   │
│   ├── hooks/                  # Custom React Hooks
│   │   └── useSubtitleSync.ts  # Video-subtitle time sync
│   │
│   └── types/                  # TypeScript Definitions
│       └── subtitle.ts         # Core data types
│
├── public/                     # Static assets
├── storage/                    # Local SQLite databases (gitignored)
├── .env                        # Environment configuration
└── package.json                # Dependencies
```

---

## 2. High-Level System Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                             USER BROWSER                              │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │                        React Frontend                             │ │
│ │ ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐│ │
│ │ │ VideoUpload│  │SubtitleList│  │  Timeline  │  │  VideoPreview  ││ │
│ │ └─┬──────────┘  └─┬──────────┘  └─┬──────────┘  └──────┬─────────┘│ │
│ └───┼───────────────┼───────────────┼────────────────────┼──────────┘ │
└─────┼───────────────┼───────────────┼────────────────────┼────────────┘
      │               │               │                    │
      ▼               ▼               ▼                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         Next.js API Routes                            │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│ │/api/process│  │/api/export │  │/api/queue  │  │   /api/stream    │  │
│ │  (Upload)  │  │(Burn Subs) │  │ (Job Mgmt) │  │ (Live Transcode) │  │
│ └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────┬─────────┘  │
│       │               │               │                  │            │
│ ┌─────▼───────────────▼───────────────▼──────────────────▼──────────┐ │
│ │                        lib/ (Business Logic)                      │ │
│ │ ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────────┐   │ │
│ │ │gemini.ts │  │ffmpeg-   │  │queue-manager│  │  ass-utils.ts  │   │ │
│ │ │(AI Trans)│  │utils.ts  │  │    .ts      │  │ (Subtitle Gen) │   │ │
│ │ └────┬─────┘  └────┬─────┘  └──────┬──────┘  └────────────────┘   │ │
│ └──────┼─────────────┼───────────────┼──────────────────────────────┘ │
└────────┼─────────────┼───────────────┼────────────────────────────────┘
         │             │               │
         ▼             ▼               ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐
│  Google Gemini  │  │   FFmpeg    │  │     SQLite (better-sqlite3)     │
│  (AI Service)   │  │  (System)   │  │ • queue.db    • drafts.db       │
└─────────────────┘  └─────────────┘  │ • settings.db                   │
                                      └─────────────────────────────────┘
```

---

## 3. Core Components

### 3.1. Frontend (Next.js React)

**Name:** SubtitleGem Web App  
**Description:** Single-page application for video subtitle editing. Users upload videos, AI generates subtitles, users edit/style them, then export with burned-in text.  
**Technologies:** React 19, Next.js 16 (App Router), Tailwind CSS 4, Lucide Icons  
**Deployment:** Self-hosted (designed for local/private server deployment)

### 3.2. Backend Services

#### 3.2.1. Video Processing Service
**Endpoints:** `/api/process`, `/api/stream`, `/api/video-info`  
**Description:** Handles video upload, audio extraction for large files (>400MB), live transcoding for browser-incompatible formats, and metadata probing.  
**Technologies:** Node.js (child_process.spawn), FFmpeg (system binary)  
**Key Functions:**
- `ffprobe()` - JSON metadata extraction
- `getVideoDimensions()` - Resolution detection
- `burnSubtitles()` - Subtitle embedding
- Live H.264/AAC transcoding stream

#### 3.2.2. AI Transcription Service
**Endpoint:** `/api/process` (POST with video)  
**Description:** Sends audio/video to Google Gemini for automatic speech recognition and bilingual translation.  
**Technologies:** `@google/genai` SDK, Gemini 2.0 Flash  
**Key Functions:**
- `generateSubtitles()` - Full video transcription
- `generateSubtitlesInline()` - Small file (<10MB) inline processing
- `translateSubtitles()` - Re-translation to different language

#### 3.2.3. Export Queue Service
**Endpoints:** `/api/queue`, `/api/export`  
**Description:** Manages background video rendering jobs with SQLite persistence, crash recovery, and progress tracking.  
**Technologies:** SQLite (better-sqlite3), Event-driven job processor  
**Key Classes:**
- `QueueManager` - Singleton state machine (pending/processing/completed/failed)
- `JobProcessor` - FFmpeg execution with progress callbacks

---

## 4. Data Stores

### 4.1. Queue Database
**File:** `{STAGING_DIR}/queue.db`  
**Type:** SQLite (WAL mode)  
**Purpose:** Persistent export job queue, survives server restarts  
**Tables:**
- `queue_items` - Job state, progress, file paths, errors
- `queue_state` - Global pause/resume state

### 4.2. Drafts Database  
**File:** `{STAGING_DIR}/drafts.db`  
**Type:** SQLite  
**Purpose:** Auto-saved project drafts  
**Tables:**
- `drafts` - Project JSON, video path, metadata

### 4.3. Settings Database
**File:** `{STAGING_DIR}/settings.db`  
**Type:** SQLite  
**Purpose:** Global application settings  
**Tables:**
- `settings` - Key-value pairs for defaults

### 4.4. File Storage
**Directory:** `{STAGING_DIR}/` (configured via `STAGING_DIR` env var)  
**Structure:**
- `videos/` - Uploaded source videos
- `exports/` - Rendered output videos
- `temp/` - Processing intermediates
- `backups/` - Project configuration backups

### 4.5. File Integrity Index
**Mechanism:** `VideoClip` objects store `fileSize` (bytes) and `originalFilename`.
**Verification:** On project load, the system probes the staging directory.
- **Status OK:** File exists and size matches.
- **Status MISSING:** File not found at recorded path.
- **Status MISMATCH:** File exists but size differs (potentially corrupted or replaced).

---

## 5. External Integrations

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Google Gemini API** | AI transcription + translation | `@google/genai` SDK, API key auth |
| **FFmpeg** | Video/audio processing | System binary via `child_process.spawn` |

---

## 6. Deployment & Infrastructure

**Target Environment:** Self-hosted Linux server  
**Cloud Provider:** N/A (designed for local deployment)  
**Key System Dependencies:**
- Node.js 20+
- FFmpeg (with `libx264`, optionally hardware encoders)
- Noto Sans CJK font (for Chinese subtitle rendering)

**Recommended Nginx Config:** See `nginx.conf.example`  
**CI/CD:** None (manual deployment)  
**Monitoring:** Console logging only

---

## 7. Security Considerations

| Aspect | Implementation |
|--------|---------------|
| **Authentication** | None (designed for single-user/trusted network) |
| **Authorization** | None |
| **API Key Storage** | `.env` file (`GEMINI_API_KEY`) |
| **File Access** | Limited to `STAGING_DIR` path |
| **Input Validation** | Path traversal prevention in `/api/storage` |

⚠️ **Warning:** This application is NOT designed for public internet exposure. Use behind firewall or VPN.

---

## 8. Development & Testing

### Local Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# Set staging directory (optional, defaults to ./storage)
echo "STAGING_DIR=/path/to/storage" >> .env

# Run development server
npm run dev -- -H 0.0.0.0
```

### Testing
**Framework:** Jest  
**Test Files:** `*.test.ts` in `src/lib/`  
**Run:** `npm test`

### Code Quality
- ESLint with Next.js config
- TypeScript strict mode

---

## 9. Key Data Flows

### 9.1. Video Upload → Subtitles
```
User uploads video
    → /api/process receives file
    → File saved to {STAGING_DIR}/temp/
    → If >400MB: Extract audio only
    → If <10MB: Send inline to Gemini
    → Otherwise: Upload to Gemini Files API
    → Gemini returns JSON subtitles
    → Response sent to frontend
    → Auto-saved as draft
```

### 9.2. Export → Rendered Video
```
User clicks Export
    → /api/export receives config
    → getVideoDimensions() probes video
    → generateAss() creates subtitle file (using actual resolution)
    → Job added to QueueManager
    → JobProcessor executes FFmpeg with:
        - ASS subtitles filter
        - Optional hardware encoding
        - Progress callbacks
    → Completed file in {STAGING_DIR}/exports/
    → User downloads via /api/download

### 9.3. Re-link / Re-upload Flow
```
User detects "Missing File" in Video Library
    → Clicks "Relinks" button
    → Selects replacement file
    → Frontend validates filename and size (integrity check)
    → If valid: Uploads replacement (or updates path)
    → State updated: missing=false, filePath=newPath
    → Subtitles preserved (no regeneration)
```
```

---

## 10. Project Identification

| Field | Value |
|-------|-------|
| **Project Name** | SubtitleGem |
| **Repository URL** | https://github.com/segin/subtitlegem |
| **Primary Contact** | segin |
| **Date of Last Update** | 2026-01-01 |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **ASS** | Advanced SubStation Alpha - subtitle format with styling support |
| **SRT** | SubRip Text - simple subtitle format |
| **PlayRes** | ASS file resolution reference (styles scale proportionally) |
| **CRF** | Constant Rate Factor - video quality setting (lower = better) |
| **hwaccel** | Hardware acceleration (NVENC, QSV, etc.) |
| **STAGING_DIR** | Root directory for all file storage |
