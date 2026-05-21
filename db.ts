import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured } from './supabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

// --- Tipi ---
export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  lastSeen: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'editor' | 'staff' | 'subscriber';
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  timestamp: string;
  author: string;
  isLive: boolean;
  image: string;
  status: 'draft' | 'published';
}

export interface SiteSettings {
  maintenance: boolean;
  maintenanceMessage: string;
  siteName: string;
  siteTagline: string;
}

// --- DB helpers (Locale JSON) ---
function readDB(): any {
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(data);
  if (!db.sessions) db.sessions = [];
  if (!db.settings) {
    db.settings = {
      maintenance: false,
      maintenanceMessage: 'Stiamo facendo manutenzione. Torniamo online a breve.',
      siteName: 'PulseWire',
      siteTagline: '',
    };
  }
  return db;
}

function writeDB(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- Database Adapter ---
export const dbAdapter = {
  // Configurazione
  isSupabase() {
    return isSupabaseConfigured;
  },

  // Impostazioni del sito
  async getSettings(): Promise<SiteSettings> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) {
        // Se non esiste, crea la riga di default
        const defaultSettings = {
          id: 1,
          maintenance: false,
          maintenanceMessage: 'Stiamo facendo manutenzione. Torniamo online a breve.',
          siteName: 'PulseWire',
          siteTagline: 'GTA 5 · FiveM · Roleplay',
        };
        await supabase!.from('settings').insert(defaultSettings);
        return defaultSettings;
      }
      return {
        maintenance: data.maintenance,
        maintenanceMessage: data.maintenanceMessage,
        siteName: data.siteName,
        siteTagline: data.siteTagline,
      };
    } else {
      const db = readDB();
      return db.settings;
    }
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('settings')
        .update(settings)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      db.settings = { ...db.settings, ...settings };
      writeDB(db);
      return db.settings;
    }
  },

  // Gestione Utenti
  async getUserByEmail(email: string): Promise<User | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .ilike('email', email.trim())
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      return (
        db.users.find(
          (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
        ) || null
      );
    }
  },

  async getUserById(id: string): Promise<User | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      return db.users.find((u: any) => u.id === id) || null;
    }
  },

  async createUser(user: User): Promise<User> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('users')
        .insert(user)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      db.users.push(user);
      writeDB(db);
      return user;
    }
  },

  async updateUser(id: string, user: Partial<User>): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('users').update(user).eq('id', id);
      if (error) throw error;
    } else {
      const db = readDB();
      const index = db.users.findIndex((u: any) => u.id === id);
      if (index !== -1) {
        db.users[index] = { ...db.users[index], ...user, id };
        writeDB(db);
      }
    }
  },

  async deleteUser(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('users').delete().eq('id', id);
      if (error) throw error;
    } else {
      const db = readDB();
      db.users = db.users.filter((u: any) => u.id !== id);
      db.sessions = db.sessions.filter((s: Session) => s.userId !== id);
      writeDB(db);
    }
  },

  async getUsers(): Promise<User[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const db = readDB();
      return db.users;
    }
  },

  // Sessioni
  async createSession(session: Session): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('sessions').insert(session);
      if (error) throw error;
    } else {
      const db = readDB();
      db.sessions.push(session);
      writeDB(db);
    }
  },

  async deleteSession(token: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('sessions').delete().eq('token', token);
      if (error) throw error;
    } else {
      const db = readDB();
      db.sessions = db.sessions.filter((s: Session) => s.token !== token);
      writeDB(db);
    }
  },

  async getSession(token: string): Promise<Session | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('sessions')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      return db.sessions.find((s: Session) => s.token === token) || null;
    }
  },

  async updateSessionLastSeen(token: string, lastSeen: number): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!
        .from('sessions')
        .update({ lastSeen })
        .eq('token', token);
      if (error) throw error;
    } else {
      const db = readDB();
      const s = db.sessions.find((x: Session) => x.token === token);
      if (s) {
        s.lastSeen = lastSeen;
        writeDB(db);
      }
    }
  },

  async pruneSessions(maxAgeMs: number): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    if (isSupabaseConfigured) {
      const { error } = await supabase!
        .from('sessions')
        .delete()
        .lt('createdAt', cutoff);
      if (error) throw error;
    } else {
      const db = readDB();
      const before = db.sessions.length;
      db.sessions = db.sessions.filter((s: Session) => s.createdAt > cutoff);
      if (db.sessions.length !== before) writeDB(db);
    }
  },

  // Articoli
  async getArticles(isAdmin: boolean): Promise<Article[]> {
    if (isSupabaseConfigured) {
      let query = supabase!.from('articles').select('*');
      if (!isAdmin) {
        query = query.neq('status', 'draft');
      }
      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const db = readDB();
      const articles = db.articles;
      return isAdmin
        ? articles
        : articles.filter((a: any) => a.status !== 'draft');
    }
  },

  async createArticle(article: Article): Promise<Article> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!
        .from('articles')
        .insert(article)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = readDB();
      db.articles.unshift(article);
      writeDB(db);
      return article;
    }
  },

  async updateArticle(id: string, article: Partial<Article>): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!
        .from('articles')
        .update(article)
        .eq('id', id);
      if (error) throw error;
    } else {
      const db = readDB();
      const index = db.articles.findIndex((a: any) => a.id === id);
      if (index !== -1) {
        db.articles[index] = { ...db.articles[index], ...article, id };
        writeDB(db);
      }
    }
  },

  async deleteArticle(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('articles').delete().eq('id', id);
      if (error) throw error;
    } else {
      const db = readDB();
      db.articles = db.articles.filter((a: any) => a.id !== id);
      writeDB(db);
    }
  },

  // Stats
  async getStats(): Promise<any> {
    if (isSupabaseConfigured) {
      const { count: articlesCount } = await supabase!
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'draft');

      const { count: usersCount } = await supabase!
        .from('users')
        .select('*', { count: 'exact', head: true });

      return {
        totalViews: 142500, // mock statistiche visive
        activeUsers: usersCount || 0,
        storiesPublished: articlesCount || 0,
      };
    } else {
      const db = readDB();
      return db.stats;
    }
  },

  // Presence / Utenti Connessi
  async getOnlineUsers(presenceWindowMs: number): Promise<{ count: number; users: any[] }> {
    if (isSupabaseConfigured) {
      const cutoff = Date.now() - presenceWindowMs;
      const { data: activeSessions, error: sErr } = await supabase!
        .from('sessions')
        .select('userId, lastSeen')
        .gt('lastSeen', cutoff);

      if (sErr) throw sErr;
      if (!activeSessions || activeSessions.length === 0) {
        return { count: 0, users: [] };
      }

      const userIds = Array.from(new Set(activeSessions.map((s) => s.userId)));
      const { data: users, error: uErr } = await supabase!
        .from('users')
        .select('*')
        .in('id', userIds);

      if (uErr) throw uErr;

      const onlineUsers = users.map((u) => {
        const sessions = activeSessions.filter((s) => s.userId === u.id);
        const lastSeen = Math.max(...sessions.map((s) => Number(s.lastSeen)));
        const { password, ...rest } = u;
        return { ...rest, lastSeen };
      });

      return { count: onlineUsers.length, users: onlineUsers };
    } else {
      const db = readDB();
      const now = Date.now();
      const activeUserIds = new Set(
        db.sessions
          .filter((s: Session) => now - s.lastSeen < presenceWindowMs)
          .map((s: Session) => s.userId)
      );
      const online = db.users
        .filter((u: any) => activeUserIds.has(u.id))
        .map((u: any) => {
          const { password, ...rest } = u;
          const sessions = db.sessions.filter((s: Session) => s.userId === u.id);
          const lastSeen = Math.max(...sessions.map((s) => s.lastSeen));
          return { ...rest, lastSeen };
        });
      return { count: online.length, users: online };
    }
  },
};
