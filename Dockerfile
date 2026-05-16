# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
# TS source files live at repo root (not in src/); copy them into src/ for tsc
COPY *.ts ./src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache \
    ffmpeg \
    curl \
    python3 \
    py3-pip \
    ca-certificates

RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

RUN addgroup -S app && adduser -S -u 1000 -G app app

WORKDIR /app
COPY --chown=app:app package.json ./
RUN npm install --omit=dev && chown -R app:app /app/node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
RUN mkdir -p /downloads && chown app:app /downloads

VOLUME ["/downloads"]

ENV NODE_ENV=production
ENV PORT=7860
ENV DOWNLOADS_DIR=/downloads

EXPOSE 7860

USER app
CMD ["node", "dist/index.js"]
