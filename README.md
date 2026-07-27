# TodoList — Personal Local Task Manager

A self-contained, fully local task management web app with white noise, immersion mode, and a tree-structured idea capture system. All data lives on your disk — no cloud, no servers, no internet required.

---

## Features

### 📋 Task Management
- Create, edit, rename, and delete tasks (todos)
- Start / Pause / Resume / Complete with **live time tracking**
- Each task accumulates total focused time across sessions
- Server auto-saves if killed unexpectedly

### 🧘 Immersion Mode
- One-click "Start" from the task list → enters full‑screen zen mode
- Shows a live timer + task title + New Idea sidebar
- Pause / Continue toggle **on the same screen** — no page switching
- Exit returns to the task list, still in the same session

### 💡 New Idea System
- While in immersion mode, type ideas in the left panel (Enter to add)
- **Promote** any idea to a full task with one click
- **Tree view** at `/ideas`: all ideas grouped hierarchically
  - Create nested child ideas (recursive)
  - **Drag & drop** to re-parent ideas or assign to categories
  - Drag to **root drop zone** to detach from parent
- Export the entire idea tree as **TXT**, **Markdown**, or **Word (.doc)**

### 📁 Category System
- Organize ideas into customizable categories
- Each category has a **color** (picked from 15 distinct colors, auto-assigns unused)
- Categories show as colored badges on idea nodes
- Filter ideas by category in the tree view
- Drag ideas directly onto a category in the sidebar to assign

### 🎵 White Noise
- Upload audio files (mp3, wav, ogg, m4a, flac, webm — up to 200 MB)
- Play / pause from the sidebar mini-player or immersion mode controls
- **Auto‑play** when starting a task, **auto‑pause** when completing/pausing
- Track progress bar + volume slider in immersion mode
- Switch tracks via dropdown or immersion music controls

### ⏱ Time Tracking & Level System
- Every task logs **time segments** (start → pause / complete)
- Profile page (`/profile`) shows:
  - Total focused time across all tasks
  - **Level progression** based on cumulative hours
    - Lv.1 = 0h → Lv.2 = 5h → Lv.3 = 15h → Lv.4 = 30h → ... → Lv.9 = 800h
  - XP‑style progress bar to next level
  - Completed task count

### 📋 System Logs
- Every action is logged (DB + file at `server/logs/app.log`)
- View logs at `/logs` in a dark monospace terminal style
- Clear logs from the UI

---

## Screenshots (Routes)

| Route | Description |
|---|---|
| `/todos` | Task list — create, start, pause, complete, delete |
| `/todos/:id` | Immersion mode (auto‑entered on Start) |
| `/ideas` | New Idea tree view with drag & drop + category filter |
| `/categories` | Manage categories, assign colors |
| `/audio` | Upload and manage white noise tracks |
| `/profile` | Stats, level, white noise controls, logs shortcut |
| `/logs` | System event log |

---

## Quick Start

### Prerequisites
- **Node.js** ≥ 18 (tested on v24)
- **npm** ≥ 9

### Setup

```bash
# Clone (or copy the repo)
git clone <repo-url> TodoList
cd TodoList

# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Run

**Double-click** `start.bat` (Windows), or:

```bash
npm run dev
```

This starts both:
- **Backend** → `http://localhost:3001` (Express + SQLite)
- **Frontend** → `http://localhost:5173` (Vite + React)

Open `http://localhost:5173` in your browser.

### First Run
- The database is created automatically at `server/data/todolist.db`
- Sample data (5 categories, 4 tasks, 11 ideas) is pre-loaded
- Upload your own audio files at `/audio` to enable white noise

---

## Data Storage

| Data | Location |
|---|---|
| Database | `server/data/todolist.db` |
| Audio files | `server/data/audio/` |
| Logs | `server/logs/app.log` |

All user data stays in `server/data/` — **safe to delete** for a clean reset, or **excluded from git** by default.

---

## Updating via Git Pull

### ✅ You can pull updates safely — your data won't be touched

**Why it works:**
- All user data lives in `server/data/` (excluded in `.gitignore`)
- Source code is in `server/src/` and `client/src/`
- `git pull` only overwrites tracked source files, **never** ignores files

### Update procedure:

```bash
# 1. Make sure the server is stopped
# 2. Pull latest code
git pull

# 3. Re-install dependencies (in case packages changed)
cd server && npm install && cd ..
cd client && npm install && cd ..

# 4. Start again
npm run dev
```

### ⚠️ What might require manual migration:
If an update adds a **new database column**, the server auto‑migrates on startup (see `db.cjs` — uses `ALTER TABLE ADD COLUMN` wrapped in try/catch). Your existing data is **preserved**.

If an update **removes or renames a table**, the release notes will call this out with a migration step.

### 🧪 Verifying after update:
1. Check that your tasks and ideas still appear
2. Check that audio files still play
3. Check the logs at `/logs` for any startup errors

---

## Project Structure (tracked in git)

```
TodoList/
├── package.json                # Root — concurrently to start both
├── start.bat                   # One-click launcher (Windows)
├── start.ps1                   # PowerShell launcher
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Express entry + graceful shutdown
│       ├── db.cjs              # SQLite init (CJS for better-sqlite3)
│       ├── db.ts               # Re-export for ESM compat
│       ├── logger.ts           # DB + file dual logger
│       └── routes/
│           ├── todos.ts        # Tasks CRUD + time tracking
│           ├── newIdeas.ts     # Ideas CRUD + promote + export
│           ├── categories.ts   # Categories CRUD + color
│           └── audio.ts        # Audio upload / serve / delete
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── palette.ts          # Color palette for categories
        ├── api/index.ts        # API client
        ├── types/index.ts      # TypeScript types
        ├── contexts/
        │   └── WhiteNoiseContext.tsx
        ├── components/
        │   ├── Sidebar.tsx
        │   ├── MiniPlayer.tsx
        │   ├── TodoList.tsx
        │   ├── TodoDetail.tsx
        │   ├── ImmersionView.tsx
        │   ├── NewIdeasPage.tsx
        │   ├── IdeaNode.tsx
        │   ├── CategoriesPage.tsx
        │   ├── AudioPage.tsx
        │   ├── ProfilePage.tsx
        │   └── LogsPage.tsx
        └── styles/
            ├── global.css
            ├── sidebar.css
            ├── todo.css
            ├── idea.css
            ├── category.css
            └── audio.css
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + TypeScript |
| Frontend | React 18 + Vite + TypeScript |
| Database | SQLite (better-sqlite3) |
| Drag & Drop | @dnd-kit |
| Audio | HTML5 `<audio>` |
| Style | Pure CSS (warm palette) |
