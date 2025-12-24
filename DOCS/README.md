# ChatWidget SaaS - Documentación de Dependencias

## Descripción General

ChatWidget SaaS es una plataforma de chat en tiempo real con inteligencia artificial para tiendas e-commerce (Shopify, WooCommerce) y sitios web. El sistema permite a los usuarios embeber un widget de chat inteligente que responde automáticamente usando la API de OpenAI.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTES (Sitios Web)                        │
│         Shopify │ WooCommerce │ Landing Pages │ Webs            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Widget ChatKit SDK                          │
│              (Interfaz de chat embebida)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   ┌─────────────────┐                ┌─────────────────┐
   │   API REST      │                │   WebSocket     │
   │   (Fastify)     │                │   (Socket.io)   │
   │   Puerto 3000   │                │   Puerto 3001   │
   └────────┬────────┘                └────────┬────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌────────────┐      ┌────────────┐      ┌────────────┐
│ PostgreSQL │      │   Redis    │      │  OpenAI    │
│   (Datos)  │      │  (Cache)   │      │  (IA)      │
└────────────┘      └────────────┘      └────────────┘
```

---

## Dependencias del Backend

### 1. Runtime y Lenguaje

| Dependencia | Versión | Descripción |
|-------------|---------|-------------|
| **Node.js** | 20 LTS | Runtime de JavaScript del lado del servidor |
| **TypeScript** | 5.7.x | Superset tipado de JavaScript |
| **pnpm** | 9.x | Gestor de paquetes rápido y eficiente |

**¿Por qué Node.js 20?**
- Soporte LTS (Long Term Support) hasta 2026
- Mejoras de rendimiento significativas
- Soporte nativo para ES Modules
- APIs modernas como `fetch` incluidas

**¿Por qué TypeScript?**
- Detección de errores en tiempo de compilación
- Mejor autocompletado y documentación en el IDE
- Refactorización más segura
- Tipos compartidos entre API y WebSocket

---

### 2. Framework Web - Fastify

```json
{
  "fastify": "^5.1.0",
  "@fastify/cors": "^10.0.1",
  "@fastify/jwt": "^9.0.1",
  "@fastify/rate-limit": "^10.2.0"
}
```

**¿Qué es Fastify?**
Fastify es un framework web de alto rendimiento para Node.js. Es 2-3 veces más rápido que Express.

**Plugins utilizados:**

| Plugin | Función |
|--------|---------|
| `@fastify/cors` | Permite peticiones desde otros dominios (necesario para widgets embebidos) |
| `@fastify/jwt` | Autenticación con JSON Web Tokens para el dashboard |
| `@fastify/rate-limit` | Limita peticiones por IP para evitar abusos |

**Flujo de interacción:**
```
Cliente → Fastify → Validación (Zod) → Ruta → Servicio → Base de datos
                                                    ↓
                                              Respuesta JSON
```

---

### 3. Base de Datos - PostgreSQL + Drizzle ORM

```json
{
  "drizzle-orm": "^0.38.2",
  "drizzle-kit": "^0.30.1",
  "postgres": "^3.4.5"
}
```

**¿Qué es PostgreSQL?**
Base de datos relacional robusta y escalable. Elegida por:
- Soporte excelente para JSON (JSONB) - perfecto para configuraciones de widgets
- Transacciones ACID
- Escalabilidad horizontal con read replicas
- Búsqueda full-text para historial de conversaciones

**¿Qué es Drizzle ORM?**
ORM moderno y ligero con tipado completo en TypeScript.

**Ventajas sobre Prisma:**
- 10x más rápido en consultas
- Bundle más pequeño
- Sintaxis similar a SQL (curva de aprendizaje menor)
- No requiere cliente binario

**Esquema de la base de datos:**

```
tenants (Clientes SaaS)
    ├── id, email, password_hash, company_name, plan, api_key
    │
    └── widgets (Configuraciones de chat)
            ├── id, tenant_id, name, domain, config, is_active
            │
            └── conversations (Sesiones de chat)
                    ├── id, widget_id, visitor_id, status
                    │
                    └── messages (Mensajes individuales)
                            └── id, conversation_id, role, content
