# Piano di Sviluppo VPS Console

**Versione**: 1.4.0 → 2.0.0
**Data**: 2026-01-10
**Basato su**: Analisi multi-agente (Frontend, Backend, Testing, Security)

---

## Executive Summary

La VPS Console è un'applicazione **production-ready** con architettura solida. Le analisi identificano aree chiave di miglioramento:

| Area | Score | Priorità |
|------|-------|----------|
| **Backend** | 8/10 | TypeScript strict, OpenAPI |
| **Frontend** | 8/10 | Testing, Accessibility |
| **Testing** | 3/10 | 0% frontend, 25% backend |
| **Security** | 8.5/10 | Secrets management, CSP |

---

## FASE 1: Quick Wins (1-2 giorni)

### 1.1 TypeScript Strict Mode [CRITICO]

**Backend** - `tsconfig.json`:
```bash
# Abilita strict mode
cd /root/vps-panel/backend
sed -i 's/"strict": false/"strict": true/' tsconfig.json
npm run build  # Verifica errori
```

**Aggiungi script type-check**:
```json
"scripts": {
  "type-check": "tsc --noEmit",
  "prebuild": "npm run type-check"
}
```

### 1.2 Fix 7 Test Falliti [ALTA]

```bash
cd /root/vps-panel/backend
npm run test 2>&1 | grep -A5 "FAIL"
```

Problemi identificati:
- `cookies.test.ts` (4 fail): SameSite discrepancy
- `download-token.service.test.ts` (1 fail): Race condition
- `validation.test.ts` (1 fail): Container ID validation
- `zip-security.test.ts` (1 fail): Deep path extraction

### 1.3 Security Headers in Traefik [ALTA]

**File**: `/root/vps-panel/traefik/dynamic/middlewares.yml`

Aggiungere:
```yaml
security-headers:
  headers:
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'none';"
    referrerPolicy: "strict-origin-when-cross-origin"
    permissionsPolicy: "camera=(), microphone=(), geolocation=()"
```

### 1.4 Rimuovi Console.log [MEDIA]

60 occorrenze in 24 file frontend:
```bash
cd /root/vps-panel/frontend
grep -r "console\.\(log\|debug\)" src --include="*.ts*" -l
```

---

## FASE 2: Security Hardening (1 settimana)

### 2.1 Secrets Management [CRITICO]

Problema: Credenziali in plaintext in `.env`

**Soluzione Docker Secrets**:
```bash
# Crea secrets
echo "POSTGRES_PASSWORD" | docker secret create postgres_password -
echo "JWT_SECRET" | docker secret create jwt_secret -
```

**Update docker-compose.yml**:
```yaml
services:
  backend:
    secrets:
      - postgres_password
      - jwt_secret
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

secrets:
  postgres_password:
    external: true
```

### 2.2 JWT Token Lifetime [ALTA]

Ridurre da 7 giorni a 15 minuti:
```env
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 2.3 Rate Limiting Progressivo [MEDIA]

```typescript
const BAN_DURATIONS = [
  5 * 60,      // 5 min
  15 * 60,     // 15 min
  60 * 60,     // 1 hour
  24 * 60 * 60 // 24 hours
];
```

---

## FASE 3: Testing Infrastructure (2 settimane)

### 3.1 Frontend Testing Setup [CRITICO]

```bash
cd /root/vps-panel/frontend
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { lines: 60 }
    }
  }
})
```

### 3.2 E2E Testing con Playwright [ALTA]

```bash
npm install -D @playwright/test
npx playwright install
```

**Test prioritari**:
1. Login flow con 2FA
2. Creazione progetto
3. Deploy container
4. File upload

### 3.3 Backend Coverage [ALTA]

```bash
cd /root/vps-panel/backend
npm install -D @vitest/coverage-v8
```

**Target Coverage**:
- Attuale: ~25%
- Target 1 mese: 60%
- Target 3 mesi: 80%

---

## FASE 4: Frontend Improvements (2 settimane)

### 4.1 Accessibility Audit [ALTA]

Solo 6 `aria-label` in 120 file.

**Fix prioritari**:
```tsx
// Button con solo icona
<button aria-label="Elimina progetto">
  <Trash className="h-4 w-4" />
