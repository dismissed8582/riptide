# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

# Install system deps: ffmpeg, wget, curl, python3 (for yt-dlp)
RUN apk add --no-cache \
    ffmpeg \
    wget \
    curl \
    python3 \
    py3-pip \
    ca-certificates

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy backend build
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/package.json ./backend/package.json

# Copy frontend build into location backend will serve
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Downloads volume
RUN mkdir -p /downloads
VOLUME ["/downloads"]

ENV NODE_ENV=production
ENV PORT=3001
ENV DOWNLOADS_DIR=/downloads

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