```

**Interacción:**
```
API Request → Drizzle ORM → postgres.js driver → PostgreSQL
                   ↓
            Tipos TypeScript generados automáticamente
```

---

### 4. Cache y Pub/Sub - Redis + ioredis

```json
{
  "ioredis": "^5.4.1"
}
```

**¿Qué es Redis?**
Base de datos en memoria extremadamente rápida. Usada para:

| Uso | Descripción |
|-----|-------------|
| **Sesiones** | Almacena datos de visitantes temporalmente |
| **Rate Limiting** | Cuenta peticiones por IP/widget |
| **Pub/Sub** | Sincroniza mensajes entre instancias WebSocket |
| **Cache** | Cachea configuraciones de widgets |
| **Typing indicators** | Estado "escribiendo..." con auto-expiración |

**¿Qué es ioredis?**
Cliente Redis para Node.js con soporte completo para:
- Clustering
- Sentinels (alta disponibilidad)
- Streams
- Pub/Sub

**Flujo Pub/Sub para WebSockets:**
```
Usuario envía mensaje
        ↓
WebSocket Server 1 recibe
        ↓
Publica en Redis: PUBLISH chat:conversation_123 "mensaje"
        ↓
Redis notifica a TODOS los servidores suscritos
        ↓
WebSocket Server 2, 3, N reciben y envían a sus clientes conectados
```

---

### 5. WebSockets - Socket.io

```json
{
  "socket.io": "^4.8.1",
  "@socket.io/redis-adapter": "^8.3.0"
}
```

**¿Qué es Socket.io?**
Librería para comunicación bidireccional en tiempo real.

**Características clave:**
- Reconexión automática si se pierde conexión
- Fallback a HTTP long-polling si WebSocket no está disponible
- Rooms (salas) para agrupar conexiones por conversación
- Broadcasting eficiente

**¿Qué es Redis Adapter?**
Permite escalar Socket.io horizontalmente. Sin él, cada servidor solo conocería sus propias conexiones.

**Con Redis Adapter:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ WS Server 1 │     │ WS Server 2 │     │ WS Server 3 │
│ (100 users) │     │ (100 users) │     │ (100 users) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │   Pub/Sub   │
                    └─────────────┘
                           │
            Mensaje llega a TODOS los 300 usuarios
```

**Eventos WebSocket definidos:**

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `chat:join` | Cliente → Servidor | Unirse a una conversación |
| `chat:message` | Cliente → Servidor | Enviar mensaje |
| `chat:typing` | Cliente → Servidor | Indicador de escritura |
| `chat:message:received` | Servidor → Cliente | Nuevo mensaje recibido |
| `chat:agent:streaming` | Servidor → Cliente | Chunk de respuesta IA |
| `chat:agent:complete` | Servidor → Cliente | Respuesta IA completada |

---

### 6. Inteligencia Artificial - OpenAI SDK

```json
{
  "openai": "^4.76.0"
}
```

**¿Qué es la API de OpenAI?**
Servicio de IA que proporciona modelos de lenguaje como GPT-4.

**Modelo utilizado:** `gpt-4o-mini`
- Rápido y económico
- Ideal para chat de soporte
- Soporta streaming (respuestas en tiempo real)

**Flujo de respuesta con streaming:**
```
Usuario: "¿Cuánto cuesta el envío?"
            ↓
WebSocket recibe mensaje
            ↓
Llama a OpenAI con stream: true
            ↓
OpenAI envía chunks: "El" → " envío" → " cuesta" → " $5.99"
            ↓
Cada chunk se envía al cliente via WebSocket
            ↓
Usuario ve la respuesta escribiéndose en tiempo real
```

**Código de streaming:**
```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  stream: true,  // ← Habilita streaming
});

for await (const chunk of stream) {
  socket.emit('chat:agent:streaming', { chunk: chunk.content });
}
```

---

### 7. Validación - Zod

```json
{
  "zod": "^3.24.1"
}
```

