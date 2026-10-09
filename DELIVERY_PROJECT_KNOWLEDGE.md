# Delivery App — Documentación Integral de Funcionalidades y Mapa de Código

> Proyecto analizado: `c:/Users/antar/Documents/PROYECTOS/delivery`
> Stack: Expo + React Native + Expo Router + Context API + Socket.IO + integración OSRM

---

## 1) Resumen ejecutivo

`delivery` es una app móvil para mensajeros (couriers) que permite:

- autenticarse,
- recibir y visualizar asignaciones de entrega en tiempo real,
- gestionar una entrega en progreso,
- actualizar estados de entrega con evidencia y datos de cobro,
- calcular y visualizar rutas optimizadas,
- enviar ubicación del mensajero en tiempo real por WebSocket.

La app está estructurada en capas:

- **UI/Pantallas**: `app/` + `components/`
- **Estado global**: `context/` + `contexts/`
- **Reglas de negocio**: `hooks/` + `interfaces/delivery/*`
- **Integración externa**: `services/*` + `utils/*`

---

## 2) Stack, runtime y configuración

## 2.1 Dependencias relevantes

Archivo: `package.json`

- `expo`, `react-native`, `expo-router`
- `socket.io-client`
- `react-native-maps`
- `expo-location`
- `expo-image-picker`
- `expo-audio`
- `@react-native-async-storage/async-storage`

## 2.2 Configuración de entorno

Archivo: `app.json`

- API URLs en `expo.extra.apiUrl`
- Socket URL en `expo.extra.socketUrl`
- permisos Android: ubicación y audio
- esquema deep link: `tiendasdominicanasdelivery`
- intent filters para `geo:` y Google Maps

## 2.3 Resolución de API base

Archivo: `utils/constants.ts` + `services/api.ts`

- `API_URLS` se toma de `Constants.expoConfig.extra`
- en dev:
  - iOS usa `DEV_IOS`
  - Android usa `DEV_ANDROID`
- en prod usa `PROD`
- `API_URL = {base}/api`

---

## 3) Arquitectura de navegación

## 3.1 Root layout y guard de rutas

Archivo: `app/_layout.tsx`

### Funciones clave

- `RootLayout`: carga fuentes/splash y boot loader visual.
- `RootLayoutNav`: monta providers globales y stack de rutas.
- `ProtectedRouteGuard`: controla redirección login/app según autenticación.

### Proveedores montados (orden)

1. `AuthProvider`
2. `ActiveDeliveryProvider`
3. `DeliveryProvider`
4. `ThemeProvider`

### Pantallas del stack

- `(tabs)` (principal)
- `modal` (demo/genérica)
- `login`

### Responsabilidades adicionales del root

- oculta barra de navegación Android
- inicia listeners de deep links (`setupDeepLinkListeners`)
- monitor de conectividad API cada 15s para refrescar entregas al volver online

## 3.2 Tabs

Archivo: `app/(tabs)/_layout.tsx`

- `index`: lista de envios y flujo principal
- `two`: ajustes / usuario / logout
- `status-update`: ruta oculta del tab bar (`href: null`)

---

## 4) Estado global (Contexts)

## 4.1 Auth

Archivo: `context/AuthContext.tsx`

### Estado

- `isAuthenticated`
- `isLoading`
- `user`
- `roles`

### Métodos

- `login(email, password)`
- `logout()`
- `hasPermission(roleTitle)`

### Reglas importantes

- al iniciar, `checkAuth()` lee AsyncStorage vía `authService`
- cuando hay sesión:
  - configura `courierLocationTracking.setUserId(user.id)`
  - escucha cambios de conexión socket
  - inicia/detiene tracking automáticamente según conexión

## 4.2 Delivery

Archivo: `context/DeliveryContext.tsx`

### Estado

- `deliveries`: lista visible (sin la entrega en progreso)
- `allDeliveries`: lista completa del backend
- `inProgressDelivery`: entrega única en estado `IN_PROGRESS`
- `loading`, `refreshing`, `error`

