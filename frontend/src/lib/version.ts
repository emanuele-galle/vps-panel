// Versione della VPS Console - Aggiornare ad ogni release
export const VERSION = '1.7.1';
export const VERSION_DATE = '2026-02-05';
export const VERSION_NAME = 'FODI Console';

// Changelog completo (formato Markdown)
export const CHANGELOG_MD = `# Changelog

Tutte le modifiche significative al progetto VPS Panel saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [1.7.1] - 2026-02-05

### Fixed
- **Header flash "Benvenuto, Utente"** - Aggiunto skeleton loader finché auth non è inizializzato
- **Dark mode Project Discovery** - Fix classi colore incompatibili con tema scuro
- **Accessibilità MobileSidebar** - Aggiunto SheetTitle nascosto per screen reader
- **Login branding** - Logo FODI S.r.l., rimosso placeholder credenziali sviluppo
- **i18n Domini** - Tradotte tutte le label in inglese (Active, Visit, Deactivate, Last Updated → italiano)
- **i18n Log Attività** - Headers tabella tradotti (Status→Stato, User→Utente, Action→Azione, etc.)
- **i18n Log Attività** - Formato date da AM/PM a 24h italiano (dd/mm/yyyy, HH:mm)
- **i18n Monitoraggio** - Assi grafici tradotti (Usage→Utilizzo, Traffic→Traffico, Memory→Memoria)
- **Database emoji rendering** - Sostituiti emoji (🐬🐘🍃) con badge testuali (MY, PG, MG, RD)
- **N8N version display** - Rimosso "vlatest" quando versione è Docker image tag
- **Settings tab overflow** - Migliorato scroll orizzontale tab su viewport ridotti
- **File Manager titolo** - Allineato titolo pagina "File Manager" con label sidebar

### Added
- **Skeleton loaders** su widget dashboard (SystemHealth, RecentDeployments, RecentNotifications)
- **Tab persistence** nella pagina progetto via URL query params
- **Timestamp aggiornamento** metriche dashboard con indicatore "Aggiornato X secondi fa"
- **Notifiche cliccabili** nel widget RecentNotifications (actionHref)
- **Ordinamento liste** Progetti, Container e Database (nome, stato, data)
- **Progress bar upload** file con percentuale real-time
- **Stepper numerato** nel DeployModal (Fase X/4)
- **Filtri notifiche** nel dropdown (Tutte/Deploy/Alert/Sistema)
- **Shortcut "?" discovery** nel footer sidebar per keyboard shortcuts

### Changed
- Pagina login ridisegnata con branding FODI S.r.l. e gradient background
- Info sviluppatore aggiornate a FODI S.r.l. su tutti i package.json
- Pagina Database: usa ErrorState component per gestione errori
- Version bump da 1.7.0 a 1.7.1

---

## [1.7.0] - 2026-02-04

### Added
- **Web Terminal** per container Docker
  - Terminale interattivo via WebSocket + node-pty
  - xterm.js v6 con FitAddon e WebLinksAddon
  - Autenticazione JWT, solo ADMIN
  - Max 5 sessioni, timeout inattivita 30 min
  - Accessibile da dettaglio container e pagina progetto

- **Dashboard Revamp**
  - Nuovo widget System Health (healthy/warning/critical)
  - Widget Deploy Recenti (ultimi 5 con status badge)
  - Widget Notifiche Recenti (ultime 5 con indicatore non letto)
  - Endpoint API \`GET /api/monitoring/dashboard-summary\`

- **Deployment Rollback**
  - Pulsante Rollback su deploy SUCCESS passati
  - \`git reset --hard\` al commit precedente + docker rebuild
  - Riutilizza DeployModal per progress real-time
  - Endpoint \`POST /api/projects/:id/deploy/rollback\`

### Changed
- Migrazione completa PM2 → Docker Compose (tutti i progetti)
- Routing Traefik: da file YAML statici a Docker container labels
- Version bump da 1.6.0 a 1.7.0

---

## [1.6.0] - 2026-02-04

### Added
- **File Manager Nativo Completo**
  - Vista Tabella sortabile (7 colonne)
  - Vista Albero gerarchica espandibile
  - Editor file testo (40+ formati)
  - Estrazione archivi (zip, tar, gzip, bzip2)
  - Upload/download file multipli
  - Operazioni move, copy, extract
  - Selezione multipla con checkbox

- **Schedulers Backend**
  - Sync automatica database (ogni 10 min)
  - Sync automatica container infrastruttura (ogni 5 min)
  - Sync automatica domini (ogni 10 min)
  - PM2 projects sync (ogni 5 min)

- **Changelog Interattivo**
  - Nuovo ChangelogDialog con markdown rendering
  - Notifica automatica nuove versioni
  - Storico completo versioni

### Fixed
- **Notifiche - Eliminato bug duplicati al riavvio**
  - Le notifiche di sistema non riappaiono più al refresh/riavvio
  - Implementato sistema tracking con localStorage
  - Hash unico per ogni notifica (projectId-type-status)
  - Retention automatica: record puliti dopo 7 giorni

- **Decryption Service - Graceful handling**
  - Password in chiaro gestite correttamente
  - Nessun errore per valori non criptati

- **Rate Limiter - Status code corretto**
  - Ritorna HTTP 429 invece di 500

### Removed
- FileBrowser container standalone (sostituito da nativo)

### Changed
- Version bump da 1.4.0 a 1.6.0
- Allineamento con VPS 2 (stesse funzionalità)

---

## [1.4.0] - 2026-01-10

### Added
- **Modulo Manutenzione Automatica**: scheduler per pulizia automatica sistema
  - Pulizia N8N (esecuzioni workflow vecchie)
  - Pulizia Docker (immagini, build cache, network orfani)
  - Pulizia log container (troncamento automatico)
  - Pulizia systemd journal
  - Pulizia activity logs database
  - Pulizia Claude Code cache
- Tab "Manutenzione" nelle Impostazioni (Admin)
- Componente UI Table per visualizzazione dati tabellari
- API endpoints /api/maintenance per gestione manutenzione

### Changed
- Riorganizzata pagina Impostazioni con struttura più pulita
- Rimossa pagina duplicata /dashboard/system-settings

---

## [1.3.0] - 2025-12-23

### Added
- Breadcrumb navigation
- Context menu avanzato
- Command palette (Ctrl+K)
- Keyboard shortcuts modal
- Loading skeleton migliorato

### Changed
- Performance ottimizzate
- UI/UX dashboard migliorata

---

## [1.2.0] - 2025-12-15

### Added
- Integrazione Google Drive per backup
- Sistema backup automatico
- Monitoraggio risorse avanzato
- Alerts sistema

---

## [1.1.0] - 2025-12-05

### Added
- Visualizzazione versione nel footer della sidebar
- Sezione "About" nelle impostazioni di sistema
- Changelog integrato nella console

---

## [1.0.0] - 2025-11-23

### Release Iniziale
- Dashboard con metriche sistema (CPU, RAM, disco, rete)
- Gestione progetti (PM2)
- Gestione container Docker
- Gestione database (PostgreSQL, MySQL, Redis)
- Gestione domini e DNS
- File Manager integrato
- Sistema backup
- Gestione email
- Integrazione N8N per automazioni
- Monitoraggio risorse in tempo reale
- Pannello amministrazione
- Sistema autenticazione JWT
- Tema light/dark

---

## Stack Attuale (v1.7.1)

**Frontend:**
- Next.js 16.1.1 (App Router)
- React 19.2.3
- TypeScript 5.3.3
- Tailwind CSS + shadcn/ui

**Backend:**
- Node.js 24.13.0 LTS
- Fastify 5.6.2 API
- Prisma 7.2.0 ORM

**Database:**
- PostgreSQL 18-alpine
- Redis 8-alpine

**Infrastruttura:**
- Docker & Docker Compose
- Traefik reverse proxy + SSL
- Docker Compose per progetti
- MinIO object storage
- N8N automazioni
`;

