# ── Stage 1: TypeScript build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# System tools required by the routes (yt-dlp needs python3 + ffmpeg)
RUN apk add --no-cache \
    ffmpeg \
    curl \
    python3 \
    py3-pip \
    ca-certificates

# Latest yt-dlp standalone binary
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# ── Non-root user (UID 1000 required by Hugging Face Spaces) ──────────────────
RUN addgroup -S app && adduser -S -u 1000 -G app app

WORKDIR /app

# Install only production deps as root, then hand ownership to app user
COPY --chown=app:app package.json package-lock.json* ./
RUN npm ci --omit=dev && chown -R app:app /app/node_modules

# Copy compiled JS from builder stage
COPY --from=builder --chown=app:app /app/dist ./dist

# Writable downloads directory owned by app user
RUN mkdir -p /downloads && chown app:app /downloads

USER app

ENV NODE_ENV=production
ENV PORT=7860
ENV DOWNLOADS_DIR=/downloads
# Set at runtime in HF Space secrets:
# ENV FRONTEND_URL=https://your-app.vercel.app

EXPOSE 7860

CMD ["node", "dist/index.js"]
