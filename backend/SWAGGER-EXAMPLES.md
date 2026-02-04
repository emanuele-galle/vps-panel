# Esempi Schema OpenAPI/Swagger

Esempi pratici per aggiungere documentazione Swagger alle route Fastify.

## 1. Route GET Semplice (No Parametri)

```typescript
app.get('/projects', {
  schema: {
    tags: ['Projects'],
    summary: 'Lista tutti i progetti',
    description: 'Restituisce l\'elenco completo dei progetti PM2',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    response: {
      200: {
        description: 'Lista progetti',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string', enum: ['online', 'stopped', 'errored'] },
                port: { type: 'number' },
                domain: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  handler: projectsController.getAll.bind(projectsController),
});
```

## 2. Route GET con Parametri URL

```typescript
app.get('/projects/:id', {
  schema: {
    tags: ['Projects'],
    summary: 'Dettagli progetto',
    description: 'Restituisce i dettagli di un progetto specifico',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          description: 'ID del progetto',
          example: 'fodi-platform',
        },
      },
    },
    response: {
      200: {
        description: 'Dettagli progetto',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              port: { type: 'number' },
              domain: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      404: {
        description: 'Progetto non trovato',
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'PROJECT_NOT_FOUND' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  handler: projectsController.getById.bind(projectsController),
});
```

## 3. Route GET con Query String

```typescript
app.get('/projects', {
  schema: {
    tags: ['Projects'],
    summary: 'Lista progetti (paginata)',
    description: 'Restituisce progetti con paginazione e filtri',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    querystring: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description: 'Numero pagina',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Elementi per pagina',
        },
        status: {
          type: 'string',
          enum: ['online', 'stopped', 'errored'],
          description: 'Filtra per stato',
        },
        search: {
          type: 'string',
          description: 'Cerca nel nome o dominio',
        },
      },
    },
    response: {
      200: {
        description: 'Lista progetti paginata',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { type: 'object' },
          },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        },
      },
    },
  },
  handler: projectsController.getPaginated.bind(projectsController),
});
```

## 4. Route POST con Body

```typescript
app.post('/projects', {
  schema: {
    tags: ['Projects'],
    summary: 'Crea nuovo progetto',
    description: 'Crea un nuovo progetto PM2 con dominio Cloudflare',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    body: {
      type: 'object',
      required: ['name', 'port', 'domain'],
      properties: {
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 50,
          pattern: '^[a-z0-9-]+$',
          description: 'Nome progetto (slug)',
          example: 'my-project',
        },
        description: {
          type: 'string',
          maxLength: 200,
          description: 'Descrizione progetto',
        },
        port: {
          type: 'integer',
          minimum: 3010,
          maximum: 3033,
          description: 'Porta Node.js',
          example: 3018,
        },
        domain: {
          type: 'string',
          format: 'hostname',
          description: 'Dominio (senza protocollo)',
          example: 'myproject.fodivps1.cloud',
        },
        repository: {
          type: 'string',
          format: 'uri',
          description: 'URL repository Git',
          example: 'https://github.com/user/repo.git',
        },
        envVars: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Variabili ambiente',
          example: {
            NODE_ENV: 'production',
            API_KEY: 'xxx',
          },
        },
      },
    },
    response: {
      201: {
        description: 'Progetto creato',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              domain: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      400: {
        description: 'Dati non validi',
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      409: {
        description: 'Conflitto (nome o porta già in uso)',
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'object' },
        },
      },
    },
  },
  handler: projectsController.create.bind(projectsController),
});
```

## 5. Route PUT con Parametri e Body

```typescript
app.put('/projects/:id', {
  schema: {
    tags: ['Projects'],
    summary: 'Aggiorna progetto',
    description: 'Aggiorna configurazione progetto esistente',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID progetto' },
      },
    },
    body: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        port: { type: 'integer', minimum: 3010, maximum: 3033 },
        domain: { type: 'string', format: 'hostname' },
        envVars: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
    },
    response: {
      200: {
        description: 'Progetto aggiornato',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    },
  },
  handler: projectsController.update.bind(projectsController),
});
```

## 6. Route DELETE

```typescript
app.delete('/projects/:id', {
  schema: {
    tags: ['Projects'],
    summary: 'Elimina progetto',
    description: 'Elimina un progetto e rimuove il dominio Cloudflare',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID progetto' },
      },
    },
    querystring: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          default: false,
          description: 'Forza eliminazione anche se online',
        },
      },
    },
    response: {
      200: {
        description: 'Progetto eliminato',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
      409: {
        description: 'Conflitto (progetto in esecuzione)',
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'object' },
        },
      },
    },
  },
  handler: projectsController.delete.bind(projectsController),
});
```

## 7. Route con File Upload (Multipart)

```typescript
app.post('/projects/:id/upload', {
  schema: {
    tags: ['Projects'],
    summary: 'Carica file progetto',
    description: 'Carica file nel progetto (multipart/form-data)',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    consumes: ['multipart/form-data'],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
    // Note: Fastify multipart body schema è limitato
    response: {
      200: {
        description: 'File caricato',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              size: { type: 'number' },
              path: { type: 'string' },
            },
          },
        },
      },
    },
  },
  handler: projectsController.uploadFile.bind(projectsController),
});
```

## 8. Route Senza Autenticazione

```typescript
app.get('/health', {
  schema: {
    tags: ['Health'],
    summary: 'Health check',
    description: 'Verifica stato servizio (endpoint pubblico)',
    // NO security property = pubblico
    response: {
      200: {
        description: 'Servizio attivo',
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number', description: 'Uptime in secondi' },
        },
      },
    },
  },
  handler: healthController.check.bind(healthController),
});
```

## 9. Schema con Riferimenti (Components)

Definisci schema riutilizzabili nella configurazione Swagger in `app.ts`:

```typescript
await app.register(swagger, {
  openapi: {
    // ... altre config
    components: {
      schemas: {
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string' },
            port: { type: 'number' },
            domain: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
});
```

Poi usa i riferimenti:

```typescript
response: {
  200: {
    description: 'Progetto trovato',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Project' },
      },
    },
  },
  404: {
    description: 'Errore',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  },
}
```

## 10. Schema con Esempi Multipli

```typescript
response: {
  200: {
    description: 'Risposta di successo',
    content: {
      'application/json': {
        schema: { type: 'object' },
        examples: {
          success: {
            summary: 'Operazione riuscita',
            value: {
              success: true,
              data: { id: '123', name: 'Test' },
            },
          },
          empty: {
            summary: 'Nessun risultato',
            value: {
              success: true,
              data: [],
            },
          },
        },
      },
    },
  },
}
```

## Best Practices

1. **Usa sempre i tag** per raggruppare endpoint
2. **Security** esplicito per route protette
3. **Descrizioni chiare** per summary e description
4. **Enum** per valori limitati (status, roles, etc.)
5. **Format** per tipi specifici (email, uri, date-time, etc.)
6. **Pattern** per validazione regex
7. **Min/Max** per numeri e lunghezze stringhe
8. **Required** per parametri obbligatori
9. **Examples** per chiarire l'uso
10. **Multiple responses** (200, 400, 401, 404, 500)

## Validazione Automatica

Fastify usa gli schema per:
- Validare input (params, query, body)
- Serializzare output (response)
- Generare documentazione Swagger

Un unico schema, tre benefici!
