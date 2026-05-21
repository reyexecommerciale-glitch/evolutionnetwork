# PulseWire

CMS minimalista a tema GTA 5 / FiveM / Roleplay. Registrazione utenti, login con sessioni, ruoli granulari, presence in tempo reale, editor articoli rich text, modalità manutenzione.

Stack: **React 19 + Vite + TypeScript + TailwindCSS v4 + Express**. Storage in `db.json`.

---

## Account amministratore iniziale

In `db.json`:

- **Email**: `admin@pulsewire.io`
- **Password**: `BlueBlack2026!`

Cambialo subito dopo il primo accesso.

---

## Ruoli utente

| Ruolo | Cosa può fare |
|---|---|
| **Admin** | Tutto: gestione utenti, articoli, impostazioni, manutenzione, vede chi è online |
| **Editor** | Crea/modifica/elimina articoli propri e altrui, vede chi è online |
| **Staff** | Crea/modifica articoli (non può eliminarne) |
| **Subscriber** | Solo lettura — è il ruolo di default per chi si registra dal sito |

---

## Funzioni principali

- **Registrazione pubblica** dal bottone "Iscriviti" in navbar
- **Login con cookie di sessione** (durata 7 giorni)
- **Avatar utente** in navbar con menu (profilo, admin, logout)
- **Profilo personale**: ogni utente può modificare nome/email/password
- **Tab admin**:
  - **Nuovo articolo** — editor stile WordPress
  - **Articoli** — lista con filtro per bozze/pubblicati, click per modificare
  - **Utenti** — gestione utenti e ruoli (solo admin)
  - **Online** — utenti connessi in tempo reale (refresh ogni 15s)
  - **Impostazioni** — modalità manutenzione, nome sito, tagline
- **Modalità manutenzione**: con un toggle, tutti i non-admin vedono una pagina "in manutenzione"
- **Editor articoli WordPress-like**: grassetto/corsivo/headings/liste/citazioni/codice/link, upload immagini dal computer, drag&drop, paste da appunti, popover per ridimensionare/allineare/eliminare
- **Categorie tematiche** preimpostate: GTA 5, FiveM, Roleplay, Server Hosting, Mods, Resources, Scripts, MLO / Maps, Vehicles, Tutorial, News, Community, Eventi, Streamer

---

## Sviluppo in locale

```bash
npm install
npm run dev
```

→ http://localhost:3000

---

## Deploy su Plesk

1. Carica il contenuto in `/httpdocs/` (incluso `.htaccess`)
2. Plesk → tuo dominio → **Node.js** → Enable Node.js
   - Application Startup File: `server.ts`
   - Application Mode: `production`
   - Custom env var: `NODE_ENV=production`
3. Click **"NPM install"**
4. Click **"Run script"** → `build`
5. **Permessi**: `chmod 664 db.json` (file scrivibile)
6. **Restart App**

Verifica: `https://tuodominio.it/api/health` → `{"ok":true,...}`.

---

## Endpoint API

### Pubblici
- `GET /api/health` — stato server
- `GET /api/settings/public` — nome sito, tagline, flag maintenance
- `GET /api/data` — articoli pubblicati + utenti pubblici + stats
- `POST /api/auth/register` — registrazione (role: subscriber)
- `POST /api/auth/login` — login (set cookie sessione)
- `POST /api/auth/logout` — logout (clear cookie)
- `GET /api/auth/me` — utente corrente (o null)

### Autenticati
- `POST /api/presence/ping` — heartbeat presenza

### Editor / Staff / Admin
- `POST /api/articles` — crea
- `PUT /api/articles/:id` — modifica
- `DELETE /api/articles/:id` — elimina (editor/admin)

### Admin only
- `GET /api/users` (via /api/data)
- `POST /api/users` — crea utente con ruolo specifico
- `PUT /api/users/:id` — modifica (anche ruolo)
- `DELETE /api/users/:id` — elimina (ma non l'ultimo admin)
- `GET /api/settings` — impostazioni complete
- `PUT /api/settings` — modifica (toggle maintenance, ecc.)

### Admin / Editor
- `GET /api/presence/online` — utenti connessi negli ultimi 60s

---

## Note di sicurezza

⚠️ **Password in chiaro** in `db.json`. Per produzione seria → hashare con bcrypt.
⚠️ **Niente rate-limit**: chiunque può fare bruteforce sul login. Aggiungi `express-rate-limit` se il sito diventa pubblico.
⚠️ **Sessioni in JSON**: scalano fino a centinaia di utenti, poi serve un DB vero.
⚠️ **Cookie `httpOnly` + `sameSite=lax`**: protetti da XSS basici, ma non sono `secure` (cambialo se vai in HTTPS only).

---

## Struttura

```
pulsewire-app/
├── server.ts              # Express + auth + sessions + presence
├── src/
│   ├── App.tsx            # Tutto il frontend
│   ├── main.tsx
│   └── index.css
├── dist/                  # (generato da npm run build)
├── db.json                # Database: articles, users, sessions, settings
├── .htaccess              # Plesk routing
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```
