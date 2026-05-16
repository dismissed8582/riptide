import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../auth';
import { addDownloadRecord, updateDownloadRecord } from './downloads';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '../../../downloads');

const sseClients = new Map<string, Response>();
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

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : 'download';
  } catch {
    return 'download';
  }
}

export const fileRouter = Router();
fileRouter.use(requireAuth);

fileRouter.post('/start', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url || !/^https?:\/\/.+/.test(url)) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  const id = uuidv4();
  const filename = filenameFromUrl(url);
  const outputPath = path.join(DOWNLOADS_DIR, `${id}_${filename}`);

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

  const record = {
    id,
    filename,
    url,
    type: 'file' as const,
    status: 'downloading' as const,
    filePath: outputPath,
    createdAt: Date.now(),
  };
  addDownloadRecord(record);

  res.json({ id });

  // Use curl: -L follow redirects, --progress-bar on stderr
  const args = ['-L', '--progress-bar', '-o', outputPath, url];
  const proc = spawn('curl', args);

  // curl --progress-bar writes to stderr lines like: ##########  50.0%
  // Parse percentage from stderr
  const percentRe = /(\d+(?:\.\d+)?)\s*%/;

  let stderrBuf = '';
  proc.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    // curl progress bar uses \r, split on \r
    const parts = stderrBuf.split(/[\r\n]/);
    stderrBuf = parts.pop() || '';
    for (const part of parts) {
      const m = part.match(percentRe);
      if (m) {
        bufferAndSend(id, 'progress', { percent: parseFloat(m[1]) });
      }
    }
  });

  proc.on('close', (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      const size = fs.statSync(outputPath).size;
      updateDownloadRecord(id, { status: 'done', size });
      bufferAndSend(id, 'done', { id, filename });
    } else {
      const errMsg = `curl exited with code ${code}`;
      updateDownloadRecord(id, { status: 'error', error: errMsg });
      bufferAndSend(id, 'error', { message: errMsg });
    }
    setTimeout(() => eventBuffer.delete(id), 60000);
  });
});

fileRouter.get('/progress/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const buf = eventBuffer.get(id);
  if (buf) {
    for (const { event, data } of buf) {
      sendSSE(res, event, data);
    }
    const last = buf[buf.length - 1];
    if (last && (last.event === 'done' || last.event === 'error')) {
      res.end();
      return;
    }
  }

  sseClients.set(id, res);
  req.on('close', () => { sseClients.delete(id); });
});
