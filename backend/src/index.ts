import express from 'express';
import cors from 'cors';
import { mediaRouter } from './routes/media';
import { fileRouter } from './routes/files';
import { downloadsRouter } from './routes/downloads';
import { startCleanup } from './cleanup';

const app = express();
const PORT = parseInt(process.env.PORT || '7860', 10);

// FRONTEND_URL accepts a comma-separated list, e.g.:
//   https://my-app.vercel.app,https://my-app-git-main-me.vercel.app
const rawOrigins = process.env.FRONTEND_URL;
const allowedOrigins: string[] | boolean = rawOrigins
  ? rawOrigins.split(',').map(s => s.trim())
  : true; // fallback: allow all (only for local dev)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  // SSE needs these headers exposed to the browser
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
}));
app.use(express.json());

app.use('/api/media', mediaRouter);
app.use('/api/files', fileRouter);
app.use('/api/downloads', downloadsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

startCleanup();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Riptide backend running on :${PORT}`);
});
