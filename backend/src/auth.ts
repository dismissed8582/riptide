import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'riptide-secret';
const PASSWORD = process.env.RIPTIDE_PASSWORD || 'changeme';

authRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== PASSWORD) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const token = jwt.sign({ app: 'riptide' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
