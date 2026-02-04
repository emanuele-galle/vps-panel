# Documentazione API OpenAPI/Swagger

## Accesso alla Documentazione

La documentazione interattiva Swagger UI è disponibile ai seguenti endpoint:

- **Development**: http://localhost:3001/api/docs
- **Production**: https://api.fodivps1.cloud/api/docs

## Autenticazione

La documentazione supporta due metodi di autenticazione:

### 1. Bearer Token (Authorization Header)
```bash
Authorization: Bearer <jwt-token>
```

Per testare dalla UI Swagger:
1. Esegui login tramite POST `/api/auth/login`
2. Copia il `accessToken` dalla risposta
3. Clicca sul pulsante "Authorize" in alto a destra
4. Incolla il token nel campo "bearerAuth"
5. Clicca "Authorize"

### 2. Cookie Authentication (HttpOnly)
Usato automaticamente dal frontend. Il token JWT viene salvato in un cookie HttpOnly.

## Funzionalità

- **Swagger UI interattiva**: Testa le API direttamente dal browser
- **Schema OpenAPI 3.0**: Documentazione standardizzata
- **Try it out**: Esegui richieste real-time
- **Filtro per tag**: Raggruppa endpoint per modulo
- **Deep linking**: Condividi link diretti agli endpoint
- **Request/Response examples**: Esempi automatici

## Tag Disponibili

| Tag | Descrizione |
|-----|-------------|
| `Auth` | Autenticazione e gestione sessioni |
| `Monitoring` | Monitoraggio sistema (CPU, RAM, Disk) |
| `Projects` | Gestione progetti PM2 |
| `Docker` | Gestione container e servizi Docker |
| `Domains` | Gestione domini Cloudflare |
| `Databases` | Gestione database PostgreSQL/MySQL/Redis |
| `File Manager` | Gestione file e cartelle |
| `Email` | Gestione email forwarding |
| `Users` | Gestione utenti admin |
| `Activity` | Log attività utenti |
| `System Settings` | Configurazione sistema |
| `Backup` | Backup database e progetti |
| `Optimization` | Ottimizzazione sistema |
| `N8N` | Integrazione workflow N8N |
| `Security` | Sicurezza e firewall |
| `Health` | Health check e diagnostica |
| `Maintenance` | Manutenzione sistema |

## Aggiungere Schema alle Route

Per aggiungere documentazione a nuove route:

```typescript
app.get('/my-route', {
  schema: {
    tags: ['My Module'],
    summary: 'Breve descrizione',
    description: 'Descrizione dettagliata',
    security: [{ bearerAuth: [] }], // Se richiede autenticazione
    querystring: {
      type: 'object',
      properties: {
        param: { type: 'string', description: 'Parametro query' },
      },
    },
    response: {
      200: {
        description: 'Risposta di successo',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    },
  },
  handler: myController.myHandler.bind(myController),
});
```

## JSON OpenAPI Spec

Per ottenere lo schema OpenAPI in formato JSON:

```bash
curl http://localhost:3001/api/docs/json
```

## Generazione Client SDK

Lo schema OpenAPI può essere usato per generare client SDK automatici:

```bash
# TypeScript
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/api/docs/json \
  -g typescript-axios \
  -o ./generated-client

# Altri linguaggi: python, java, go, php, ruby, etc.
```

## Note di Sicurezza

- La documentazione è accessibile solo in ambienti development/staging
- In production, considera di proteggerla con autenticazione
- Non esporre mai credenziali sensibili negli esempi
- Il "Try it out" esegue richieste reali al server

## CSP Headers

Swagger UI richiede alcune eccezioni CSP. La configurazione è già inclusa in `app.ts`:

```typescript
staticCSP: true,
transformStaticCSP: (header) => header,
```

Helmet è configurato per permettere il caricamento di Swagger UI.

## Troubleshooting

### Swagger UI non si carica
- Verifica che il server sia avviato: `pm2 list`
- Controlla i log: `pm2 logs backend`
- Verifica porta: `sudo netstat -tulpn | grep 3001`

### Errori CORS
- Verifica configurazione CORS in `app.ts`
- Assicurati che `FRONTEND_URL` sia impostato correttamente

### Schema non visibili
- Verifica che le route abbiano la proprietà `schema`
- Controlla che i tag siano dichiarati nella configurazione Swagger
- Riavvia il server: `pm2 restart backend`

## Riferimenti

- [Fastify Swagger Documentation](https://github.com/fastify/fastify-swagger)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/)
