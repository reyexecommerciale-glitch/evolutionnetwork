import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carica variabili ambiente
dotenv.config();

import { dbAdapter, Session } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_COOKIE = 'pw_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 giorni
const PRESENCE_WINDOW = 60 * 1000; // 60s ping

// --- Sessione corrente dal cookie ---
async function getCurrentSession(req: Request): Promise<{ session: Session; user: any } | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = await dbAdapter.getSession(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) return null;
  const user = await dbAdapter.getUserById(session.userId);
  if (!user) return null;
  return { session, user };
}

// --- Middlewares ---
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    (req as any).user = current.user;
    (req as any).session = current.session;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await getCurrentSession(req);
      if (!current) return res.status(401).json({ error: 'Non autenticato' });
      if (!roles.includes(current.user.role)) {
        return res.status(403).json({ error: 'Permessi insufficienti' });
      }
      (req as any).user = current.user;
      (req as any).session = current.session;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Maintenance mode: blocca tutto tranne admin e route auth/health
async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  try {
    const path = req.path;
    if (
      path === '/api/health' ||
      path === '/api/auth/me' ||
      path === '/api/auth/login' ||
      path === '/api/auth/logout' ||
      path === '/api/settings/public' ||
      !path.startsWith('/api/')
    ) {
      return next();
    }
    const settings = await dbAdapter.getSettings();
    if (!settings.maintenance) return next();

    // In maintenance: solo admin passa
    const current = await getCurrentSession(req);
    if (current && current.user.role === 'admin') return next();

    return res.status(503).json({
      error: 'maintenance',
      message: settings.maintenanceMessage,
    });
  } catch (err) {
    next(err);
  }
}

// Pulisce sessioni scadute
async function pruneSessions() {
  try {
    await dbAdapter.pruneSessions(SESSION_MAX_AGE);
  } catch (err) {
    console.warn('pruneSessions fallito:', err);
  }
}

const app = express();

app.use(express.json({ limit: '20mb' })); // 20mb per immagini base64
app.use(cookieParser());
app.use(maintenanceGate);

// Pulizia periodica sessioni (solo se non siamo in serverless Vercel)
if (!process.env.VERCEL) {
  setInterval(pruneSessions, 5 * 60 * 1000);
}