### Métodos

- `fetchDeliveries(isRefreshing?)`
- `onRefresh()`
- `handleDeliveryUpdated(data)`
- `handleDeliveryAssigned(data)`
- `handleDriversGroupAssigned(data[])`
- `handleDeliveryReordered(data[])`
- `updateLocalDeliveryStatus(deliveryId, newStatus)`

### Reglas clave

- si llega una entrega `IN_PROGRESS`, se separa del listado principal y se marca como activa.
- si backend retorna `Unauthorized`, ejecuta `logout()`.

## 4.3 ActiveDelivery

Archivo: `context/ActiveDeliveryContext.tsx`

### Estado

- `activeDelivery`

### Métodos

- `setActiveDelivery(delivery | null)`
- `getNextDeliveryToProcess(deliveries)`
- `canProcessNewDelivery(deliveries)`

### Regla actual

- solo permite procesar nueva entrega si `activeDelivery === null`.

## 4.4 Route (optimización/ruta)

Archivo: `contexts/RouteContext.tsx`

### Estado

- `tripData`
- `tripLoading`, `tripError`
- `showTripMap`
- `tripDeliveries`

### Métodos

- `startRoutes(allDeliveries)`
- `recalculateRoutes(allDeliveries)`
- `closeTripMap()`
- `setTripDeliveries(deliveries)`

### Flujo de `startRoutes`

1. valida usuario autenticado
2. obtiene ubicación actual (`courierLocationTracking.getCurrentLocation`)
3. solicita ruta optimizada al backend (`DeliveryService.getOptimizedRoute`)
4. filtra entregas pendientes con coordenadas
5. ejecuta `fetchTrip` (OSRM) para render en mapa

---

## 5) Pantallas y funcionalidades

## 5.1 Login

Archivo: `app/login.tsx`

### Funcionalidades

- formulario email/password
- verificación de conectividad previa al login (`checkApiConnectivity`)
- toggle mostrar/ocultar contraseña
- logout preventivo al montar pantalla

### Método principal

- `handleLogin()`:
  - valida campos
  - valida conexión
  - invoca `useAuth().login`
  - maneja mensajes detallados de error

## 5.2 Home de entregas

Archivo: `app/(tabs)/index.tsx`

### Funcionalidades

- conecta WebSocket y listeners de eventos
- muestra:
  - estado de carga/error/sin entregas (`AppStateScreen`)
  - `ActiveDeliveryCard`
  - `DeliveryItemList`
- abre flujo de progreso hacia `/(tabs)/status-update`
- abre modal de mapa optimizado (`TripMap`)

### Métodos importantes

- `getDeliveryFromGroup(deliveries)`: decide siguiente entrega procesable considerando grupos.
- `handlePressItem()`: lógica de navegación a actualización de estado.
- `handleStartRoutes()`: dispara optimización de ruta.

## 5.3 Actualización de estado

Archivo: `app/(tabs)/status-update.tsx`

### Funcionalidades

- lista de estados válidos según transición
- reglas de validación por tipo/estado
- captura de evidencia:
  - cámara
  - galería
- captura de pago:
  - monto pagado
  - método de pago
- envío con o sin imágenes

### Métodos críticos

- `handleConfirm()`:
  - valida formulario y reglas condicionales
  - calcula `statusId` (`getStatusIdFromTitle`)
  - envía update por:
    - `DeliveryService.updateDeliveryStatusWithImages`
    - o `DeliveryService.updateDeliveryStatus`
  - refresca entregas y vuelve atrás

## 5.4 Ajustes

Archivo: `app/(tabs)/two.tsx`

- muestra datos de usuario y roles
- logout con `useAuth().logout`

---

## 6) Componentes de UI por dominio

## 6.1 Cabecera y estado socket

- `components/AppHeader.tsx`
- `components/socketstatusindicator.tsx`

Responsables de UI de cabecera y estado conectado/desconectado del socket.

