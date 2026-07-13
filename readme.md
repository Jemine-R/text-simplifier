# GRANULAR TEXT SIMPLIFIER.
_A Final Year Project by [Edema Oritsejeminetemi](https://github.com/Jemine-R)_

## Project Stack
- **React + TypeScript + Vite frontend**
- **Express + TypeScript backend**
- **SQLite (local) / PostgreSQL (production)**
- **Google Gemini AI**
- **pnpm**

## How to Run

### Install frontend deps
- _pnpm install_

### Install backend deps
-  _cd backend && pnpm install_

### Start backend (port 3000)
- _cd backend && pnpm run dev_

### Start frontend (port 5173) — in a separate terminal
- _pnpm run dev_

## Environment variables

- .env @(_root_) — VITE_API_URL, GEMINI_API_KEY
- .env @(_backend_) — DATABASE_URL, PORT, NODE_ENV

## Deployment guide

- ### Railway (backend + PostgreSQL):
  1. Create Railway project
  2. Add PostgreSQL service → copy private networking URL
  3. Add backend service → root dir = /backend
  4. Set env vars: DATABASE_URL (private URL), NODE_ENV=production
  5. Build command: pnpm install, start command: pnpm start
- ### Vercel (frontend):
  1. Connect GitHub repo
  2. Framework: Vite, build: pnpm install && pnpm run build, output: dist
  3. Set env vars: VITE_API_URL=https://your-backend.up.railway.app, GEMINI_API_KEY=...
  4. Deploy