import { Router, Request, Response } from 'express';
import fs from 'fs';
import { requireAuth } from '../auth';

export interface DownloadRecord {
  id: string;
  filename: string;
  url: string;
  type: 'media' | 'file';
  status: 'downloading' | 'done' | 'error';
  filePath: string;
  size?: number;
  createdAt: number;
  error?: string;
}

const store = new Map<string, DownloadRecord>();

export function addDownloadRecord(record: DownloadRecord) {
  store.set(record.id, record);
}

export function updateDownloadRecord(id: string, updates: Partial<DownloadRecord>) {
  const existing = store.get(id);
  if (existing) store.set(id, { ...existing, ...updates });
}

export function getDownloadRecord(id: string): DownloadRecord | undefined {
  return store.get(id);
}

export const downloadsRouter = Router();
downloadsRouter.use(requireAuth);

downloadsRouter.get('/', (_req: Request, res: Response) => {
  const list = Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

downloadsRouter.delete('/:id', (req: Request, res: Response) => {
  const record = store.get(req.params.id);
  if (!record) { res.status(404).json({ error: 'Not found' }); return; }
  if (fs.existsSync(record.filePath)) {
    try { fs.unlinkSync(record.filePath); } catch {}
  }
  store.delete(req.params.id);
  res.json({ ok: true });
});

downloadsRouter.get('/:id/file', (req: Request, res: Response) => {
  const record = store.get(req.params.id);
  if (!record || record.status !== 'done') { res.status(404).json({ error: 'Not found' }); return; }
  if (!fs.existsSync(record.filePath)) { res.status(404).json({ error: 'File missing' }); return; }
  res.download(record.filePath, record.filename);
});