</button>

// Dialog
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
```

**Installare ESLint a11y**:
```bash
npm install -D eslint-plugin-jsx-a11y
```

### 4.2 ESLint Configuration [MEDIA]

Creare `eslint.config.mjs`:
```javascript
import nextPlugin from '@next/eslint-plugin-next'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...nextPlugin.configs.recommended,
  jsxA11y.flatConfigs.recommended,
]
```

### 4.3 Error Boundaries [MEDIA]

Creare `components/error-boundary.tsx` per gestione errori globale.

### 4.4 Bundle Optimization [BASSA]

```bash
npm install -D @next/bundle-analyzer
ANALYZE=true npm run build
```

---

## FASE 5: Backend Improvements (1 settimana)

### 5.1 OpenAPI/Swagger [ALTA]

```bash
npm install @fastify/swagger @fastify/swagger-ui
```

```typescript
// app.ts
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'

app.register(swagger, {
  openapi: {
    info: { title: 'VPS Console API', version: '1.4.0' }
  }
})
app.register(swaggerUI, { routePrefix: '/api/docs' })
```

### 5.2 Logging Strutturato [MEDIA]

```typescript
app.addHook('onRequest', (req, reply, done) => {
  req.log = req.log.child({ 
    requestId: req.id,
    userId: req.user?.userId,
    ip: req.ip
  })
  done()
})
```

### 5.3 Health Checks Avanzati [BASSA]

```typescript
app.get('/health/ready', async () => {
  const checks = await Promise.all([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ])
  return { status: 'ready', checks }
})
```

---

## FASE 6: Infrastructure (1 settimana)

### 6.1 Docker Socket Proxy [MEDIA]

Limita accesso a Docker socket:
```yaml
docker-proxy:
  image: tecnativa/docker-socket-proxy
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  environment:
    CONTAINERS: 1
    IMAGES: 1
    POST: 0
    DELETE: 0
```

### 6.2 Log Aggregation [BASSA]

Setup Loki + Grafana per centralizzazione log.

### 6.3 CI/CD Pipeline [MEDIA]

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm ci && npm run test:coverage
      - run: cd frontend && npm ci && npm run test
      - uses: codecov/codecov-action@v4
```

---

## Checklist Implementazione

### Settimana 1
- [ ] TypeScript strict mode backend
- [ ] Fix 7 test falliti
- [ ] CSP header in Traefik
- [ ] Setup frontend testing

### Settimana 2
- [ ] Secrets management migration
- [ ] JWT lifetime reduction
- [ ] Frontend test coverage 20%

### Settimana 3-4
- [ ] E2E tests con Playwright
- [ ] Backend coverage 50%
- [ ] Accessibility fixes

### Mese 2
- [ ] OpenAPI documentation
- [ ] ESLint configuration
- [ ] Error boundaries
- [ ] CI/CD pipeline

### Mese 3
- [ ] Backend coverage 80%
- [ ] Frontend coverage 60%
- [ ] Docker socket proxy
- [ ] Log aggregation

---

## Metriche Target

| Metrica | Attuale | 1 Mese | 3 Mesi |
|---------|---------|--------|--------|
| Backend Coverage | 25% | 50% | 80% |
| Frontend Coverage | 0% | 20% | 60% |
| Backend Tests | 227 | 400 | 600 |
| Frontend Tests | 0 | 100 | 250 |
| E2E Tests | 0 | 10 | 25 |
| Security Score | 8.5/10 | 9/10 | 9.5/10 |
| a11y aria-label | 6 | 50 | 100% |

---

## Comandi Utili

```bash
# Build & Deploy
cd /root/vps-panel
sudo docker compose build --no-cache frontend backend
sudo docker compose up -d

# Test Backend
cd backend && npm run test

# Test Frontend (dopo setup)
cd frontend && npm run test

# Security Headers Check
curl -sI https://fodivps1.cloud | grep -iE "security|csp|x-frame"

# Type Check
npm run type-check
```

---

**Piano creato da**: Claude Code Multi-Agent Analysis
**Ultimo aggiornamento**: 2026-01-10
