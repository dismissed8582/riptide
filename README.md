# Riptide

A self-hosted, all-in-one downloader web app. Grab videos, audio, and direct files from anywhere — runs entirely in Docker.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/riptide)
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
- **Mobile-first dark UI** built with React 18, Tailwind CSS, and Lucide icons

## Deploy

> GitHub Pages only serves static HTML — Riptide needs a Node.js runtime. Use one of the options below.

### Option 1 — Railway (easiest, ~$5/mo)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select this repository — Railway auto-detects the Dockerfile
3. Add a **Volume** mounted at `/downloads` for persistent storage
4. Click **Deploy**

Railway exposes a public URL automatically. No extra config files needed.

### Option 2 — Fly.io (free tier available)

Fly.io has a free allowance (3 shared VMs, 3 GB storage). Auto-deploys from GitHub on every push via the included Actions workflow.

**First deploy (one-time setup):**
```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy   # uses fly.toml, pick a unique app name when prompted
fly volumes create riptide_downloads --size 3
fly deploy
```

**Subsequent deploys — automatic via GitHub Actions:**

1. Go to your repo → **Settings → Secrets → Actions**
2. Add secret `FLY_API_TOKEN` → value from `fly auth token`
3. Every push to `main` now auto-deploys

### Option 3 — Render.com (~$7/mo)

Click the **Deploy to Render** button above. Render reads `render.yaml` and provisions the service + a 10 GB persistent disk automatically.

### Option 4 — Any VPS (Docker)

Every push to `main` builds and publishes to GitHub Container Registry. Pull on any host:

```bash
docker run -d \
  --name riptide \
  -p 3001:3001 \
  -v riptide-downloads:/downloads \
  --restart unless-stopped \
  ghcr.io/dismissed8582/riptide:latest
```

Or with Docker Compose:

```yaml
services:
  riptide:
    image: ghcr.io/dismissed8582/riptide:latest
    ports:
      - "3001:3001"
    volumes:
      - downloads:/downloads
    restart: unless-stopped

volumes:
  downloads:
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on |
| `DOWNLOADS_DIR` | `/downloads` | Where downloaded files are stored |

> ⚠️ Riptide has no built-in authentication. If you expose it to the public internet, put it behind a reverse proxy with basic auth (Caddy, nginx) or a tunnel like Tailscale / Cloudflare Access.

## Local Development

Requires Node.js 20+, `yt-dlp`, `ffmpeg`, and `curl` installed locally.

```bash
cp .env.example .env          # fill in your values

cd backend && npm install
cd ../frontend && npm install

# Two terminals:
cd backend && npm run dev     # API on :3001
cd frontend && npm run dev    # UI on :5173 (proxies /api to backend)
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

Progress streaming uses Server-Sent Events over a `fetch`-based reader so `Authorization: Bearer` headers work. Events are buffered server-side so a late-connecting SSE client still receives the full history.

## Binaries in the Docker image

| Binary | Purpose |
|---|---|
| `yt-dlp` | Media downloads (latest release, fetched at build time) |
| `ffmpeg` + `ffprobe` | Audio extraction, format merging |
| `curl` | Direct file downloads |
| `wget` | Available as fallback |
