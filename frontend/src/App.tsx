import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Waves,
  Trash2,
  FileDown,
  Music,
  Video,
  Link,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import {
  startMediaDownload,
  startFileDownload,
  subscribeProgress,
  listDownloads,
  deleteDownload,
  downloadFileUrl,
  DownloadRecord,
  ProgressEvent,
} from './api';

interface ActiveDownload {
  id: string;
  url: string;
  type: 'media' | 'file';
  filename: string;
  percent: number;
  speed?: string;
  eta?: string;
  total?: string;
  status: 'downloading' | 'done' | 'error';
  error?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function App() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'media' | 'file'>('media');
  const [extractAudio, setExtractAudio] = useState(false);
  const [resolution, setResolution] = useState('best');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [active, setActive] = useState<ActiveDownload[]>([]);
  const [history, setHistory] = useState<DownloadRecord[]>([]);

  const refreshHistory = useCallback(async () => {
    try {
      const records = await listDownloads();
      setHistory(records.filter(r => r.status !== 'downloading'));
    } catch (_e) {
      // ignore errors silently
    }
  }, []);

  useEffect(() => {
    refreshHistory();
    const iv = setInterval(refreshHistory, 5000);
    return () => clearInterval(iv);
  }, [refreshHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      let id: string;
      if (mode === 'media') {
        id = await startMediaDownload(url.trim(), extractAudio, resolution);
      } else {
        id = await startFileDownload(url.trim());
      }

      const newDl: ActiveDownload = {
        id,
        url: url.trim(),
        type: mode,
        filename: 'Fetching...',
        percent: 0,
        status: 'downloading',
      };
      setActive(prev => [newDl, ...prev]);
      setUrl('');

      const unsub = subscribeProgress(
        mode,
        id,
        (data: ProgressEvent) => {
          setActive(prev =>
            prev.map(d =>
              d.id === id
                ? { ...d, percent: data.percent, speed: data.speed, eta: data.eta, total: data.total }
                : d,
            ),
          );
        },
        (data) => {
          setActive(prev =>
            prev.map(d => d.id === id ? { ...d, status: 'done', percent: 100, filename: data.filename } : d),
          );
          setTimeout(() => {
            setActive(prev => prev.filter(d => d.id !== id));
            refreshHistory();
          }, 3000);
          unsub();
        },
        (data) => {
          setActive(prev =>
            prev.map(d => d.id === id ? { ...d, status: 'error', error: data.message } : d),
          );
          unsub();
        },
      );
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteDownload(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Waves className="text-cyan-400 w-6 h-6" />
          <span className="text-xl font-bold">Riptide</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Download Form */}
        <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="Paste URL (video, audio, PDF, ZIP...)"
                  className="w-full bg-gray-800 text-gray-100 rounded-xl pl-10 pr-4 py-3 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !url.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-gray-950 font-bold px-5 py-3 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">{submitting ? 'Starting...' : 'Download'}</span>
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setMode('media')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'media' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Video className="w-4 h-4" />
                Media (yt-dlp)
              </button>
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'file' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileDown className="w-4 h-4" />
                Direct File
              </button>
            </div>

            {/* Media Options */}
            {mode === 'media' && (
              <div className="space-y-3">
                {/* Extract Audio Toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Music className="w-4 h-4 text-cyan-400" />
                    Extract Audio (MP3)
                  </div>
                  <div
                    onClick={() => setExtractAudio(p => !p)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                      extractAudio ? 'bg-cyan-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        extractAudio ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </label>

                {/* Resolution Selector */}
                {!extractAudio && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Resolution</span>
                    <div className="relative">
                      <select
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        className="appearance-none bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 pr-8 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                      >
                        <option value="best">Best</option>
                        <option value="1080">1080p</option>
                        <option value="720">720p</option>
                        <option value="480">480p</option>
                        <option value="360">360p</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {submitError}
              </p>
            )}
          </form>
        </section>

        {/* Active Downloads */}
        {active.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Downloads</h2>
            <div className="space-y-3">
              {active.map(dl => (
                <div key={dl.id} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate">
                        {dl.filename === 'Fetching...' ? (
                          <span className="text-gray-500">{(() => { try { return new URL(dl.url).hostname; } catch { return dl.url; } })()}</span>
                        ) : dl.filename}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{dl.url}</p>
                    </div>
                    <div className="shrink-0">
                      {dl.status === 'done' && <CheckCircle className="w-5 h-5 text-green-400" />}
                      {dl.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                      {dl.status === 'downloading' && <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />}
                    </div>
                  </div>

                  {dl.status === 'downloading' && (
                    <>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                        <div
                          className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${dl.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{dl.percent.toFixed(1)}%{dl.total ? ` of ${dl.total}` : ''}</span>
                        <span>{dl.speed ?? ''}{dl.eta ? ` ETA ${dl.eta}` : ''}</span>
                      </div>
                    </>
                  )}

                  {dl.status === 'done' && (
                    <div className="text-xs text-green-400">Complete</div>
                  )}

                  {dl.status === 'error' && (
                    <div className="text-xs text-red-400 truncate">{dl.error}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">History</h2>
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No downloads yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(record => (
                <div
                  key={record.id}
                  className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center gap-3"
                >
                  <div className="shrink-0 text-gray-600">
                    {record.type === 'media' ? <Video className="w-5 h-5" /> : <FileDown className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{record.filename}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(record.createdAt)}
                      {record.size ? ` · ${formatBytes(record.size)}` : ''}
                    </p>
                    {record.status === 'error' && (
                      <p className="text-xs text-red-400 truncate">{record.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {record.status === 'done' && (
                      <a
                        href={downloadFileUrl(record.id)}
                        download={record.filename}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