## 6.2 Lista de entregas y card activa

- `components/ActiveDeliveryCard.tsx`
- `components/delivery-items/DeliveryItemList.tsx`
- `components/delivery-items/DeliveryItem.tsx`
- `components/delivery-items/DeliveryGroupItem.tsx`

Puntos clave:

- cálculo visual de monto total (`deliveryCost + amountToBeCharged`)
- acciones rápidas: llamada y WhatsApp
- en lista, solo el primer item obtiene `onProgress`

## 6.3 Mapa y ruta

- `components/TripMap.tsx`
- `components/RouteInfoPanel.tsx`
- `components/DeliveryModal.tsx`

`TripMap` concentra:

- render de polyline OSRM
- agrupación de waypoints por coordenadas exactas
- marker con contador de entregas en el mismo punto
- simulación de viaje en dev y tracking real en prod
- apertura de modal con entregas por marker

## 6.4 Estado de entrega (subcomponentes)

- `components/status-update/StatusList.tsx`
- `components/status-update/PaymentControls.tsx`
- `components/status-update/EvidenceSection.tsx`
- `components/status-update/NoteInput.tsx`

Separan UI y validaciones visuales del flujo principal de `status-update.tsx`.

## 6.5 Notificaciones

- `components/NotificationHandler.tsx`
- `services/notificationService.ts`

Patrón:

- encolar notificación en servicios/sockets
- poll cada 500ms
- mostrar toast + reproducir audio `assets/sounds/ndc.mp3`

---

## 7) Servicios (API, socket, ubicación)

## 7.1 Capa API base

Archivo: `services/api.ts`

### Funciones centrales

- `getBaseUrl()`, `API_URL`, `PRODUCT_IMAGE_URL`
- `apiRequest<T>()`
- wrapper `api.get/post/put/patch/delete/postFormData`
- refresh token automático ante `401` (si hay `refresh_token`)

### Storage keys

- `auth_token`
- `refresh_token`

## 7.2 Autenticación

Archivo: `services/authService.ts`

### Métodos

- `login(email, password)`
- `logout()`
- `isAuthenticated()`
- `getAuthData()`
- `refreshToken()`

### Nota de implementación

- intenta primero `fetch` directo a `/auth/login`
- fallback a `api.post('auth/login-delivery', ...)`

## 7.3 Entregas

Archivo: `services/deliveryService.ts`

### Métodos

- `getDeliveries(filters?)`
- `getDeliveryById(id)`
- `getDeliveryDestinies(deliveryId)`
- `updateDelivery(id, data)`
- `updateDeliveryStatus(...)`
- `updateDeliveryStatusWithImages(updateData)`
- `getOptimizedRoute(courierId, currentLocation)`

### Endpoints (vía `BackendUrls`)

- `delivery-assignments/...`
- `delivery-status`
- `payment-methods`
- `admin/osrm/route`
- `admin/osrm/trip`

## 7.4 Estados de entrega

Archivo: `services/deliveryStatusService.ts`

- `getDeliveryStatuses()`
- `getDeliveryStatusById(id)`

## 7.5 Métodos de pago

Archivo: `services/paymentMethodService.ts`

- `getPaymentMethods()`

## 7.6 WebSocket

Archivo: `services/websocketService.ts`

### Eventos enumerados

- `DRIVER_ASSIGNED`
- `DELIVERY_UPDATED`
- `DELIVERY_STATUS_CHANGED`
- `DELIVERY_REORDERED`
- `DELIVERY_ASSIGNMENT_UPDATED`
- `DRIVERS_GROUP_ASSIGNED`

### Métodos

- `connect()` / `disconnect()`
- `on(event, cb)` / `off(event, cb)`
- `onConnectionChange(cb)` / `offConnectionChange(cb)`
- `emit(event, data)`
- `isConnected()`

### Comportamiento

- encola notificaciones toast/audio al recibir eventos relevantes

## 7.7 Tracking de ubicación del courier

