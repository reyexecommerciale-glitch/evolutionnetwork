/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  User,
  LogOut,
  Plus,
  Trash2,
  FileText,
  Users as UsersIcon,
  X,
  Pencil,
  Bookmark,
  ArrowUpRight,
  Settings,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Eraser,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Edit3,
  Wifi,
  Shield,
  Power,
  ChevronDown,
} from 'lucide-react';

// ============================================================
//  TYPES
// ============================================================
interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  timestamp: string;
  author: string;
  isLive: boolean;
  image: string;
  status?: 'draft' | 'published';
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'editor' | 'staff' | 'subscriber';
  createdAt?: string;
}

interface SiteSettings {
  maintenance: boolean;
  maintenanceMessage: string;
  siteName: string;
  siteTagline: string;
}

interface OnlineUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastSeen: number;
}

interface DBState {
  articles: Article[];
  users: UserProfile[];
  stats: { totalViews: number; activeUsers: number; storiesPublished: number };
}

// ============================================================
//  CONSTANTS
// ============================================================
const CATEGORY_SUGGESTIONS = [
  'GTA 5 Mods',
  'GTA 5 News',
  'GTA 5 Graphics',
  'FiveM Scripts',
  'FiveM Server Dev',
  'FiveM Cars / EUP',
  'FiveM MLO / Maps',
  'FiveM Anti-Cheat',
  'FiveM Launcher',
  'FiveM Assets',
  'Roleplay Guides',
  'Roleplay Server',
  'Server Hosting',
  'Community Eventi',
  'Tutorial',
  'News',
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  editor: 'Editor',
  staff: 'Staff',
  subscriber: 'Iscritto',
};

const ROLE_TONE: Record<string, string> = {
  admin: 'text-red-300 bg-red-500/10',
  editor: 'text-amber-300 bg-amber-500/10',
  staff: 'text-blue-300 bg-blue-500/10',
  subscriber: 'text-[var(--color-fg-muted)] bg-[var(--color-bg-elev-2)]',
};

const SEED_DATA: DBState = {
  articles: [],
  users: [],
  stats: { totalViews: 0, activeUsers: 0, storiesPublished: 0 },
};

