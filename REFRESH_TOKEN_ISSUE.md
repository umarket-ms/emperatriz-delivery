# Problema: Refresh Token entre App Delivery (React Native/Expo) y Backend (NestJS)

> **⚠️ Actualización (migración WebSocket → SSE).** Este documento describe la
> época en la que el refresh se hacía primero por Socket.IO
> (`emitWithAck('token.refresh')`) y el tiempo real iba por WebSocket.
> **Eso ya no existe**:
>
> - El tiempo real de bajada es **SSE** (`GET /api/v1/events` con
>   `Authorization: Bearer` → `services/eventStreamService.ts`).
> - La subida de ubicación es **`POST /courier-locations`**
>   → `services/courierLocationService.ts`.
> - `refreshAccessToken()` en `services/tokenManager.ts` es **exclusivamente
>   HTTP** (`POST /auth/refresh-token`); se eliminó `refreshViaWebSocket`.
>
> Las reglas de limpieza de tokens y la ventana de gracia descritas aquí
> siguen vigentes. El resto de secciones relacionadas con el "refresh vía
> WebSocket" deben leerse como histórico.

## Contexto

Tenemos una **app móvil de delivery** (React Native + Expo SDK 54) que se comunica con un **backend NestJS** mediante HTTP y WebSocket (Socket.IO). Los conductores (mensajeros) usan la app todo el día para recibir entregas, actualizar estados, y enviar su ubicación GPS.

El problema central es que **el access token expira y no se refresca correctamente**, causando que todas las llamadas HTTP fallen con 401 y la app pierda funcionalidad.

---

## Arquitectura de Tokens

### Backend (NestJS)

El backend maneja 3 tipos de tokens:

1. **Access Token** (JWT):
   - TTL: 15 minutos (configurable vía `JWT_EXPIRATION_TIME`)
   - Almacenado: HttpOnly cookie `td_access` Y header `Authorization: Bearer`
   - Firmado con: `JWT_ACCESS_SECRET` (o fallback `JWT_SECRET`)
   - Contiene: `sub/id`, `email`, `enterprise`, `roles`

2. **Refresh Token** (JWT + DB):
   - TTL: 7 días (configurable vía `JWT_REFRESH_EXPIRATION_TIME`)
   - Almacenado: HttpOnly cookie `td_refresh` Y tabla `refresh_tokens` en PostgreSQL
   - Firmado con: `JWT_REFRESH_SECRET`
   - **Rotación**: Cada uso revoca el anterior y emite uno nuevo (refresh token rotation)
   - Guardado como SHA-256 hash en DB (nunca el token crudo)

3. **CSRF Token**:
   - Almacenado: cookie `td_csrf` (NO HttpOnly, legible por JS)
   - Enviado en header `X-CSRF-Token` para mutaciones

### Backend: `TokenRefreshMiddleware` (corre en CADA request HTTP)

```
Request HTTP llega
  → Extrae access token de cookie O header Authorization
  → Extrae refresh token de cookie
  → ¿Access token válido? → Sí → next()
  → ¿Access token expirado + refresh token existe?
    → Adquiere Redis distributed lock (`refresh_lock:{userId}`, TTL 10s, NX)
    → Llama `authCreateService.refreshToken(refreshToken)`
    → Revoca el refresh token viejo en DB
    → Emite nuevos tokens (access + refresh)
    → Guarda nuevo refresh token hash en DB
    → Setea nuevo refresh token en cookie
    → Setea `req.headers.authorization = Bearer {nuevo access token}`
    → Libera lock
    → next()
```

**Punto clave**: El middleware auto-refresca el access token en CADA request HTTP. El cliente NO necesita hacer nada especial — el middleware lo maneja todo via cookies.

### Backend: Endpoint explícito `POST /api/auth/refresh-token`

- **Público** (`@IsPublic()`) — no requiere access token
- Rate limited: 10 requests por 60 segundos
- Lee refresh token de cookie O `req.body.refresh_token`
- Misma lógica que el middleware: revoca viejo, emite nuevos
- Retorna: `{ access_token, refresh_token, user, carrier, csrf_token, expiresIn }`

### Backend: WebSocket Gateway (`MessagesWsGateway`)

- **Autenticación**: Middleware Socket.IO que verifica JWT en el handshake
- **NO tiene auto-refresh**: Si el token expira mientras el socket está conectado, la conexión se mantiene. Si el cliente se reconecta con token expirado, se rechaza.
- **NO tiene eventos de token refresh**: No hay ningún evento WebSocket para refrescar tokens
- **Tokens en handshake**: Cookie `td_access` O `socket.handshake.auth.token`

### Backend: Rotación de Refresh Token (CRÍTICO)

El backend usa **refresh token rotation**:
1. Cada refresh token solo se puede usar **UNA vez**
2. Al usarlo, se revoca (`revoked_at` se setea en DB)
3. Se emite un refresh token nuevo
4. Si se intenta usar un token ya revocado → error "Refresh token inválido o revocado" (status 500)

**Esto significa**: Si dos componentes intentan refrescar el token al mismo tiempo con el mismo refresh token, solo uno tiene éxito. El otro recibe error porque el token ya fue revocado.

---

## App Delivery (React Native/Expo)

### Almacenamiento de Tokens

| Token | Dónde se almacena | Quién lo lee |
|-------|-------------------|--------------|
| Access Token | **Memoria** (`authStore.ts` — variables module-scope) | `api.ts` para cada request HTTP, `websocketService.ts` para el handshake |
| CSRF Token | **Memoria** (`authStore.ts`) | `api.ts` para mutaciones (POST/PUT/PATCH/DELETE) |
| Refresh Token | **Expo SecureStore** (encriptado por el SO) | `tokenManager.ts`, `authService.ts` |
| Datos de usuario | **AsyncStorage** (no sensible, fallback offline) | `authService.ts` |

### Servicios de Red

#### `api.ts` — Cliente HTTP centralizado

```
apiRequest(endpoint, options)
  → getAuthOptions() inyecta Authorization + CSRF headers
  → fetch(url, options)
  → ¿Response 401? (excluyendo endpoints /auth/*)
    → refreshAccessToken() de tokenManager
    → ¿Éxito? → Reintentar request con token nuevo
    → ¿Fallo? → authFailureHandler (logout)
```

#### `tokenManager.ts` — Refresh centralizado con deduplicación

```
refreshAccessToken()
  → ¿Ya hay refresh en progreso? → reutilizar Promise (dedup)
  → doRefresh():
    → getStoredRefreshToken() de SecureStore
    → ¿WebSocket conectado? → refreshViaWebSocket()
    → Si no hay socket → refreshViaHttp() (fallback)
    → Retorna { accessToken, csrfToken, refreshToken, user, carrier } o null
```

**`refreshViaWebSocket()`**:
```
socketService.emitWithAck('token.refresh', { refresh_token }, 15000)
  → Espera respuesta del backend
  → ¿Éxito? → actualiza authStore + SecureStore
  → ¿Error "inválido/revocado"? → limpia tokens
  → ¿Timeout/sin respuesta? → retorna null (fallback HTTP)
```

**`refreshViaHttp()`**:
```
fetch(POST /api/auth/refresh-token, { refresh_token })
  → ¿Status 401/403? → limpia tokens (token inválido)
  → ¿Status 500? → NO limpia tokens (puede ser error temporal)
  → ¿Éxito? → actualiza authStore + SecureStore
```

#### `websocketService.ts` — Conexión Socket.IO

```
connect()
  → ensureFreshAccessToken() de tokenManager
  → Crea socket con auth callback que lee token de authStore
  → Handler CONNECT → startProactiveRefresh()
  → Handler DISCONNECT → stopProactiveRefresh()
    → ¿io server disconnect? → reconectar con token fresco
    → ¿transport close/ping timeout? → refresh + reconectar
  → Handler CONNECT_ERROR
    → ¿Error de auth? → refreshAccessToken() + reconnectWithNewToken()

startProactiveRefresh() (cada 60 segundos):
  → ¿Token expirado? → refreshAccessToken() + reconnectWithNewToken()
```

#### `authService.ts` — Login/Logout/Refresh de sesión

```
login(email, password):
  → api.post(/api/auth/login-delivery)
  → Guarda access_token en authStore
  → Guarda refresh_token en SecureStore
  → Guarda user/roles/carrier en authStore + AsyncStorage

refreshSession():
  → refreshAccessToken() de tokenManager
  → Si trae user data (vía WebSocket) → úsala directamente
  → Si no (HTTP fallback) → fetchWhoami() para obtener user data

logout():
  → authStore.clearSession()
  → clearRefreshToken() de SecureStore
  → Limpia AsyncStorage
```

#### `context/AuthContext.tsx` — Orquestador

