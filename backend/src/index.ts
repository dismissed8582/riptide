import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './auth';
import { mediaRouter } from './routes/media';
import { fileRouter } from './routes/files';
import { downloadsRouter } from './routes/downloads';
import { startCleanup } from './cleanup';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/media', mediaRouter);
app.use('/api/files', fileRouter);
app.use('/api/downloads', downloadsRouter);

// Serve built frontend
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

startCleanup();

app.listen(PORT, () => {
  console.log(`Riptide backend running on :${PORT}`);
});
