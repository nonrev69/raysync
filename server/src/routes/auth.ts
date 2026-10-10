import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from '../db.js';
import type { User, AuthPayload } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'raysync-dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

const router = Router();

// Middleware to verify JWT
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthPayload;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as User | undefined;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const payload: AuthPayload = { userId: user.id, username: user.username, role: user.role as any };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  // Store session
  db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime("now", "+24 hours"))')
    .run(randomUUID(), user.id, token);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
      email: user.email,
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const fullUser = db.prepare('SELECT id, username, role, display_name, email, is_active FROM users WHERE id = ?').get(user.userId);
  if (!fullUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(fullUser);
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

// GET /api/auth/users (admin only)
router.get('/users', authenticateToken, requireRole('admin'), (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, role, display_name, email, is_active, created_at FROM users').all();
  res.json(users);
});

// POST /api/auth/users (admin only)
router.post('/users', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  const { username, password, role, display_name, email } = req.body;
  if (!username || !password || !display_name) {
    res.status(400).json({ error: 'Username, password, and display_name required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, username, password_hash, role, display_name, email) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, username, passwordHash, role || 'editor', display_name, email || null);

  res.status(201).json({ id, username, role: role || 'editor', display_name, email });
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, display_name, email, is_active, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (password) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, role = ?, display_name = ?, email = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?')
      .run(passwordHash, role || user.role, display_name || user.display_name, email ?? user.email, is_active ?? user.is_active, id);
  } else {
    db.prepare('UPDATE users SET role = ?, display_name = ?, email = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?')
      .run(role || user.role, display_name || user.display_name, email ?? user.email, is_active ?? user.is_active, id);
  }

  res.json({ success: true });
});

// DELETE /api/auth/users/:id (admin only)
router.delete('/users/:id', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