// Informazioni dettagliate sulla console
export const ABOUT_INFO_FULL = {
  name: 'FODI VPS Console',
  fullName: 'FODI Server Resource Management Console',
  version: VERSION,
  releaseDate: VERSION_DATE,
  developer: {
    company: 'FODI S.r.l.',
    website: 'https://fodi.it',
    email: 'info@fodisrl.it',
  },
  description: `La FODI VPS Console è una piattaforma di gestione server sviluppata internamente da FODI S.r.l. per centralizzare e semplificare l'amministrazione dell'infrastruttura VPS aziendale.

Questa console rappresenta il centro di controllo per tutti i progetti sviluppati e ospitati sulla VPS, fornendo un'interfaccia unificata per la gestione di applicazioni, database, domini e risorse di sistema.`,
  purpose: `Scopo principale:
- Gestione centralizzata progetti web
- Monitoraggio real-time risorse sistema
- Amministrazione database, container, servizi
- Automazione deploy e backup
- Interfaccia unificata per infrastruttura`,
  architecture: `Stack Tecnologico:
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: Fastify, Prisma ORM
- Database: PostgreSQL 18, Redis 8
- Infrastruttura: Docker, Traefik, PM2, MinIO, N8N`,
  features: [
    'Dashboard metriche real-time',
    'Gestione progetti PM2',
    'Gestione container Docker infrastruttura',
    'Amministrazione database PostgreSQL/Redis',
    'File Manager integrato nativo',
    'Backup automatici con retention',
    'Gestione domini e SSL',
    'Integrazione N8N automazioni',
    'Sistema notifiche smart',
    'Changelog interattivo',
    'Autenticazione JWT',
    'Tema light/dark',
  ],
};

// Legacy export per compatibilità
export const ABOUT_INFO = ABOUT_INFO_FULL;

// Legacy export per compatibilità
export const CHANGELOG = CHANGELOG_MD;
