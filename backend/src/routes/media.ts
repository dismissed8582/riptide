import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { addDownloadRecord, updateDownloadRecord } from './downloads';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '../../../downloads');

// pending SSE clients waiting for progress: id -> Response
const sseClients = new Map<string, Response>();
// buffer of events for late-connecting SSE clients
const eventBuffer = new Map<string, Array<{ event: string; data: unknown }>>();

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function bufferAndSend(id: string, event: string, data: unknown) {
  const buf = eventBuffer.get(id) || [];
  buf.push({ event, data });
  eventBuffer.set(id, buf);
  const client = sseClients.get(id);
  if (client) sendSSE(client, event, data);
}

export const mediaRouter = Router();

mediaRouter.post('/start', (req: Request, res: Response) => {
  const { url, extractAudio, resolution } = req.body as {
    url?: string;
    extractAudio?: boolean;
    resolution?: string;
  };

  if (!url || !/^https?:\/\/.+/.test(url)) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  const id = uuidv4();
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const outputTemplate = path.join(DOWNLOADS_DIR, `${id}_%(title)s.%(ext)s`);

  let args: string[];
  if (extractAudio) {
    args = [
      '--no-playlist',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--newline',
      '-o', outputTemplate,
      url,
    ];
  } else {
    const res_num = resolution && resolution !== 'best' ? resolution : null;
    const formatStr = res_num
      ? `bestvideo[height<=${res_num}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${res_num}]+bestaudio/best[height<=${res_num}]/best`
      : `bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
    args = [
      '--no-playlist',
      '-f', formatStr,
      '--merge-output-format', 'mp4',
      '--newline',
      '-o', outputTemplate,
      url,
    ];
  }

  const expectedExt = extractAudio ? 'mp3' : 'mp4';
  const record = {
    id,
    filename: `download.${expectedExt}`,
    url,
    type: 'media' as const,
    status: 'downloading' as const,
    filePath: path.join(DOWNLOADS_DIR, `${id}_download.${expectedExt}`),
    createdAt: Date.now(),
  };
  addDownloadRecord(record);

  res.json({ id });

  const proc = spawn('yt-dlp', args);
  const progressRe = /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\d+:\d+)/;
  const filenameRe = /\[(?:ExtractAudio|Merger|ffmpeg|download)\].+Destination:\s*(.+)/;
  const mergeRe = /Merging formats into "(.+)"/;

  let detectedFilePath = '';
  let detectedFilename = '';

  const handleLine = (line: string) => {
    console.log(`[yt-dlp ${id}]`, line);
    const pm = line.match(progressRe);
    if (pm) {
      bufferAndSend(id, 'progress', {
        percent: parseFloat(pm[1]),
        total: pm[2],
        speed: pm[3],
        eta: pm[4],
      });
      return;
    }
    const mm = line.match(mergeRe);
    if (mm) {
      detectedFilePath = mm[1].trim();
      detectedFilename = path.basename(detectedFilePath);
      return;
    }
    const fm = line.match(filenameRe);
    if (fm) {
      detectedFilePath = fm[1].trim();
      detectedFilename = path.basename(detectedFilePath);
    }
  };

  let stdoutBuf = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() || '';
    lines.forEach(handleLine);
  });

  let stderrBuf = '';
  proc.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  proc.on('close', (code) => {
    if (stdoutBuf) handleLine(stdoutBuf);

    if (code === 0) {
      // Find the actual output file
      let finalPath = detectedFilePath;
      if (!finalPath || !fs.existsSync(finalPath)) {
        // Search downloads dir for file with our id prefix
        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          finalPath = path.join(DOWNLOADS_DIR, files[0]);
          detectedFilename = files[0].replace(`${id}_`, '');
        }
      }
      const size = finalPath && fs.existsSync(finalPath) ? fs.statSync(finalPath).size : 0;
      updateDownloadRecord(id, {
        status: 'done',
        filename: detectedFilename || record.filename,
        filePath: finalPath || record.filePath,
        size,
      });
      bufferAndSend(id, 'done', { id, filename: detectedFilename || record.filename });
    } else {
      const errMsg = stderrBuf.slice(-500) || `yt-dlp exited with code ${code}`;
      updateDownloadRecord(id, { status: 'error', error: errMsg });
      bufferAndSend(id, 'error', { message: errMsg });
    }
    setTimeout(() => eventBuffer.delete(id), 60000);
  });
});

mediaRouter.get('/progress/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Replay buffered events
  const buf = eventBuffer.get(id);
  if (buf) {
    for (const { event, data } of buf) {
      sendSSE(res, event, data);
    }
    // If already done/errored, close
    const last = buf[buf.length - 1];
    if (last && (last.event === 'done' || last.event === 'error')) {
      res.end();
      return;
    }
  }

  sseClients.set(id, res);
  req.on('close', () => { sseClients.delete(id); });
});
