import fs from 'fs';
import path from 'path';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '../../downloads');
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function runCleanup() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return;
  const now = Date.now();
  const entries = fs.readdirSync(DOWNLOADS_DIR);
  for (const entry of entries) {
    const fullPath = path.join(DOWNLOADS_DIR, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && now - stat.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(fullPath);
        console.log(`[cleanup] Deleted old file: ${entry}`);
      }
    } catch (err) {
      console.error(`[cleanup] Error processing ${entry}:`, err);
    }
  }
}

export function startCleanup() {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  runCleanup();
  setInterval(runCleanup, INTERVAL_MS);
  console.log('[cleanup] Background cleanup started (15min interval, 2h TTL)');
}