Archivo: `services/courierLocationService.ts`

### Métodos

- `initialize(config?)`
- `setUserId(userId)`
- `requestPermissions()` / `hasPermissions()`
- `startTracking()` / `stopTracking()`
- `getTrackingStatus()`
- `getCurrentLocation()`

### Detalles

- en dev: 10s y `minDistance = 0`
- en prod: 15s y `minDistance = 10m`
- emite por socket: `courier.location.update`

## 7.8 OSRM

Archivo: `services/osrmService.ts`

- `getRoute(params)`
- `getTrip(params)`

## 7.9 Servicios auxiliares

- `services/externalServiceHandler.ts`: actualmente vacío

---

## 8) Hooks de negocio

- `hooks/useStatusData.ts`:
  - carga catálogos de estado
  - calcula estados válidos por transición
- `hooks/useEvidenceFlags.ts`:
  - define cuándo exigir cámara/galería
- `hooks/usePaymentMethods.ts`:
  - carga métodos de pago
- `hooks/useOsrmTrip.ts`:
  - wrapper para trip OSRM
- `hooks/useOsrmRoute.ts`:
  - wrapper para route OSRM
- `hooks/useDeliveryActions.ts`:
  - atajos para refresco y update local

---

## 9) Modelo de datos y adaptadores

## 9.1 Entidades principales

Archivo: `interfaces/delivery/delivery.ts`

- `IDeliveryAssignmentEntity`
- `IDeliveryAssignmentSummaryEntity`
- `IUpdateDeliveryStatusData`
- `OrderEntity` / `OrderDetailEntity`
- `AdditionalDataNominatimEntity`

## 9.2 Adaptación para UI

Archivo: `interfaces/delivery/deliveryAdapters.ts`

### Funciones clave

- `adaptDeliveriesToAdapter(deliveries)`
- `groupDeliveriesByShipment(deliveries)`

### Uso

- normaliza payload backend a estructura consumible por la UI.
- agrupa por `shipmentId` cuando `isGroup = true`.

## 9.3 Estados y transiciones

Archivo: `interfaces/delivery/deliveryStatus.ts`

### Enum