**¿Qué es Zod?**
Librería de validación con inferencia de tipos TypeScript.

**Uso en el proyecto:**
```typescript
// Definir esquema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
});

// Validar datos entrantes
const body = registerSchema.parse(request.body);
// Si falla, lanza error automáticamente
// Si pasa, 'body' tiene tipos correctos
```

**Beneficios:**
- Validación en runtime + tipos en compilación
- Mensajes de error descriptivos
- Transformaciones de datos
- Composición de esquemas

---

### 8. Seguridad

```json
{
  "bcrypt": "^5.1.1",
  "nanoid": "^5.0.9"
}
```

**bcrypt** - Hash de contraseñas
```typescript
// Guardar contraseña
const hash = await bcrypt.hash(password, 12); // 12 rounds

// Verificar contraseña
const valid = await bcrypt.compare(inputPassword, storedHash);
```

**nanoid** - Generación de IDs únicos
```typescript
// IDs con prefijo para identificación rápida
createId.tenant();       // → "ten_a8f3k2m9x1b4c7d0"
createId.widget();       // → "wgt_p2n5h8j1q4w7e0r3"
createId.apiKey();       // → "pk_x9c2v5b8n1m4k7j0h3g6f9d2s5a8w1q4"
```

---

### 9. Herramientas de Desarrollo

```json
{
  "tsx": "^4.19.2",
  "vitest": "^1.x",
  "eslint": "^9.x",
  "prettier": "^3.x",
  "dotenv": "^16.4.7"
}
```

| Herramienta | Función |
|-------------|---------|
| `tsx` | Ejecuta TypeScript directamente sin compilar |
| `vitest` | Testing rápido compatible con Jest |
| `eslint` | Detecta errores y enforce estilo de código |
| `prettier` | Formatea código automáticamente |
| `dotenv` | Carga variables de entorno desde `.env` |

---

## Infraestructura Docker

### Servicios

| Servicio | Imagen | Puerto | Descripción |
|----------|--------|--------|-------------|
| `postgres` | postgres:16-alpine | 5432 | Base de datos principal |
| `redis` | redis:7-alpine | 6379 | Cache y Pub/Sub |
| `api` | Node 20 custom | 3000 | API REST |
| `websocket` | Node 20 custom | 3001 | Servidor WebSocket |
| `nginx` | nginx:alpine | 80/443 | Reverse proxy |

### Flujo de Datos Completo

```
1. Usuario abre página con widget embebido
                    ↓
2. Widget carga configuración: GET /api/embed/:widgetId
                    ↓
3. Widget conecta WebSocket: wss://api.example.com/socket.io
                    ↓
4. Usuario envía mensaje
                    ↓
5. WebSocket recibe → Guarda en PostgreSQL → Llama OpenAI
                    ↓
6. OpenAI responde en streaming
                    ↓
7. Cada chunk se envía al widget en tiempo real
                    ↓
8. Respuesta completa se guarda en PostgreSQL
```

---

## Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgres://user:pass@host:5432/chatwidget

# Cache
REDIS_URL=redis://host:6379

# IA
OPENAI_API_KEY=sk-...

# Seguridad
JWT_SECRET=clave-secreta-minimo-32-caracteres

# Servidores
API_PORT=3000
WS_PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGINS=https://tudominio.com,https://app.tudominio.com
```

---

## Comandos Útiles

```bash
# Instalar dependencias
pnpm install

# Iniciar infraestructura (postgres + redis)
docker compose -f docker-compose.dev.yml up -d

# Generar migraciones de BD
pnpm db:generate

# Ejecutar migraciones
pnpm db:migrate

# Iniciar en desarrollo
pnpm dev

# Ver logs de Docker
pnpm docker:logs
```

---

## Próximos Pasos

1. [ ] Integración con Shopify OAuth
2. [ ] Integración con WooCommerce webhooks
3. [ ] Dashboard de analytics
4. [ ] Sistema de human takeover
5. [ ] Widget SDK con ChatKit



## Comentarios: 




## Dudas:

