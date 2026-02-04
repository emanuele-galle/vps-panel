// Versione della VPS Console - Aggiornare ad ogni release
export const VERSION = '1.7.0';
export const VERSION_DATE = '2026-02-04';
export const VERSION_NAME = 'FODI Console';

// Changelog completo (formato Markdown)
export const CHANGELOG_MD = `# Changelog

Tutte le modifiche significative al progetto VPS Panel saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

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

## Stack Attuale (v1.7.0)

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
- PM2 per progetti Node.js
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