- `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `DELIVERED`, `CANCELLED`, `RETURNED`, `ON_HOLD`, `SCHEDULED`

### Utilidades

- `validStatusTransitions`
- `getStatusColor(status)`
- `getStatusIdFromTitle(title)`
- `setDeliveryStatuses(statuses)` / `getDeliveryStatuses()`

---

## 10) Integraciones y utilidades

- `utils/whatsapp.ts`: abre chat en WhatsApp app/web
- `utils/deepLinkHandler.ts`:
  - parsea coordenadas de URLs compartidas
  - envía coordenadas al backend OSRM
  - registra listeners de deep links
- `constants/CustomColors.ts`: tema visual central

---

## 11) Flujo E2E principal (operativo)

1. Usuario abre app
2. `app/_layout.tsx` monta providers + guard
3. Si no auth → `/login`
4. Login exitoso guarda token y usuario
5. Guard redirige a `/(tabs)`
6. `DeliveryContext.fetchDeliveries()` carga asignaciones
7. `index.tsx` escucha socket para altas/cambios/reordenamientos
8. Mensajero inicia/continúa una entrega (`status-update`)
9. Envía actualización de estado con o sin evidencia
10. `fetchDeliveries()` sincroniza estado local
11. Si inicia rutas, `RouteContext.startRoutes()` pide optimización y abre `TripMap`
12. Tracking de ubicación corre en paralelo si socket conectado

---

## 12) Guía de cambios: “Quiero cambiar X, ¿dónde toco?”

## 12.1 Login / sesión

- UI login: `app/login.tsx`
- reglas auth global: `context/AuthContext.tsx`
- integración endpoint/login tokens: `services/authService.ts`
- inyección token en requests: `services/api.ts`

## 12.2 URLs backend / entorno

- variables base: `app.json` (`expo.extra.apiUrl`)
- selector de URL runtime: `utils/constants.ts` + `services/api.ts:getBaseUrl`

## 12.3 Eventos en tiempo real

- definición de eventos: `services/websocketService.ts:SocketEventType`
- acciones al recibir eventos: `services/websocketService.ts:setupEventListeners`
- consumo UI/contexto: `app/(tabs)/index.tsx` + `context/DeliveryContext.tsx`

## 12.4 Lista y orden de entregas

- obtención y normalización: `context/DeliveryContext.tsx:fetchDeliveries`
- card/lista visual: `components/ActiveDeliveryCard.tsx`, `components/delivery-items/*`
- reglas de “siguiente entrega”: `app/(tabs)/index.tsx:getDeliveryFromGroup`

## 12.5 Progreso de estado + validaciones

- pantalla principal y reglas: `app/(tabs)/status-update.tsx`
- transiciones permitidas: `interfaces/delivery/deliveryStatus.ts:validStatusTransitions`
- carga de estados backend: `hooks/useStatusData.ts`
- reglas evidencia: `hooks/useEvidenceFlags.ts`
- métodos pago: `hooks/usePaymentMethods.ts` + `services/paymentMethodService.ts`

## 12.6 Evidencia fotográfica

- UI: `components/status-update/EvidenceSection.tsx`
- captura cámara/galería: `app/(tabs)/status-update.tsx:takePhoto/selectImageFromGallery`
- envío form-data: `services/deliveryService.ts:updateDeliveryStatusWithImages`

## 12.7 Cálculo/visualización de ruta

- orquestación de rutas: `contexts/RouteContext.tsx`
- endpoint optimizado backend: `services/deliveryService.ts:getOptimizedRoute`
- OSRM client: `services/osrmService.ts:getTrip/getRoute`
- render mapa y markers: `components/TripMap.tsx`
- panel de métricas: `components/RouteInfoPanel.tsx`
- modal de detalle por marker: `components/DeliveryModal.tsx`

## 12.8 Tracking de ubicación courier

- lógica central: `services/courierLocationService.ts`
- activación por auth/socket: `context/AuthContext.tsx`
- indicador visual: `components/LocationTrackingIndicator.tsx`

## 12.9 Notificaciones

- cola y tipos: `services/notificationService.ts`
- render toast + audio: `components/NotificationHandler.tsx`
- origen de notificaciones: `services/websocketService.ts`

## 12.10 Deep links de mapas

- parser y listeners: `utils/deepLinkHandler.ts`
- bootstrap listeners: `app/_layout.tsx` (`setupDeepLinkListeners`)

---

## 13) Mapa de archivos clave (rápido)

- **Root/Navegación**: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- **Pantallas**: `app/login.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/status-update.tsx`, `app/(tabs)/two.tsx`
- **Contextos**: `context/AuthContext.tsx`, `context/DeliveryContext.tsx`, `context/ActiveDeliveryContext.tsx`, `contexts/RouteContext.tsx`
- **Servicios**: `services/api.ts`, `services/authService.ts`, `services/deliveryService.ts`, `services/websocketService.ts`, `services/courierLocationService.ts`, `services/osrmService.ts`
- **Estado/negocio**: `interfaces/delivery/deliveryStatus.ts`, `interfaces/delivery/deliveryAdapters.ts`
- **UI reusable**: `components/TripMap.tsx`, `components/DeliveryModal.tsx`, `components/status-update/*`
- **Utils**: `utils/constants.ts`, `utils/deepLinkHandler.ts`, `utils/whatsapp.ts`

---

## 14) Observaciones técnicas y deuda detectada

1. `services/externalServiceHandler.ts` está vacío.
2. En `services/authService.ts`, coexistencia de login por `fetch` directo y fallback `auth/login-delivery`; conviene unificar contrato.
3. Hay logs `console.log` extensivos en producción potencial.
4. `services/notificationService.ts` importa `useAudioPlayer` pero no lo usa (la reproducción ocurre en `NotificationHandler`).
5. `RouteContext.startRoutes()` construye `tripDataFromBackend` pero no lo usa para pintar mapa (actualmente usa `fetchTrip`).
6. `AppStateScreen` conserva lógica de modal de ruta no central en flujo principal.

---

## 15) Checklist para onboarding (IA o dev)

1. Revisar `app.json` y confirmar URLs/permissions.
2. Verificar login real en `authService.login`.
3. Confirmar eventos socket esperados con backend.
4. Probar ciclo completo:
   - login
   - carga entregas
   - actualizar estado con y sin evidencia
   - iniciar rutas
   - tracking courier
5. Validar estados y transiciones contra catálogo backend.

---

## 16) Comandos base

Archivo: `package.json`

- `npm run start` o `yarn start`
- `npm run android`
- `npm run ios`
- `npm run web`

---

## 17) Flujo de despliegue (EAS Build + OTA Updates)

Proyecto EAS: `emperatriz-delivery` (owner `valentinrod`, projectId en `app.json → extra.eas.projectId`). No hay CI/CD: todo es manual vía scripts npm.

### 17.1 Builds de binario (solo si cambia código nativo o se requiere nueva versión)

- `npm run build:android:preview` → perfil `preview` en `eas.json`: APK de distribución interna (link/QR de descarga para instalar a mano en los dispositivos), **canal `preview`**.
- `npm run build:android` → perfil `production`: AAB con auto-increment de build number (versión remota), **canal `production`** (Play Store).
- `eas build:list` / `eas build:view` para revisar builds.

### 17.2 Actualizaciones OTA (cambios solo JS, sin tocar código nativo)

- `npm run update:preview` → `eas update --branch preview` → llega a binarios construidos con canal `preview`.
- `npm run update` → `eas update --branch production` → llega a binarios construidos con canal `production`.

En el dispositivo, al abrir la app (`core/hooks/useOTAUpdates.ts`, montado en `app/_layout.tsx`):

1. Consulta el endpoint backend `app-version` (`utils/api-endpoints.ts → ApiEndpoints.AppVersion`) y obtiene la `minVersion`.
2. Si la versión instalada (`Constants.expoConfig.version`) es **menor** que la `minVersion`: muestra `components/ForceUpdateScreen.tsx` e intenta aplicar el update (force update).
3. Si no: fetch silencioso en background del update disponible y `Updates.reloadAsync()` (`services/otaUpdates.service.ts`).

### 17.3 Reglas y restricciones

- `runtimeVersion.policy = appVersion` (`app.json`): un `eas update` **solo aplica a binarios con la misma versión** (ej. 1.0.0). Si se cambia la versión o se agregan dependencias nativas → hacer **nuevo build + reinstalar** en los dispositivos.
- `updates.enabled` en `app.json` **debe permanecer `true`**; si se pone `false`, los builds nuevos salen sin expo-updates y el flujo OTA deja de funcionar (histórico: se desactivó temporalmente en commit `5294fc4` y se reactivó).
- `checkAutomatically: "ON_LOAD"`: la app chequea updates al arrancar; el hook `useOTAUpdates` además fuerza la lógica de versión mínima.
- El hook es no-op en `__DEV__` (Expo Go / desarrollo).

---

## 18) Conclusión

El proyecto `delivery` tiene una separación funcional bastante clara entre UI, estado, servicios y adaptadores de dominio. Para cambios de negocio, los puntos más sensibles están en:

- `context/DeliveryContext.tsx` (orquestación de lista/progreso),
- `app/(tabs)/status-update.tsx` (validaciones de transición/evidencia/pago),
- `contexts/RouteContext.tsx` + `components/TripMap.tsx` (ruteo/visualización),
- `services/websocketService.ts` + `services/courierLocationService.ts` (tiempo real y tracking).

Con este mapa, cualquier IA o desarrollador puede ubicar con rapidez dónde intervenir según el tipo de cambio requerido.
