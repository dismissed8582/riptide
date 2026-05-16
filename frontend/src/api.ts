const BASE = '/api';

let _token = localStorage.getItem('riptide_token') || '';

export function setToken(t: string) {
  _token = t;
  localStorage.setItem('riptide_token', t);
}

export function getToken() { return _token; }
export function clearToken() { _token = ''; localStorage.removeItem('riptide_token'); }

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` };
}

export async function login(password: string): Promise<string> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) throw new Error('Invalid password');
  const { token } = await r.json() as { token: string };
  setToken(token);
  return token;
}

export async function startMediaDownload(url: string, extractAudio: boolean, resolution: string): Promise<string> {
  const r = await fetch(`${BASE}/media/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url, extractAudio, resolution }),
  });
  if (!r.ok) { const e = await r.json() as { error: string }; throw new Error(e.error); }
  const { id } = await r.json() as { id: string };
  return id;
}

export async function startFileDownload(url: string): Promise<string> {
  const r = await fetch(`${BASE}/files/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!r.ok) { const e = await r.json() as { error: string }; throw new Error(e.error); }
  const { id } = await r.json() as { id: string };
  return id;
}

export function subscribeProgress(
  type: 'media' | 'file',
  id: string,
  onProgress: (data: ProgressEvent) => void,
  onDone: (data: DoneEvent) => void,
  onError: (data: ErrorEvent) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const resp = await fetch(`${BASE}/${type}/progress/${id}`, {
        headers: { Authorization: `Bearer ${_token}` },
        signal: controller.signal,
      });
      if (!resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let currentEvent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'progress') onProgress(data as ProgressEvent);
            else if (currentEvent === 'done') onDone(data as DoneEvent);
            else if (currentEvent === 'error') onError(data as ErrorEvent);
            currentEvent = '';
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        onError({ message: String(e) });
      }
    }
  })();

  return () => controller.abort();
}

export interface ProgressEvent {
  percent: number;
  total?: string;
  speed?: string;
  eta?: string;
}

export interface DoneEvent {
  id: string;
  filename: string;
}

export interface ErrorEvent {
  message: string;
}

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

export async function listDownloads(): Promise<DownloadRecord[]> {
  const r = await fetch(`${BASE}/downloads`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Failed to list downloads');
  return r.json() as Promise<DownloadRecord[]>;
}

export async function deleteDownload(id: string): Promise<void> {
  await fetch(`${BASE}/downloads/${id}`, { method: 'DELETE', headers: authHeaders() });
}

export function downloadFileUrl(id: string): string {
  return `${BASE}/downloads/${id}/file`;
}