// ============================================================
//  API HELPERS
// ============================================================
async function api(input: string, init?: RequestInit): Promise<any> {
  const res = await fetch(input, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

async function apiSafe(input: string, init?: RequestInit): Promise<any | null> {
  try {
    return await api(input, init);
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// ============================================================
//  APP
// ============================================================
export default function App() {
  const [data, setData] = useState<DBState>(SEED_DATA);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({
    maintenance: false,
    maintenanceMessage: '',
    siteName: 'PulseWire',
    siteTagline: '',
  });
  const [view, setView] = useState<'home' | 'admin' | 'profile'>('home');
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [savedArticles, setSavedArticles] = useState<string[]>([]);

  // Carica utente corrente, settings e dati
  const refresh = useCallback(async () => {
    const [meRes, settingsRes, dataRes] = await Promise.all([
      apiSafe('/api/auth/me'),
      apiSafe('/api/settings/public'),
      apiSafe('/api/data'),
    ]);
    if (meRes) setMe(meRes.user);
    if (settingsRes) setSettings((s) => ({ ...s, ...settingsRes }));
    if (dataRes) setData(dataRes);
    setMeLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const saved = localStorage.getItem('pulsewire_saved');
    if (saved) setSavedArticles(JSON.parse(saved));
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem('pulsewire_saved', JSON.stringify(savedArticles));
  }, [savedArticles]);

  // Heartbeat per presenza utenti (quando loggato)
  useEffect(() => {
    if (!me) return;
    const ping = () => apiSafe('/api/presence/ping', { method: 'POST' });
    ping(); // immediato
    const interval = setInterval(ping, 30 * 1000); // ogni 30s
    return () => clearInterval(interval);
  }, [me]);

  const toggleSaveArticle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSavedArticles((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleLogout = async () => {
    await apiSafe('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setView('home');
  };

  // ============================================================
  //  MAINTENANCE GATE: blocca visitatori non-admin
  // ============================================================
  if (meLoaded && settings.maintenance && me?.role !== 'admin') {
    return (
      <MaintenancePage
        message={settings.maintenanceMessage}
        siteName={settings.siteName}
        onLoginClick={() => setAuthModal('login')}
      />
    );
  }

  if (!meLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex items-center gap-3 text-[var(--color-fg-muted)] text-sm">
          <div className="w-3 h-3 rounded-full bg-[var(--color-accent)] animate-pulse" />
          Loading
        </div>
      </div>
    );
  }

  // Articoli visibili in home: solo published
  const publishedArticles = data.articles.filter((a) => a.status !== 'draft');

  const filteredArticles = publishedArticles.filter((a) => {
    const text = stripHtml(a.content || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      a.title.toLowerCase().includes(q) || text.includes(q);
    const matchesCategory = category === 'All' || a.category === category;
    return matchesSearch && matchesCategory;
  });

  const dynamicCategories = [
    'All',
    ...Array.from(new Set(publishedArticles.map((a) => a.category)))
      .filter(Boolean)
      .sort(),
  ];

  const canAccessAdmin = me && ['admin', 'editor', 'staff'].includes(me.role);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {settings.maintenance && me?.role === 'admin' && (
        <div className="fixed top-0 left-0 right-0 z-[150] bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 text-xs text-amber-200 flex items-center justify-between">
          <span>
            ⚠️ Sito in <strong>manutenzione</strong> — solo gli admin possono accedere.
          </span>
          <button
            onClick={async () => {
              await apiSafe('/api/settings', {
                method: 'PUT',
                body: JSON.stringify({ maintenance: false }),
              });
              refresh();
            }}
            className="text-amber-100 hover:text-white underline"
          >
            Disattiva
          </button>
        </div>
      )}

      <Nav
        view={view}
        setView={setView}
        category={category}
        setCategory={setCategory}
        categories={dynamicCategories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        me={me}
        onLogin={() => setAuthModal('login')}
        onRegister={() => setAuthModal('register')}
        onLogout={handleLogout}
        canAccessAdmin={!!canAccessAdmin}
        offsetMaintenance={settings.maintenance && me?.role === 'admin'}
        siteName={settings.siteName}
      />

      <main
        className={`${
          settings.maintenance && me?.role === 'admin' ? 'pt-24' : 'pt-16'
        } pb-24`}
      >
        {view === 'admin' && canAccessAdmin ? (
          <AdminDashboard
            data={data}
            me={me!}
            settings={settings}
            setSettings={setSettings}
            refresh={refresh}
          />
        ) : view === 'profile' && me ? (
          <ProfileView me={me} setMe={setMe} refresh={refresh} />
        ) : (
          <HomeView
            articles={filteredArticles}
            allArticles={publishedArticles}
            category={category}
            setCategory={setCategory}
            categories={dynamicCategories}
            savedArticles={savedArticles}
            onOpen={setSelectedArticle}
            onSave={toggleSaveArticle}
            tagline={settings.siteTagline}
          />
        )}
      </main>

      <Footer />

      <AnimatePresence>
        {authModal === 'login' && (
          <Modal onClose={() => setAuthModal(null)}>
            <LoginForm
              onSuccess={(user) => {
                setMe(user);
                setAuthModal(null);
                refresh();
              }}
              onSwitchToRegister={() => setAuthModal('register')}
            />
          </Modal>
        )}
        {authModal === 'register' && (
          <Modal onClose={() => setAuthModal(null)}>
            <RegisterForm
              onSuccess={(user) => {
                setMe(user);
                setAuthModal(null);
                refresh();
              }}
              onSwitchToLogin={() => setAuthModal('login')}
            />
          </Modal>
        )}
        {selectedArticle && (
          <Modal onClose={() => setSelectedArticle(null)} wide>
            <ArticleDetail
              article={selectedArticle}
              isSaved={savedArticles.includes(selectedArticle.id)}
              onToggleSave={() => toggleSaveArticle(selectedArticle.id)}
              onClose={() => setSelectedArticle(null)}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  MAINTENANCE PAGE
// ============================================================
function MaintenancePage({
  message,
  siteName,
  onLoginClick,
}: {
  message: string;
  siteName: string;
  onLoginClick: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <Power className="w-6 h-6 text-amber-300" />
        </div>
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-amber-300 mb-3">
          {siteName} · in manutenzione
        </p>
        <h1 className="display text-4xl mb-4 tracking-[-0.02em]">A presto.</h1>
        <p className="text-[var(--color-fg-muted)] leading-relaxed mb-8">
          {message}
        </p>
        <button
          onClick={onLoginClick}
          className="btn-ghost px-4 py-2 text-[13px] inline-flex items-center gap-2"
        >
          <Shield className="w-3.5 h-3.5" />
          Accesso admin
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  NAV
// ============================================================
function Nav({
  view,
  setView,
  category,
  setCategory,
  categories,
  searchTerm,
  setSearchTerm,
  me,
  onLogin,
  onRegister,
  onLogout,
  canAccessAdmin,
  offsetMaintenance,
  siteName,
}: any) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 z-50 bg-[var(--color-bg)]/85 backdrop-blur-xl border-b border-[var(--color-line)] ${
        offsetMaintenance ? 'top-8' : 'top-0'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        <button onClick={() => setView('home')} className="flex items-center gap-2 group shrink-0">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] group-hover:scale-125 transition-transform" />
          <span className="display text-xl tracking-tight">
            {(siteName || 'Pulsewire').slice(0, 5)}
            <span className="italic font-normal text-[var(--color-fg-muted)]">
              {(siteName || 'Pulsewire').slice(5) || 'wire'}
            </span>
          </span>
        </button>

        {view === 'home' && (
          <nav className="hidden md:flex items-center gap-1 text-[13px] overflow-x-auto no-scrollbar max-w-[55%]">
            {categories.map((cat: string) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${
                  category === cat
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {view === 'home' && (
            <div className="hidden sm:flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center gap-2 field px-3 py-1.5 w-56">
                  <Search className="w-3.5 h-3.5 text-[var(--color-fg-faint)]" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Cerca…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => !searchTerm && setIsSearchOpen(false)}
                    className="bg-transparent outline-none text-sm flex-1 placeholder:text-[var(--color-fg-faint)]"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')}>
                      <X className="w-3.5 h-3.5 text-[var(--color-fg-faint)] hover:text-[var(--color-fg)]" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {me ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md hover:bg-[var(--color-bg-elev)] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] text-[11px] font-semibold uppercase">
                  {me.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3 h-3 text-[var(--color-fg-muted)]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--color-bg-elev)] border border-[var(--color-line-strong)] rounded-lg shadow-xl py-1 z-50">
                  <div className="px-3 py-2.5 border-b border-[var(--color-line)]">
                    <p className="text-sm font-medium text-[var(--color-fg)] truncate">{me.name}</p>
                    <p className="text-xs text-[var(--color-fg-muted)] truncate">{me.email}</p>
                    <span
                      className={`inline-block mt-1.5 mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        ROLE_TONE[me.role] || ''
                      }`}
                    >
                      {ROLE_LABELS[me.role] || me.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setView('profile');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev-2)] flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5" />
                    Il mio profilo
                  </button>
                  {canAccessAdmin && (
                    <button
                      onClick={() => {
                        setView(view === 'admin' ? 'home' : 'admin');
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev-2)] flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {view === 'admin' ? 'Vedi sito' : 'Pannello admin'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onLogout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 flex items-center gap-2 border-t border-[var(--color-line)] mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Esci
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={onLogin} className="btn-ghost px-3 py-1.5 text-[13px]">
                Accedi
              </button>
              <button onClick={onRegister} className="btn-accent px-3 py-1.5 text-[13px]">
                Iscriviti
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================
//  HOME
// ============================================================
function HomeView({
  articles,
  allArticles,
  category,
  setCategory,
  categories,
  savedArticles,
  onOpen,
  onSave,
  tagline,
}: any) {
  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-0">
      <section className="pt-16 md:pt-24 pb-12 md:pb-16 border-b border-[var(--color-line)]">
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)] mb-4">
          {tagline || 'Daily briefing'} · {new Date().toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="display text-5xl md:text-6xl leading-[1.02] mb-5 tracking-[-0.025em]">
          La community,{' '}
          <span className="italic font-light text-[var(--color-fg-muted)]">a portata di pulse.</span>
        </h1>
        <p className="text-[var(--color-fg-muted)] text-lg leading-relaxed max-w-xl">
          News, tutorial e risorse dal mondo GTA 5, FiveM e roleplay.
        </p>
      </section>

      <div className="md:hidden flex gap-1 overflow-x-auto no-scrollbar py-5 -mx-6 px-6">
        {categories.map((c: string) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-md text-[13px] transition-colors ${
              category === c
                ? 'bg-[var(--color-bg-elev-2)] text-[var(--color-fg)]'
                : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {articles.length === 0 ? (
        <EmptyState onReset={() => setCategory('All')} />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {articles.map((a: Article, i: number) => (
            <ArticleRow
              key={a.id}
              article={a}
              featured={i === 0 && category === 'All'}
              saved={savedArticles.includes(a.id)}
              onOpen={() => onOpen(a)}
              onSave={(e: React.MouseEvent) => onSave(a.id, e)}
              index={i}
            />
          ))}
        </ul>
      )}

      <div className="mt-16 pt-8 border-t border-[var(--color-line)] flex items-center justify-between text-xs text-[var(--color-fg-faint)] mono">
        <span>
          {articles.length} {articles.length === 1 ? 'story' : 'stories'}
          {category !== 'All' && ` in ${category.toLowerCase()}`}
        </span>
        <span>{allArticles.length} total in archive</span>
      </div>
    </div>
  );
}

function ArticleRow({ article, featured, saved, onOpen, onSave, index }: any) {
  const preview = stripHtml(article.content).slice(0, 180);
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className="group cursor-pointer"
      onClick={onOpen}
    >
      <article className={`flex gap-6 md:gap-8 py-8 md:py-10 ${featured ? 'md:py-12' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 text-[11px] mono uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            <span className="text-[var(--color-accent)]">{article.category}</span>
            <span className="text-[var(--color-fg-faint)]">·</span>
            <time>
              {new Date(article.timestamp).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}
            </time>
            {article.isLive && (
              <>
                <span className="text-[var(--color-fg-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-success)] animate-pulse" />
                  <span className="text-[var(--color-success)]">Live</span>
                </span>
              </>
            )}
          </div>
          <h2
            className={`display leading-[1.1] tracking-[-0.025em] mb-3 text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors ${
              featured ? 'text-3xl md:text-4xl' : 'text-2xl md:text-[28px]'
            }`}
          >
            {article.title}
          </h2>
          <p className="text-[var(--color-fg-muted)] leading-relaxed line-clamp-2 mb-4">
            {preview}
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[var(--color-fg-subtle)]">
              By <span className="text-[var(--color-fg-muted)]">{article.author}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onSave}
                className={`p-1.5 rounded-md transition-colors ${
                  saved ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-faint)] hover:text-[var(--color-fg-muted)]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
              </button>
              <span className="text-[var(--color-fg-faint)] group-hover:text-[var(--color-accent)] transition-colors">
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>

        <div
          className={`shrink-0 rounded-lg overflow-hidden bg-[var(--color-bg-elev)] ${
            featured ? 'w-40 h-32 md:w-56 md:h-44' : 'w-28 h-24 md:w-40 md:h-32'
          }`}
        >
          <img src={article.image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
        </div>
      </article>
    </motion.li>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-24 text-center">
      <p className="display text-2xl text-[var(--color-fg-muted)] mb-2">Nessuna storia ancora.</p>
      <p className="text-[var(--color-fg-subtle)] text-sm mb-6">Prova un'altra categoria o torna più tardi.</p>
      <button onClick={onReset} className="btn-ghost px-4 py-2 text-[13px]">
        Mostra tutto
      </button>
    </div>
  );
}

// ============================================================
//  PROFILE VIEW
// ============================================================
function ProfileView({ me, setMe, refresh }: any) {
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api(`/api/users/${me.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          email,
          ...(password ? { password } : {}),
        }),
      });
      setMsg('Salvato.');
      setPassword('');
      const meRes = await apiSafe('/api/auth/me');
      if (meRes?.user) setMe(meRes.user);
      refresh();
    } catch (err: any) {
      // Se l'utente non è admin, l'API blocca PUT su /api/users/:id. In quel caso
      // gli mostro un messaggio chiaro.
      setMsg(err.message || 'Errore nel salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-10 pt-10">
      <header className="mb-8">
        <h1 className="display text-4xl tracking-[-0.02em]">Il mio profilo</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Gestisci i tuoi dati personali.
        </p>
      </header>

      <form onSubmit={save} className="card p-6 space-y-4">
        <FieldText label="Nome" value={name} onChange={setName} required />
        <FieldText label="Email" type="email" value={email} onChange={setEmail} required />
        <FieldPassword
          label="Nuova password (lascia vuoto per non cambiarla)"
          value={password}
          onChange={setPassword}
        />
        <div className="text-xs text-[var(--color-fg-muted)] pt-2 border-t border-[var(--color-line)]">
          Ruolo: <span className="mono text-[var(--color-fg)]">{ROLE_LABELS[me.role]}</span>
        </div>
        {msg && (
          <div className="text-xs px-3 py-2 rounded-md bg-[var(--color-bg-elev-2)] text-[var(--color-fg-muted)]">
            {msg}
          </div>
        )}
        <button type="submit" disabled={saving} className="btn-accent w-full py-2.5 text-sm">
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
//  ADMIN DASHBOARD
// ============================================================
type AdminTab = 'new' | 'edit' | 'users' | 'visitors' | 'settings';

function AdminDashboard({ data, me, settings, setSettings, refresh }: any) {
  const [tab, setTab] = useState<AdminTab>('new');
  const isAdmin = me.role === 'admin';

  // Tab disponibili in base al ruolo
  const tabs: { id: AdminTab; label: string; icon: any; show: boolean }[] = [
    { id: 'new', label: 'Crea Articolo', icon: <Plus className="w-4 h-4" />, show: true },
    { id: 'edit', label: 'Modifica Articoli', icon: <Edit3 className="w-4 h-4" />, show: true },
    { id: 'users', label: 'Utenti', icon: <UsersIcon className="w-4 h-4" />, show: isAdmin },
    { id: 'visitors', label: 'Utenti Connessi', icon: <Wifi className="w-4 h-4" />, show: ['admin', 'editor'].includes(me.role) },
    { id: 'settings', label: 'Manutenzione & Impostazioni', icon: <Settings className="w-4 h-4" />, show: isAdmin },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-6 lg:px-10 pt-10">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <aside>
          <p className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-faint)] mb-4">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {tabs.filter((t) => t.show).map((t) => (
              <SidebarItem
                key={t.id}
                icon={t.icon}
                label={t.label}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
              />
            ))}
          </ul>

          <p className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-faint)] mt-8 mb-3">
            Sessione
          </p>
          <div className="card p-3 text-xs text-[var(--color-fg-muted)]">
            <p className="truncate font-medium text-[var(--color-fg)]">{me.name}</p>
            <p className="truncate text-[var(--color-fg-subtle)] text-[11px] mt-0.5">{me.email}</p>
            <span
              className={`inline-block mt-2 mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_TONE[me.role]}`}
            >
              {ROLE_LABELS[me.role]}
            </span>
          </div>
        </aside>

        <div className="min-w-0">
          {tab === 'new' && <NewArticleTab me={me} refresh={refresh} onPublished={() => setTab('edit')} />}
          {tab === 'edit' && <EditArticlesTab data={data} me={me} refresh={refresh} />}
          {tab === 'users' && isAdmin && <UsersTab data={data} refresh={refresh} />}
          {tab === 'visitors' && <VisitorsTab />}
          {tab === 'settings' && isAdmin && (
            <SettingsTab settings={settings} setSettings={setSettings} refresh={refresh} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
          active
            ? 'bg-[var(--color-bg-elev-2)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]'
        }`}
      >
        <span className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-faint)]'}>{icon}</span>
        {label}
      </button>
    </li>
  );
}

// ============================================================
//  TAB: NEW ARTICLE
// ============================================================
function NewArticleTab({ me, refresh, onPublished }: any) {
  return (
    <section>
      <header className="mb-6">
        <h1 className="display text-3xl tracking-[-0.02em]">Crea articolo</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Crea un nuovo articolo a tema GTA 5 o FiveM. Pubblicalo subito o salvalo come bozza.
        </p>
      </header>
      <ArticleEditor
        editing={null}
        me={me}
        onSaved={() => {
          refresh();
          onPublished();
        }}
      />
    </section>
  );
}

// ============================================================
//  TAB: EDIT ARTICLES
// ============================================================
function EditArticlesTab({ data, me, refresh }: any) {
  const [editing, setEditing] = useState<Article | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const filtered = data.articles.filter((a: Article) => {
    if (filter === 'all') return true;
    if (filter === 'published') return a.status !== 'draft';
    return a.status === 'draft';
  });

  const deleteArticle = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo articolo?')) return;
    await apiSafe(`/api/articles/${id}`, { method: 'DELETE' });
    refresh();
  };

  if (editing) {
    return (
      <section>
        <header className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => setEditing(null)}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] mb-2"
            >
              ← Torna alla lista
            </button>
            <h1 className="display text-3xl tracking-[-0.02em]">Modifica articolo</h1>
          </div>
        </header>
        <ArticleEditor
          editing={editing}
          me={me}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      </section>
    );
  }

  return (
    <section>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-3xl tracking-[-0.02em]">Gestisci Articoli</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">
            {data.articles.length} {data.articles.length === 1 ? 'articolo' : 'articoli'} totali.
          </p>
        </div>
        <div className="flex items-center gap-1 mono text-[11px]">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded transition-colors ${
                filter === f
                  ? 'bg-[var(--color-bg-elev-2)] text-[var(--color-fg)]'
                  : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]'
              }`}
            >
              {f === 'all' ? 'Tutti' : f === 'published' ? 'Pubblicati' : 'Bozze'}
            </button>
          ))}
        </div>
      </header>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">
            Nessun articolo {filter === 'draft' ? 'bozza' : filter === 'published' ? 'pubblicato' : ''}.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {filtered.map((a: Article) => (
              <li
                key={a.id}
                className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-elev-2)] transition-colors group cursor-pointer"
                onClick={() => setEditing(a)}
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-bg)] shrink-0">
                  <img src={a.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[var(--color-fg)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                      {a.title}
                    </h4>
                    {a.status === 'draft' && (
                      <span className="mono text-[9px] uppercase tracking-wider bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded">
                        Bozza
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5 mono">
                    {a.category} · {new Date(a.timestamp).toLocaleDateString('it-IT')} · {a.author}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconBtn onClick={() => setEditing(a)} tone="accent">
                    <Pencil className="w-4 h-4" />
                  </IconBtn>
                  {['admin', 'editor'].includes(me.role) && (
                    <IconBtn onClick={() => deleteArticle(a.id)} tone="danger">
                      <Trash2 className="w-4 h-4" />
                    </IconBtn>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ============================================================
//  TAB: USERS
// ============================================================
function UsersTab({ data, refresh }: any) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteUser = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo utente?')) return;
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' });
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveUser = async (u: Partial<UserProfile>) => {
    setError(null);
    try {
      if (editing) {
        await api(`/api/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(u) });
      } else {
        await api('/api/users', { method: 'POST', body: JSON.stringify(u) });
      }
      setAdding(false);
      setEditing(null);
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-3xl tracking-[-0.02em]">Utenti</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">
            {data.users.length} {data.users.length === 1 ? 'utente registrato' : 'utenti registrati'}.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="btn-accent px-3 py-2 text-[13px] flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nuovo utente
        </button>
      </header>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-[var(--color-line)]">
          {data.users.map((u: UserProfile) => {
            const isLastAdmin =
              u.role === 'admin' &&
              data.users.filter((x: UserProfile) => x.role === 'admin').length === 1;
            return (
              <li key={u.id} className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-elev-2)] transition-colors">
                <div className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] shrink-0 text-[12px] font-semibold uppercase">
                  {u.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[var(--color-fg)] truncate">{u.name}</h4>
                    <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_TONE[u.role]}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">{u.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn onClick={() => setEditing(u)} tone="accent">
                    <Pencil className="w-4 h-4" />
                  </IconBtn>
                  {!isLastAdmin && (
                    <IconBtn onClick={() => deleteUser(u.id)} tone="danger">
                      <Trash2 className="w-4 h-4" />
                    </IconBtn>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mono text-[11px] text-[var(--color-fg-faint)] mt-3">
        L'ultimo amministratore non può essere eliminato. Crea un nuovo admin prima.
      </p>

      <AnimatePresence>
        {(adding || editing) && (
          <Modal
            onClose={() => {
              setAdding(false);
              setEditing(null);
              setError(null);
            }}
          >
            <UserForm
              editing={editing}
              error={error}
              onSubmit={saveUser}
            />
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}

// ============================================================
//  TAB: VISITORS / ONLINE
// ============================================================
function VisitorsTab() {
  const [online, setOnline] = useState<{ count: number; users: OnlineUser[] }>({ count: 0, users: [] });
  const [loading, setLoading] = useState(true);

  const fetchOnline = async () => {
    const res = await apiSafe('/api/presence/online');
    if (res) setOnline(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchOnline();
    const interval = setInterval(fetchOnline, 15 * 1000); // refresh ogni 15s
    return () => clearInterval(interval);
  }, []);

  const formatLastSeen = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 30) return 'ora';
    if (sec < 60) return `${sec}s fa`;
    return `${Math.floor(sec / 60)}m fa`;
  };

  return (
    <section>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-3xl tracking-[-0.02em]">Utenti online</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">
            Aggiornato in tempo reale (ogni 15s).
          </p>
        </div>
        <div className="flex items-center gap-2 mono text-xs text-[var(--color-fg-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          {online.count} {online.count === 1 ? 'utente online' : 'utenti online'}
        </div>
      </header>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Caricamento…</div>
        ) : online.users.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">
            Nessun utente connesso in questo momento.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {online.users.map((u) => (
              <li key={u.id} className="flex items-center gap-4 p-4">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] text-[12px] font-semibold uppercase">
                    {u.name?.charAt(0) || 'U'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-bg-elev)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[var(--color-fg)] truncate">{u.name}</h4>
                    <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_TONE[u.role]}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">{u.email}</p>
                </div>
                <span className="mono text-[11px] text-[var(--color-fg-faint)]">{formatLastSeen(u.lastSeen)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mono text-[11px] text-[var(--color-fg-faint)] mt-3">
        Un utente è considerato "online" se ha interagito con il sito negli ultimi 60 secondi.
      </p>
    </section>
  );
}

// ============================================================
//  TAB: SETTINGS
// ============================================================
function SettingsTab({ settings, setSettings, refresh }: any) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(local),
      });
      setSettings(updated);
      refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = async () => {
    const newVal = !local.maintenance;
    setLocal({ ...local, maintenance: newVal });
    try {
      const updated = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ maintenance: newVal }),
      });
      setSettings(updated);
      refresh();
    } catch (err: any) {
      alert(err.message);
      setLocal({ ...local, maintenance: !newVal }); // rollback
    }
  };

  return (
    <section>
      <header className="mb-6">
        <h1 className="display text-3xl tracking-[-0.02em]">Impostazioni sito</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Modalità manutenzione e dati pubblici del sito.
        </p>
      </header>

      <div className="space-y-4">
        {/* Manutenzione */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Power className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-medium">Modalità manutenzione</h3>
              </div>
              <p className="text-xs text-[var(--color-fg-muted)] max-w-md leading-relaxed">
                Quando attiva, i visitatori vedono una pagina di "Sito in manutenzione".
                Solo gli admin possono continuare a navigare normalmente.
              </p>
            </div>
            <button
              onClick={toggleMaintenance}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                local.maintenance ? 'bg-amber-500' : 'bg-[var(--color-line-strong)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  local.maintenance ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
            <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">
              Messaggio mostrato ai visitatori
            </span>
            <textarea
              value={local.maintenanceMessage}
              onChange={(e) => setLocal({ ...local, maintenanceMessage: e.target.value })}
              rows={3}
              className="field w-full px-3 py-2.5 text-sm resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Site name & tagline */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-medium">Informazioni sito</h3>
          <FieldText
            label="Nome del sito"
            value={local.siteName}
            onChange={(v: string) => setLocal({ ...local, siteName: v })}
          />
          <FieldText
            label="Tagline (mostrata nella home)"
            value={local.siteTagline}
            onChange={(v: string) => setLocal({ ...local, siteTagline: v })}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="btn-accent px-5 py-2.5 text-sm"
        >
          {saving ? 'Salvataggio…' : 'Salva impostazioni'}
        </button>
      </div>
    </section>
  );
}

// ============================================================
//  ARTICLE EDITOR
// ============================================================
function ArticleEditor({
  editing,
  me,
  onSaved,
}: {
  editing: Article | null;
  me: UserProfile;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [image, setImage] = useState(editing?.image || '');
  const [content, setContent] = useState(editing?.content || '<p></p>');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildArticle = (status: 'draft' | 'published'): Partial<Article> => ({
    id: editing ? editing.id : Date.now().toString(),
    title: title.trim() || 'Senza titolo',
    category: category.trim() || 'News',
    content,
    author: editing?.author || me.name,
    image:
      image.trim() ||
      editing?.image ||
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800',
    isLive: status === 'published',
    timestamp: editing?.timestamp || new Date().toISOString(),
    status,
  });

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      alert('Inserisci almeno un titolo.');
      return;
    }
    setSaving(true);
    const articleData = buildArticle(status);
    try {
      if (editing) {
        await api(`/api/articles/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(articleData),
        });
      } else {
        await api('/api/articles', {
          method: 'POST',
          body: JSON.stringify(articleData),
        });
      }
      onSaved();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="btn-ghost px-3 py-1.5 text-[13px] flex items-center gap-2"
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPreview ? 'Torna alla modifica' : 'Anteprima Articolo'}
        </button>
      </div>

      {showPreview ? (
        <ArticlePreview article={buildArticle('published') as Article} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Area Principale Editor (Sinistra) */}
          <div className="lg:col-span-8 space-y-6">
            <label className="block">
              <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5 font-medium uppercase tracking-wider">Titolo dell'articolo</span>
              <input
                className="field w-full px-4 py-3 text-lg md:text-xl font-semibold display"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inserisci il titolo dell'articolo..."
                required
              />
            </label>

            <div>
              <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5 font-medium uppercase tracking-wider">Contenuto</span>
              <RichTextEditor initialHtml={content} onChange={setContent} />
            </div>
          </div>

          {/* Sidebar Documento (Destra) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            {/* Box Pubblicazione */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] border-b border-[var(--color-line)] pb-2">
                Pubblicazione
              </h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-subtle)]">Stato:</span>
                <span className={`mono font-semibold px-2 py-0.5 rounded ${editing ? (editing.status === 'draft' ? 'text-amber-300 bg-amber-500/10' : 'text-green-300 bg-green-500/10') : 'text-blue-300 bg-blue-500/10'}`}>
                  {editing ? (editing.status === 'draft' ? 'Bozza' : 'Pubblicato') : 'Nuovo'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-subtle)]">Autore:</span>
                <span className="font-medium text-[var(--color-fg)]">{editing?.author || me.name}</span>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => save('published')}
                  disabled={saving}
                  className="btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-1.5 font-medium"
                >
                  {saving ? 'Salvataggio…' : editing ? (editing.status === 'draft' ? 'Pubblica Articolo' : 'Aggiorna Articolo') : 'Pubblica Articolo'}
                </button>
                <button
                  type="button"
                  onClick={() => save('draft')}
                  disabled={saving}
                  className="btn-ghost w-full py-2.5 text-sm font-medium"
                >
                  Salva come Bozza
                </button>
              </div>
            </div>

            {/* Box Metadati */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] border-b border-[var(--color-line)] pb-2">
                Impostazioni
              </h3>
              
              <label className="block">
                <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">
                  Categoria GTA 5 / FiveM
                </span>
                <input
                  className="field w-full px-3 py-2.5 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Seleziona o digita..."
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">
                  Immagine in evidenza (URL)
                </span>
                <input
                  className="field w-full px-3 py-2.5 text-sm"
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
              </label>

              {image && (
                <div className="rounded-lg overflow-hidden border border-[var(--color-line)] bg-[var(--color-bg-elev-2)]">
                  <span className="block text-[10px] text-[var(--color-fg-faint)] px-3 py-1 bg-[var(--color-bg-elev)] border-b border-[var(--color-line)]">Anteprima Immagine</span>
                  <img src={image} alt="Featured preview" className="w-full h-28 object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticlePreview({ article }: { article: Article }) {
  return (
    <div className="card overflow-hidden">
      <div className="h-48 relative bg-[var(--color-bg-elev-2)]">
        {article.image && <img src={article.image} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="p-6">
        <p className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
          {article.category}
        </p>
        <h2 className="display text-3xl leading-[1.05] tracking-[-0.02em] mb-4">
          {article.title || 'Senza titolo'}
        </h2>
        <div
          className="prose-article text-[var(--color-fg)] leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>
    </div>
  );
}

// ============================================================
//  RICH TEXT EDITOR (uguale a prima, con upload immagini)
// ============================================================
function RichTextEditor({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, force] = useState(0);
  const [imgPopover, setImgPopover] = useState<{ el: HTMLImageElement; top: number; left: number } | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml || '<p></p>';
      attachImageHandlers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notify = () => {
    onChange(ref.current?.innerHTML || '');
    force((n) => n + 1);
  };

  const attachImageHandlers = () => {
    if (!ref.current) return;
    const imgs = ref.current.querySelectorAll('img');
    imgs.forEach((img) => {
      img.setAttribute('draggable', 'true');
      if (!img.style.maxWidth) img.style.maxWidth = '100%';
      img.classList.add('editor-image');
    });
  };

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    notify();
    setTimeout(attachImageHandlers, 0);
  };

  const handleInput = () => {
    attachImageHandlers();
    notify();
  };

  const insertLink = () => {
    const url = prompt('URL del link:');
    if (url) exec('createLink', url);
  };

  const insertImageFromUrl = () => {
    const url = prompt('URL dell\'immagine (oppure annulla e usa il bottone Carica per caricare dal computer):');
    if (url) exec('insertImage', url);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const insertFileAsImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Seleziona un file immagine.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (!confirm("L'immagine è grande (>5MB) e potrebbe rallentare il salvataggio. Continuare?")) return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      ref.current?.focus();
      document.execCommand('insertImage', false, dataUrl);
      setTimeout(() => {
        attachImageHandlers();
        notify();
      }, 0);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(insertFileAsImage);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      Array.from(files).forEach(insertFileAsImage);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          insertFileAsImage(file);
          return;
        }
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && ref.current) {
      const img = target as HTMLImageElement;
      const editorRect = ref.current.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      setImgPopover({
        el: img,
        top: imgRect.top - editorRect.top - 44,
        left: imgRect.left - editorRect.left,
      });
    } else {
      setImgPopover(null);
    }
  };

  const resizeImage = (size: 'small' | 'medium' | 'large' | 'full') => {
    if (!imgPopover) return;
    const widths = { small: '30%', medium: '50%', large: '75%', full: '100%' };
    imgPopover.el.style.width = widths[size];
    imgPopover.el.style.height = 'auto';
    notify();
    setTimeout(() => {
      if (imgPopover && ref.current) {
        const editorRect = ref.current.getBoundingClientRect();
        const imgRect = imgPopover.el.getBoundingClientRect();
        setImgPopover({ el: imgPopover.el, top: imgRect.top - editorRect.top - 44, left: imgRect.left - editorRect.left });
      }
    }, 50);
  };

  const alignImage = (align: 'left' | 'center' | 'right') => {
    if (!imgPopover) return;
    const img = imgPopover.el;
    img.style.float = '';
    img.style.display = '';
    img.style.marginLeft = '';
    img.style.marginRight = '';
    if (align === 'left') {
      img.style.float = 'left';
      img.style.marginRight = '1em';
      img.style.marginBottom = '0.5em';
    } else if (align === 'right') {
      img.style.float = 'right';
      img.style.marginLeft = '1em';
      img.style.marginBottom = '0.5em';
    } else {
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    }
    notify();
  };

  const deleteImage = () => {
    if (!imgPopover) return;
    imgPopover.el.remove();
    setImgPopover(null);
    notify();
  };

  return (
    <div className="card p-0 overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-line)] bg-[var(--color-bg-elev-2)]">
        <ToolBtn onClick={() => exec('bold')} title="Grassetto (Cmd+B)"><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Corsivo (Cmd+I)"><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('underline')} title="Sottolineato"><Underline className="w-3.5 h-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('formatBlock', 'h2')} title="H2"><Heading2 className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'h3')} title="H3"><Heading3 className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'p')} title="Paragrafo"><span className="text-[11px] font-medium px-0.5">P</span></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Lista"><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Lista numerata"><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'blockquote')} title="Citazione"><Quote className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'pre')} title="Codice"><Code className="w-3.5 h-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn onClick={insertLink} title="Link"><LinkIcon className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={openFilePicker} title="Carica immagine dal computer"><Upload className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={insertImageFromUrl} title="Inserisci immagine da URL"><ImageIcon className="w-3.5 h-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('removeFormat')} title="Rimuovi formattazione"><Eraser className="w-3.5 h-3.5" /></ToolBtn>
      </div>

      <div className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onPaste={handlePaste}
          onClick={handleClick}
          className="prose-editor min-h-[320px] max-h-[560px] overflow-y-auto px-4 py-4 text-[15px] leading-relaxed outline-none"
        />

        {imgPopover && (
          <div
            className="absolute z-20 bg-[var(--color-bg-elev-2)] border border-[var(--color-line-strong)] rounded-lg shadow-xl p-1 flex items-center gap-0.5"
            style={{ top: Math.max(4, imgPopover.top), left: Math.max(4, imgPopover.left) }}
            onClick={(e) => e.stopPropagation()}
          >
            <SmallBtn onClick={() => resizeImage('small')} title="Piccola">S</SmallBtn>
            <SmallBtn onClick={() => resizeImage('medium')} title="Media">M</SmallBtn>
            <SmallBtn onClick={() => resizeImage('large')} title="Grande">L</SmallBtn>
            <SmallBtn onClick={() => resizeImage('full')} title="Tutta la larghezza"><Maximize2 className="w-3 h-3" /></SmallBtn>
            <Divider />
            <SmallBtn onClick={() => alignImage('left')} title="Sinistra"><AlignLeft className="w-3 h-3" /></SmallBtn>
            <SmallBtn onClick={() => alignImage('center')} title="Centro"><AlignCenter className="w-3 h-3" /></SmallBtn>
            <SmallBtn onClick={() => alignImage('right')} title="Destra"><AlignRight className="w-3 h-3" /></SmallBtn>
            <Divider />
            <SmallBtn onClick={deleteImage} title="Elimina" tone="danger"><Trash2 className="w-3 h-3" /></SmallBtn>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--color-line)] bg-[var(--color-bg-elev-2)]/50 text-[11px] text-[var(--color-fg-faint)] flex items-center gap-3 flex-wrap">
        <span>💡 Trascina file dal Finder o usa Cmd+V per incollare</span>
        <span>·</span>
        <span>Click su un'immagine per ridimensionarla</span>
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)] transition-colors"
    >
      {children}
    </button>
  );
}

function SmallBtn({ children, onClick, title, tone }: any) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-1.5 py-1 rounded text-[11px] font-medium transition-colors min-w-[24px] flex items-center justify-center ${toneClass}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--color-line)] mx-0.5" />;
}

function IconBtn({ children, onClick, tone = 'default' }: any) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
      : tone === 'accent'
      ? 'text-[var(--color-fg-faint)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]'
      : 'text-[var(--color-fg-faint)] hover:text-[var(--color-fg)]';
  return (
    <button onClick={onClick} className={`p-1.5 rounded-md transition-colors ${toneClass}`}>
      {children}
    </button>
  );
}

// ============================================================
//  USER FORM (admin)
// ============================================================
function UserForm({
  editing,
  error,
  onSubmit,
}: {
  editing: UserProfile | null;
  error: string | null;
  onSubmit: (u: Partial<UserProfile>) => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [email, setEmail] = useState(editing?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserProfile['role']>(editing?.role || 'subscriber');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Nome e email obbligatori.');
      return;
    }
    if (!editing && !password) {
      alert('Password obbligatoria per un nuovo utente.');
      return;
    }
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      password: password || undefined,
      role,
    });
  };

  return (
    <div className="p-8">
      <h2 className="display text-3xl mb-1">{editing ? 'Modifica utente' : 'Nuovo utente'}</h2>
      <p className="text-sm text-[var(--color-fg-muted)] mb-8">
        {editing ? 'Aggiorna i dati o cambia il ruolo.' : 'Crea un nuovo account con un ruolo specifico.'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <FieldText label="Nome" value={name} onChange={setName} required />
        <FieldText label="Email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" required />
        <FieldPassword
          label={editing ? 'Nuova password (lascia vuoto per non cambiarla)' : 'Password'}
          value={password}
          onChange={setPassword}
        />
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">Ruolo</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserProfile['role'])}
            className="field w-full px-3 py-2.5 text-sm appearance-none cursor-pointer"
          >
            <option value="subscriber">Iscritto — può solo leggere</option>
            <option value="staff">Staff — può scrivere articoli</option>
            <option value="editor">Editor — può scrivere e gestire articoli</option>
            <option value="admin">Admin — accesso completo</option>
          </select>
        </label>
        {error && (
          <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <button type="submit" className="btn-accent w-full py-2.5 text-sm mt-2">
          {editing ? 'Aggiorna' : 'Crea utente'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
//  LOGIN / REGISTER FORMS
// ============================================================
function LoginForm({
  onSuccess,
  onSwitchToRegister,
}: {
  onSuccess: (u: UserProfile) => void;
  onSwitchToRegister: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError('Credenziali non valide.');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="display text-3xl mb-1">Accedi</h2>
      <p className="text-sm text-[var(--color-fg-muted)] mb-8">Entra nel tuo account.</p>
      <form onSubmit={submit} className="space-y-4">
        <FieldText label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
        <FieldPassword label="Password" value={password} onChange={setPassword} placeholder="••••••••" required />
        {error && (
          <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-accent w-full py-2.5 text-sm mt-2">
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
      <p className="text-xs text-[var(--color-fg-muted)] text-center mt-6 pt-6 border-t border-[var(--color-line)]">
        Non hai un account?{' '}
        <button onClick={onSwitchToRegister} className="text-[var(--color-accent)] hover:underline">
          Iscriviti
        </button>
      </p>
    </div>
  );
}

function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: (u: UserProfile) => void;
  onSwitchToLogin: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError('Registrazione fallita.');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di registrazione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="display text-3xl mb-1">Iscriviti</h2>
      <p className="text-sm text-[var(--color-fg-muted)] mb-8">Crea un account in 30 secondi.</p>
      <form onSubmit={submit} className="space-y-4">
        <FieldText label="Nome" value={name} onChange={setName} placeholder="Mario Rossi" required />
        <FieldText label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
        <FieldPassword label="Password (min 6 caratteri)" value={password} onChange={setPassword} placeholder="••••••••" required />
        {error && (
          <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-accent w-full py-2.5 text-sm mt-2">
          {loading ? 'Creazione…' : 'Crea account'}
        </button>
      </form>
      <p className="text-xs text-[var(--color-fg-muted)] text-center mt-6 pt-6 border-t border-[var(--color-line)]">
        Hai già un account?{' '}
        <button onClick={onSwitchToLogin} className="text-[var(--color-accent)] hover:underline">
          Accedi
        </button>
      </p>
    </div>
  );
}

// ============================================================
//  REUSABLE FIELDS
// ============================================================
function FieldText({ label, value, onChange, type = 'text', placeholder, required }: any) {
  return (
    <label className="block">
      <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="field w-full px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function FieldPassword({ label, value, onChange, placeholder, required }: any) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="block text-xs text-[var(--color-fg-muted)] mb-1.5">{label}</span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="field w-full px-3 py-2.5 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-fg-faint)] hover:text-[var(--color-fg)] transition-colors rounded-md"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}

// ============================================================
//  ARTICLE DETAIL
// ============================================================
function ArticleDetail({ article, isSaved, onToggleSave, onClose }: any) {
  return (
    <article>
      <div className="relative h-64 md:h-80">
        <img src={article.image} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-elev)] via-[var(--color-bg-elev)]/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <p className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
            {article.category}
          </p>
          <h2 className="display text-3xl md:text-4xl leading-[1.05] tracking-[-0.025em] text-white max-w-2xl">
            {article.title}
          </h2>
        </div>
      </div>

      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--color-line)] text-sm text-[var(--color-fg-muted)]">
          <span>By {article.author}</span>
          <span className="text-[var(--color-fg-faint)]">·</span>
          <time>
            {new Date(article.timestamp).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
        </div>

        <div
          className="prose-article text-[var(--color-fg)] leading-[1.7] text-[17px]"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <div className="flex items-center gap-2 mt-10 pt-6 border-t border-[var(--color-line)]">
          <button
            onClick={onToggleSave}
            className={`btn-ghost px-4 py-2 text-[13px] flex items-center gap-2 ${
              isSaved ? 'text-[var(--color-accent)] border-[var(--color-accent)]/40' : ''
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Salvato' : 'Salva'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-[13px]">
            Chiudi
          </button>
        </div>
      </div>
    </article>
  );
}

// ============================================================
//  MODAL & FOOTER
// ============================================================
function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`relative w-full ${
          wide ? 'max-w-3xl' : 'max-w-md'
        } bg-[var(--color-bg-elev)] border border-[var(--color-line-strong)] rounded-xl overflow-hidden max-h-[90vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev-2)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg)]/85 backdrop-blur-xl border-t border-[var(--color-line)]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 h-10 flex items-center justify-between mono text-[11px] text-[var(--color-fg-faint)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            Operational
          </span>
          <span className="hidden md:inline">© Pulsewire 2026</span>
        </div>
        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </footer>
  );
}