```
Al montar (useEffect):
  → isAuthenticated()? → ¿hay refresh token en SecureStore?
  → ¿Sesión >24h? → forzar logout
  → refreshSession() → conectar WebSocket
  → Si falla → fetchWhoami() fallback
  → Si ambos fallan → logout

login():
  → authService.login()
  → Guarda timestamp de login
  → socketService.connect()

logout():
  → socketService.disconnect()
  → authService.logout()
```

---

## El Problema

### Síntoma principal

Cuando el access token expira (después de 15 minutos), la app no puede refrescarlo. Los logs muestran:

```
[api] 401 detectado en /cxp-invoices/seller/earnings , intentando refresh token...
[TokenManager] No hay refresh token disponible
[api] Refresh token falló, sesión inválida
```

El refresh token **no está en SecureStore** cuando se intenta usar.

### Lo que sucede paso a paso

1. Usuario hace login → access token (15min) + refresh token (7días) se guardan
2. Pasan 15 minutos → access token expira
3. Usuario intenta hacer algo → request HTTP →401
4. Interceptor de `api.ts` detecta401 → llama `refreshAccessToken()`
5. `refreshAccessToken()` llama `doRefresh()`
6. `doRefresh()` llama `getStoredRefreshToken()` → **retorna null**
7. No hay refresh token → no se puede refrescar → sesión inválida

### Por qué no hay refresh token

El refresh token fue **limpiado previamente** por una de estas rutas:

1. **`refreshViaHttp()` en tokenManager.ts** — Antes limpiaba en 401/403/**500**. Si el backend retornaba 500 (que es lo que retorna por "token inválido"), se borraba el token. **FIX APLICADO**: Ahora solo limpia en 401/403.

2. **`refreshViaWebSocket()` en tokenManager.ts** — Si el backend respondía `{ message: "Refresh token inválido o revocado" }`, limpiaba el token.

3. **`authService.logout()`** — Llamado por AuthContext cuando la sesión era >24h.

4. **`AuthContext` checkAuth** — Si `refreshSession()` y `fetchWhoami()` ambos fallaban, hacía logout.

### La trampa de la rotación de token

El problema se agrava por la **rotación de refresh token**:

1. El access token expira
2. Alguien intenta refresh → envía refresh token viejo
3. Backend recibe, revoca el viejo, emite uno nuevo
4. **Si la respuesta no llega al cliente** (timeout, error de red, etc.), el cliente no recibe el token nuevo
5. El cliente intenta de nuevo con el **mismo token viejo** → backend dice "inválido o revocado" → cliente limpia todo
6. Ahora no hay refresh token → re-login obligatorio

### Código duplicado que causaba conflictos

Había **dos implementaciones independientes** de refresh:

1. `authService.refreshSession()` — usaba `api.post()` directamente
2. `tokenManager.refreshAccessToken()` — usaba `fetch()` directamente

Ambas llamaban al mismo endpoint `/auth/refresh-token`. Si se ejecutaban simultáneamente:
- Ambas enviaban el mismo refresh token
- La primera tenía éxito y revocaba el token
- La segunda fallaba con "token inválido"
- La segunda limpiaba el token de SecureStore

**FIX APLICADO**: `authService.refreshSession()` ahora usa `tokenManager.refreshAccessToken()` (una sola ruta de refresh con deduplicación).

---

## Cambios Implementados Hasta Ahora

### 1. `tokenManager.ts` — Refresh centralizado (NUEVO ARCHIVO)
- Refresh con deduplicación (`pendingRefresh`)
- Intenta WebSocket primero, HTTP como fallback
- Limpia tokens solo en 401/403 (NO en 500)
- Retorna tokens + user data

### 2. `api.ts` — Interceptor 401 (MODIFICADO)
- Detecta401 en responses HTTP
- Excluye endpoints `/auth/*` (login, refresh, whoami)
- Llama `refreshAccessToken()` y reintenta una vez
- Flag `isRefreshing` para prevenir loops

### 3. `websocketService.ts` — Reconexión agresiva (MODIFICADO)
- Handler `CONNECT_ERROR`: refresh + reconexión inmediata
- Handler `DISCONNECT`: refresh para `transport close`/`ping timeout`
- `emitWithAck()`: emitir evento y esperar respuesta con timeout
- `startProactiveRefresh()`: cada 60s verifica token

### 4. `authService.ts` — Usa tokenManager (MODIFICADO)
- `refreshSession()` llama `tokenManager.refreshAccessToken()`
- Eliminada implementación duplicada de refresh

### 5. `auth-fetch.ts` — Logging de clearRefreshToken (MODIFICADO)
- `clearRefreshToken()` ahora loguea stack trace para rastrear quién lo limpia

### 6. `AuthContext.tsx` — Re-login periódico (MODIFICADO)
- Verifica timestamp de login al abrir app
- Si >24h → fuerza logout

### 7. Backend `messages-ws.gateway.ts` — Evento token.refresh (NUEVO)
- Handler `@SubscribeMessage('token.refresh')`
- Recibe `{ refresh_token }`, llama `authCreateService.refreshToken()`
- Retorna tokens + user data como acknowledgement

---

## Lo que AÚN NO funciona

1. **El refresh token desaparece de SecureStore** — Aunque limpiamos agresivamente en 500, necesitamos entender POR QUÉ el token no está disponible cuando se necesita. Puede ser que:
   - Nunca se guardó correctamente durante el login
   - Se limpió por una ruta que aún no identificamos
   - SecureStore tiene un bug o limitación en ciertos dispositivos

2. **La app necesita re-login manual** — Después de que el refresh token se borra, el usuario debe cerrar sesión y volver a hacer login. No hay recuperación automática.

3. **No hay mecanismo para detectar token revocado en el backend** — Si el backend revoca un refresh token (ej: admin fuerza logout, seguridad, etc.), la app no lo sabe hasta que intenta refrescar.

---

## Preguntas para la IA que analice este problema

1. ¿Es seguro limpiar el refresh token en errores de red/timeout, o debería reintentar antes?

2. ¿Cómo manejar el caso donde el WebSocket refresca el token exitosamente pero la respuesta se pierde (el backend ya rotó el token, pero el cliente no lo recibió)?

3. ¿Debería la app mantener una "copoa de seguridad" del refresh token en AsyncStorage (no encriptado) como fallback a SecureStore?

4. ¿Es correcto usar refresh token rotation para una app móvil, o debería usar refresh tokens de un solo uso con family detection?

5. ¿Cómo debería la app manejar el caso donde el backend está caído y el refresh token está por expirar? ¿Mantener la sesión local con datos cacheados?

6. ¿El `TokenRefreshMiddleware` del backend podría configurarse para funcionar con Bearer tokens (no cookies) para que la app móvil se beneficie del auto-refresh?

7. ¿Debería el WebSocket tener un mecanismo de "keep-alive" que verifique periódicamente la validez del token y notifique al cliente si está por expirar?

8. ¿Cuál es la mejor estrategia para una app de delivery donde el usuario puede tener la app abierta 8-12 horas seguidas?

---

## Archivos Relevantes del Backend

| Archivo | Propósito |
|---------|-----------|
| `backend/src/endpoints/admin/control-panel/auth/middlewares/token-refresh.middleware.ts` | Middleware que auto-refresca tokens en cada request HTTP |
| `backend/src/endpoints/admin/control-panel/auth/controllers/auth-session.controller.ts` | Endpoint `POST /auth/refresh-token` |
| `backend/src/endpoints/admin/control-panel/auth/application/use-cases/login.use-case.ts` | Lógica de refresh con rotación (método `refreshToken()`) |
| `backend/src/common/services/socket-messages/messages-ws.gateway.ts` | WebSocket gateway (nuevo handler `token.refresh`) |
| `backend/src/common/services/socket-messages/socket.module.ts` | Módulo que inyecta dependencias del gateway |
| `backend/src/endpoints/admin/control-panel/auth/strategies/jwt.strategy.ts` | Validación JWT en requests HTTP |
| `backend/src/endpoints/admin/control-panel/auth/config/cookie.config.ts` | Configuración de cookies y TTLs |

## Archivos Relevantes del Delivery

| Archivo | Propósito |
|---------|-----------|
| `delivery/services/tokenManager.ts` | Refresh centralizado con deduplicación (WebSocket + HTTP) |
| `delivery/services/api.ts` | Cliente HTTP con interceptor 401 |
| `delivery/services/websocketService.ts` | Conexión Socket.IO + `emitWithAck()` |
| `delivery/services/authService.ts` | Login/Logout/Refresh de sesión |
| `delivery/services/auth-fetch.ts` | SecureStore wrappers para refresh token |
| `delivery/stores/authStore.ts` | Almacenamiento en memoria de tokens |
| `delivery/context/AuthContext.tsx` | Orquestador de autenticación |
