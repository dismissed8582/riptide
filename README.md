# Riptide

A self-hosted, all-in-one downloader web app. Grab videos, audio, and direct files from anywhere — runs entirely in Docker.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dismissed8582/riptide)
[![Build & Publish](https://github.com/dismissed8582/riptide/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/dismissed8582/riptide/actions/workflows/docker-publish.yml)

## Features

- **Media downloads** via `yt-dlp` — YouTube, Twitter, Twitch, SoundCloud, and [thousands more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- **Audio extraction** — rip MP3 at best quality with one toggle
- **Resolution selector** — Best / 1080p / 720p / 480p / 360p
- **Direct file downloads** via `curl` — PDFs, ZIPs, ISOs, anything with a URL
- **Real-time progress** streamed over SSE — percentage, speed, ETA
- **Download history** with in-browser download and delete buttons
- **Auto-cleanup** — files older than 2 hours are deleted automatically every 15 minutes
- **JWT authentication** — single password, stateless tokens
- **Mobile-first dark UI** built with React 18, Tailwind CSS, and Lucide icons

## Deploy

### Option 1 — Render.com (one click)

Click the **Deploy to Render** button above. Set `RIPTIDE_PASSWORD` when prompted. Render will build the Dockerfile and mount a 10 GB persistent disk at `/downloads`.

> Requires a [Render](https://render.com) account. The **Starter** plan (~$7/mo) is needed for the persistent disk; the free tier uses ephemeral storage (files vanish on restart).

### Option 2 — GitHub Container Registry + any host

Every push to `main` builds and publishes the image to GHCR automatically via GitHub Actions. Pull it on any Docker host:

```bash
docker run -d \
  --name riptide \
  -p 3001:3001 \
  -e RIPTIDE_PASSWORD=yourpassword \
  -e JWT_SECRET=changethis \
  -v riptide-downloads:/downloads \
  ghcr.io/dismissed8582/riptide:latest
```

### Option 3 — Docker Compose (self-hosted VPS)

```yaml
services:
  riptide:
    image: ghcr.io/dismissed8582/riptide:latest
    ports:
      - "3001:3001"
    environment:
      RIPTIDE_PASSWORD: yourpassword
      JWT_SECRET: changethis
    volumes:
      - downloads:/downloads
    restart: unless-stopped

volumes:
  downloads:
```

```bash
docker compose up -d
```

Open [http://localhost:3001](http://localhost:3001) and sign in with your password.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RIPTIDE_PASSWORD` | `changeme` | Login password |
| `JWT_SECRET` | `riptide-secret` | Secret used to sign JWT tokens |
| `PORT` | `3001` | Port the server listens on |
| `DOWNLOADS_DIR` | `/downloads` | Where downloaded files are stored |

## Local Development

Requires Node.js 20+, `yt-dlp`, `ffmpeg`, and `curl` installed locally.

```bash
# Copy env file and fill in values
cp .env.example .env

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run backend (port 3001) and frontend (port 5173) in separate terminals
cd backend && npm run dev
cd frontend && npm run dev
```

The frontend dev server proxies `/api` requests to the backend automatically.

## Building

```bash
# Build backend TypeScript
cd backend && npm run build

# Build frontend
cd frontend && npm run build

# Build Docker image
docker build -t riptide .
```

## Architecture

```
riptide/
├── backend/                  # Express + TypeScript API
│   └── src/
│       ├── index.ts          # App entry, static serving
│       ├── auth.ts           # JWT login + middleware
│       ├── cleanup.ts        # Background file TTL cleanup
│       └── routes/
│           ├── media.ts      # yt-dlp controller + SSE
│           ├── files.ts      # curl controller + SSE
│           └── downloads.ts  # List / delete / serve files
└── frontend/                 # React 18 + Vite + Tailwind
    └── src/
        ├── App.tsx           # Main UI component
        └── api.ts            # Fetch client + SSE reader
```

**Progress streaming** uses Server-Sent Events over a `fetch`-based reader (not native `EventSource`) so `Authorization: Bearer` headers work without CORS issues. Events are buffered server-side so a late-connecting client still receives the full history.

## Binaries Included (Docker image)

| Binary | Purpose |
|---|---|
| `yt-dlp` | Media downloads (latest release, fetched at build time) |
| `ffmpeg` + `ffprobe` | Audio extraction, format merging |
| `curl` | Direct file downloads |
| `wget` | Available as fallback |