// ====================================================
//  HEALTH & SETTINGS PUBBLICI
// ====================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    storage: dbAdapter.isSupabase() ? 'supabase' : 'json',
    env: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/settings/public', async (req, res) => {
  try {
    const settings = await dbAdapter.getSettings();
    res.json({
      maintenance: settings.maintenance,
      maintenanceMessage: settings.maintenanceMessage,
      siteName: settings.siteName,
      siteTagline: settings.siteTagline,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

// ====================================================
//  AUTH
// ====================================================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Compila tutti i campi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password troppo corta (min 6).' });
  }
  try {
    const exists = await dbAdapter.getUserByEmail(email);
    if (exists) {
      return res.status(409).json({ error: 'Email già registrata.' });
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
      role: 'subscriber' as const,
      createdAt: new Date().toISOString(),
    };
    await dbAdapter.createUser(newUser);

    // Crea sessione immediata
    const session: Session = {
      token: crypto.randomBytes(32).toString('hex'),
      userId: newUser.id,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    await dbAdapter.createSession(session);

    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      sameSite: 'lax',
    });

    const { password: _p, ...userSafe } = newUser;
    res.json({ success: true, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: 'Registrazione fallita' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password richiesti.' });
  }
  try {
    const user = await dbAdapter.getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }
    const session: Session = {
      token: crypto.randomBytes(32).toString('hex'),
      userId: user.id,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    await dbAdapter.createSession(session);

    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      sameSite: 'lax',
    });

    const { password: _p, ...userSafe } = user;
    res.json({ success: true, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: 'Login fallito' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      await dbAdapter.deleteSession(token);
    } catch {}
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await dbAdapter.getUserByEmail(email);
    if (!user || user.password !== password || user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const session: Session = {
      token: crypto.randomBytes(32).toString('hex'),
      userId: user.id,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    await dbAdapter.createSession(session);
    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      sameSite: 'lax',
    });
    const { password: _p, ...userSafe } = user;
    res.json({ success: true, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const current = await getCurrentSession(req);
  if (!current) return res.json({ user: null });
  const { password: _p, ...userSafe } = current.user;
  res.json({ user: userSafe });
});

// ====================================================
//  PRESENCE
// ====================================================

app.post('/api/presence/ping', requireAuth, async (req, res) => {
  try {
    const session = (req as any).session as Session;
    await dbAdapter.updateSessionLastSeen(session.token, Date.now());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ping failed' });
  }
});

app.get('/api/presence/online', requireRole('admin', 'editor'), async (req, res) => {
  try {
    const online = await dbAdapter.getOnlineUsers(PRESENCE_WINDOW);
    res.json(online);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

// ====================================================
//  DATA (articoli, utenti, stats)
// ====================================================

app.get('/api/data', async (req, res) => {
  try {
    const current = await getCurrentSession(req);
    const isAdmin = !!(current && ['admin', 'editor'].includes(current.user.role));

    const articles = await dbAdapter.getArticles(isAdmin);
    const usersList = await dbAdapter.getUsers();
    const stats = await dbAdapter.getStats();

    // Utenti: solo admin vede password (e comunque non in chiaro)
    const users = usersList.map((u: any) => {
      if (isAdmin) {
        const { password, ...rest } = u;
        return rest;
      }
      return { id: u.id, name: u.name, role: u.role };
    });

    res.json({ articles, users, stats });
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ error: 'Database operation failed' });
  }
});

// ====================================================
//  ARTICLES (editor & admin & staff per scrivere)
// ====================================================

app.post('/api/articles', requireRole('admin', 'editor', 'staff'), async (req, res) => {
  const newArticle = {
    ...req.body,
    id: req.body.id || Date.now().toString(),
    timestamp: req.body.timestamp || new Date().toISOString(),
    author: req.body.author || (req as any).user.name,
  };
  try {
    const saved = await dbAdapter.createArticle(newArticle);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save article' });
  }
});

app.put('/api/articles/:id', requireRole('admin', 'editor', 'staff'), async (req, res) => {
  const { id } = req.params;
  try {
    await dbAdapter.updateArticle(id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

app.delete('/api/articles/:id', requireRole('admin', 'editor'), async (req, res) => {
  const { id } = req.params;
  try {
    await dbAdapter.deleteArticle(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ====================================================
//  USERS (solo admin)
// ====================================================

app.post('/api/users', requireRole('admin'), async (req, res) => {
  const newUser = {
    ...req.body,
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  try {
    const exists = await dbAdapter.getUserByEmail(newUser.email);
    if (exists) {
      return res.status(409).json({ error: 'Email già usata' });
    }
    await dbAdapter.createUser(newUser);
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save user' });
  }
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await dbAdapter.getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = { ...user, ...req.body, id };

    // Se rimuovo admin all'ultimo amministratore, blocco
    if (user.role === 'admin' && updated.role !== 'admin') {
      const allUsers = await dbAdapter.getUsers();
      const otherAdmins = allUsers.filter((u: any) => u.role === 'admin' && u.id !== id);
      if (otherAdmins.length === 0) {
        return res.status(400).json({
          error: "Impossibile rimuovere il ruolo admin all'ultimo amministratore.",
        });
      }
    }
    // Se password vuota, mantieni quella esistente
    if (!updated.password) updated.password = user.password;
    
    await dbAdapter.updateUser(id, updated);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await dbAdapter.getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'admin') {
      const allUsers = await dbAdapter.getUsers();
      const otherAdmins = allUsers.filter((u: any) => u.role === 'admin' && u.id !== id);
      if (otherAdmins.length === 0) {
        return res.status(400).json({
          error: "Impossibile eliminare l'ultimo amministratore.",
        });
      }
    }
    await dbAdapter.deleteUser(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ====================================================
//  SETTINGS (solo admin)
// ====================================================

app.get('/api/settings', requireRole('admin'), async (req, res) => {
  try {
    const settings = await dbAdapter.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

app.put('/api/settings', requireRole('admin'), async (req, res) => {
  try {
    const settings = await dbAdapter.updateSettings(req.body);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ====================================================
//  FRONTEND (vite o dist)
// ====================================================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// Se siamo su Vercel, non avviamo il server frontend Vite tramite middleware
// perché Vercel serve i file statici indipendentemente.
if (!process.env.VERCEL) {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
      console.error('\n⚠ Cartella \'dist/\' non trovata. Esegui \'npm run build\' prima dell\'avvio.\n');
    }
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`\nPulseWire Server avviato su http://${HOST}:${PORT}`);
    console.log(`Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`Storage: ${dbAdapter.isSupabase() ? 'SUPABASE' : 'LOCAL JSON'}\n`);
  });
}

// Gestione degli errori globale per ritornare JSON invece di HTML
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Errore interno del server',
  });
});

// Esporta l'app per Vercel serverless
export default app;
