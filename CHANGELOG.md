# Changelog - VPS Console

Tutte le modifiche notevoli alla VPS Console saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

---

## [1.4.0] - 2026-01-10

### Rimosso
- **Template Library**: Rimossa sezione Templates dal pannello
  - Eliminata pagina `/dashboard/templates`
  - Rimosso modulo backend `/api/templates`
  - Rimosso store e API frontend
  - Pulita documentazione correlata

### Migliorato
- **Design System**: Migrazione completa a design tokens
  - Sostituiti 883 colori hardcoded con variabili CSS semantiche
  - Sistema colori Oklch per migliore percezione
  - Supporto completo dark/light mode automatico
  - Classi semantiche: `text-foreground`, `text-muted-foreground`, `text-success`, `text-destructive`, `text-primary`, `text-warning`
- **UI/UX Refresh**: Miglioramenti generali all'interfaccia
  - Glassmorphism aggiornato
  - Animazioni ottimizzate
  - Leggibilità migliorata

---

## [1.3.0] - 2025-12-23

### Aggiunto
- **Two-Factor Authentication (2FA)**: Autenticazione a due fattori TOTP
  - Setup guidato con QR code per app authenticator
  - Codici di backup per recupero accesso
  - Abilitazione/disabilitazione 2FA da Impostazioni → Sicurezza
  - Verifica OTP al login per utenti con 2FA attivo
- **Session Management**: Gestione sessioni attive
  - Visualizzazione tutte le sessioni dell'utente (device, browser, IP)
  - Indicatore sessione corrente
  - Revoca singola sessione
  - Revoca tutte le altre sessioni
  - API: `GET/DELETE /api/auth/sessions`
- **Breadcrumb Navigation**: Navigazione a briciole di pane
  - Auto-generazione da pathname
  - Supporto path dinamici (UUID/CUID)
  - Icona Home per navigazione rapida
  - Localizzazione italiana etichette
- **Environment Variables UI**: Gestione variabili ambiente per progetto
  - Tab "Variabili Env" nella pagina dettaglio progetto
  - Lettura/scrittura file `.env` del progetto
  - Supporto `.env.local`, `.env.production`
  - Modifica inline chiave/valore
  - Aggiungi/elimina variabili
  - Indicatore "Sensibile" per password/token/key
  - Mostra/nascondi valori sensibili
  - Warning per modifiche non salvate
  - API: `GET/PUT /api/projects/:id/env`

### Frontend - Nuovi File
- `components/settings/TwoFactorSetup.tsx` - Setup wizard 2FA
- `components/settings/SessionManagement.tsx` - Gestione sessioni
- `components/ui/breadcrumb.tsx` - Componente breadcrumb
- `components/projects/EnvironmentVariablesTab.tsx` - Tab variabili ambiente

### Backend - Modifiche
- `auth.service.ts` - Metodi `getUserSessions`, `revokeSession`, `revokeAllOtherSessions`
- `auth.controller.ts` - Controller per endpoint sessioni
- `auth.routes.ts` - Route `/sessions`, `/sessions/:id`
- `projects.service.ts` - Metodi `getEnvVars`, `parseEnvFile`, `updateEnvVars`
- `projects.controller.ts` - Controller per endpoint env vars
- `projects.routes.ts` - Route `/:id/env`

### Migliorato
- Layout dashboard con breadcrumb sotto header
- Pagina impostazioni con sezione sicurezza espansa
- Pagina dettaglio progetto con nuovo tab env

---

## [1.2.0] - 2025-12-06

### Aggiunto
- **Real-Time Updates via WebSocket**: Aggiornamenti in tempo reale per progetti e credenziali
  - Nuovo endpoint WebSocket `/ws/projects` per sottoscrizioni globali
  - Endpoint `/ws/projects/:projectId` per sottoscrizioni specifiche
  - Hook React `useProjectsWebSocket` per gestione connessioni con auto-reconnect
- **Auto-Sync Credenziali**: Sistema automatico di sincronizzazione credenziali
  - Generazione automatica `vps-credentials.json` alla creazione progetto
  - Scheduler che sincronizza credenziali ogni 5 minuti
  - EventEmitter per propagazione eventi real-time
- **EditProjectModal**: Nuovo componente per modifica progetti
  - Modifica nome, descrizione, cliente, email, status
  - Validazione form con feedback errori
  - Informazioni read-only (slug, template, path)
- **ContainerControls**: Controlli avanzati per container singoli
  - Start/Stop/Restart con conferma
  - Visualizzazione status, image, porte
  - Accesso rapido a logs e terminale
- **Componente Textarea**: Aggiunto componente UI mancante

### Modificato
- **projectsStore.ts**: Aggiunto supporto real-time con handler per eventi WebSocket
  - `handleProjectCreated`, `handleProjectUpdated`, `handleProjectDeleted`
  - `handleStatusChanged`, `handleCredentialsSynced`
  - Tracking `lastUpdate` timestamp
- **projects.service.ts**: Integrato EventEmitter per emissione eventi
- **server.ts**: Registrazione Credentials Scheduler
- **app.ts**: Registrazione route WebSocket e inizializzazione handler

### Backend - Nuovi File
- `credentials.scheduler.ts` - Scheduler sync credenziali periodico
- `projects.events.ts` - Handler WebSocket per eventi progetti
- `projects.ws.routes.ts` - Route WebSocket per real-time updates

### Frontend - Nuovi File
- `hooks/useProjectsWebSocket.ts` - Hook per connessione WebSocket
- `components/projects/EditProjectModal.tsx` - Modal modifica progetto
- `components/projects/ContainerControls.tsx` - Controlli container
- `components/ui/textarea.tsx` - Componente Textarea

### Risolto
- Problema credenziali non sincronizzate alla creazione progetto
- Mancanza aggiornamenti real-time nella UI progetti
- Errore sharp missing nel frontend (già risolto in precedenza)

---

## [1.1.1] - 2025-12-05

### Modificato
- Unificata pagina "Sistema" in "Impostazioni"
- Tab "About" con changelog ora visibile a tutti gli utenti
- Rimossa voce "Sistema" separata dal menu amministrazione

### Migliorato
- Navigazione semplificata: tutte le impostazioni in un'unica pagina
- Tab admin (Sistema, Backup, Google Drive) visibili solo agli amministratori
- Separatore visivo tra tab utente e tab admin

---

## [1.1.0] - 2025-12-05

### Aggiunto
- Visualizzazione versione nel footer della sidebar
- Sezione "About" nelle impostazioni di sistema
- Changelog integrato nella console
- Documentazione completa della console

### Modificato
- Branding aggiornato con logo FODI
- Favicon aggiornato con logo FODI
- Migliorata navigazione sidebar

---

## [1.0.1] - 2025-12-05

### Modificato
- Sostituito branding "VPS Panel - Control Center" con logo FODI
- Aggiornato favicon con logo FODI
- Rimosso sottotitolo dalla sidebar
- Aggiunto supporto tema light/dark per logo

### Aggiunto
- File CHANGELOG.md per tracciamento modifiche
- Assets logo FODI (logo.png, logo-light.png)

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
- Design Assets
- Pannello amministrazione (utenti, log attività, sistema, impostazioni)
- Sistema autenticazione JWT
- Tema light/dark con switch automatico
- Layout responsive con sidebar collassabile
