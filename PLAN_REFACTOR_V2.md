# PLAN DE REFACTORIZACIÓN V2 — DermoManager

**Arquitecto:** Análisis Senior (React, Supabase, Tailwind, UX)  
**Versión:** 1.0  
**Fecha:** Febrero 2025

---

## Resumen Ejecutivo

Este plan estructura la refactorización de DermoManager en 3 bloques priorizados, divididos en **Sprints ejecutables** que pueden implementarse uno a uno sin romper la aplicación. Cada Sprint incluye criterios de aceptación y archivos afectados.

---

## Inventario del Estado Actual (Análisis)

### Arquitectura de Datos
- **`useData.js`**: Fetch unificado de `inventory`, `treatments`, `entries`, `recurringConfig` con `Promise.all`. Realtime vía `postgres_changes` global. **Problema**: Cualquier cambio en una tabla re-fetchea todo.
- **`useClients.js`**: Hook separado con Realtime escopado a `clients`. Bien estructurado.
- **`useProfile.js`**: Hook simple, sin React Query.
- **`useClientHistory.js`**: Hook por `clientId`, usado en ClientsTab para historial de sesiones.

### Magic Strings y Colores Hardcodeados (Detectados)
| Archivo | Valores |
|---------|---------|
| InventoryTab | `#f43f5e`, `#fffbeb`, `#fef3c7`, `#d97706`, `#92400e`, `#b45309`, `#1e293b` |
| FinanceTab | `#f43f5e`, `#1e293b` |
| TreatmentsTab | `#f43f5e`, `#1e293b` |
| SessionModal | `#1e293b` |
| ClientsTab | `#1e293b` |
| useProfile | `theme_color: "#f43f5e"` |
| index.css | `#f9fafb`, `#e2e8f0` |

### Modales Actuales (6 patrones distintos)
1. **ConfirmModal** — Diálogo de confirmación (centrado, reutilizable).
2. **SessionModal** — Formulario largo, ya usa `items-start xl:items-center` para móvil.
3. **InventoryTab** — Modal crear/editar material + Modal Reponer (inline con `fixed inset`).
4. **FinanceTab** — Modal crear/editar entrada + Modal Config Fijos (inline).
5. **ClientsTab** — Modal crear/editar cliente (inline).
6. **TreatmentsTab** — Modal crear/editar tratamiento (inline).

### MobileNav
- Actualmente muestra **7 ítems** en `grid-cols-7`. En pantallas pequeñas los iconos y etiquetas se comprimen.

### Autenticación
- Supabase Auth con Email/Password y **Google OAuth** (`signInWithGoogle`).
- Los tokens de provider (Google) están disponibles en `session.provider_token` tras OAuth.
- **Implicación**: Sí es viable usar el token de Google para Calendar API, pero requiere scopes adicionales (`calendar`, `calendar.events`).

---

# BLOQUE 1: ARQUITECTURA Y CALIDAD (CORE)

---

## Sprint 1.1 — Migración a TanStack Query v5 (Base)

**Objetivo:** Instalar TanStack Query y configurar el provider sin cambiar el comportamiento actual.

### Pasos
1. Instalar `@tanstack/react-query` v5.
2. Crear `src/providers/QueryProvider.jsx` con `QueryClient` y `QueryClientProvider`.
3. Envolver la app en `main.jsx` con `QueryProvider` (dentro de `AuthProvider`).
4. Configurar `defaultOptions`: `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false` (o `true` si se prefiere).

### Criterios de aceptación
- La app arranca igual.
- No se modifica `useData` ni `useClients` en este Sprint.

### Archivos
- `package.json`, `src/main.jsx`, **nuevo** `src/providers/QueryProvider.jsx`

---

## Sprint 1.2 — Hooks modulares con TanStack Query

**Objetivo:** Crear `useTreatments`, `useInventory`, `useFinance`, `useRecurringConfig` y migrar `useData` para que delegue en ellos (o deprecar `useData`).

### Pasos
1. **`useTreatments(user)`**
   - `useQuery` con `queryKey: ['treatments', user?.id]`.
   - Fetch: `supabase.from('treatments').select('*').eq('user_id', user.id).order('name')`.
   - Realtime: `useEffect` con `postgres_changes` en tabla `treatments`, `queryClient.invalidateQueries(['treatments', user.id])`.

2. **`useInventory(user)`**
   - Similar estructura para tabla `inventory`.

3. **`useFinance(user)`**
   - `useQuery` para `finance_entries` (ordenado por `date` desc).

4. **`useRecurringConfig(user)`**
   - `useQuery` para `recurring_config`.

5. **`useData(user)` (refactor)**
   - Opción A: Componer los 4 hooks anteriores y devolver `{ inventory, treatments, entries, recurringConfig, loading, refreshData }`.
   - Opción B: Eliminar `useData` y que `App.jsx` llame directamente a los 4 hooks (más granular, mejor caché).

**Recomendación:** Opción B. Cada tab que necesite datos usará solo los hooks que requiera.

### Criterios de aceptación
- Dashboard, TreatmentsTab, InventoryTab, FinanceTab, TaxesTab funcionan igual.
- Caché independiente: un cambio en inventario no invalida tratamientos.
- `isLoading` e `isFetching` disponibles por hook.

### Archivos
- **Nuevos** `src/hooks/useTreatments.js`, `useInventory.js`, `useFinance.js`, `useRecurringConfig.js`
- `src/App.jsx` (cambiar consumo de `useData` a hooks individuales)
- `src/hooks/useData.js` (eliminar o mantener como wrapper legacy durante transición)

---

## Sprint 1.3 — Mutaciones con React Query

**Objetivo:** Usar `useMutation` para crear/editar/eliminar en lugar de llamadas directas a Supabase en componentes.

### Pasos
1. Crear **`src/services/mutations.js`** (o hooks `useCreateTreatment`, etc.) con:
   - `useMutation` para cada operación (crear material, reponer, crear sesión, etc.).
   - `onSuccess`: `queryClient.invalidateQueries([...])` para refrescar datos.
   - `onError`: propagar error para mostrar toast.

2. Migrar operaciones críticas:
   - `handleSession` en App.jsx → `useSessionMutation` o similar.
   - InventoryTab: crear material, reponer, eliminar.
   - FinanceTab: crear/editar entrada, eliminar.
   - ClientsTab: crear/editar cliente, eliminar.
   - TreatmentsTab: crear/editar tratamiento, eliminar.

3. Conectar `isPending` de las mutaciones a los botones (disabled + spinner).

### Criterios de aceptación
- Botones muestran loading durante mutación.
- Caché se actualiza automáticamente tras éxito.
- Toasts de éxito/error siguen funcionando.

### Archivos
- **Nuevo** `src/services/mutations.js` (o `src/hooks/mutations/`)
- `App.jsx`, `InventoryTab.jsx`, `FinanceTab.jsx`, `ClientsTab.jsx`, `TreatmentsTab.jsx`

---

## Sprint 1.4 — Paleta semántica en Tailwind

**Objetivo:** Eliminar colores hardcodeados y centralizar en `tailwind.config.js`.

### Pasos
1. Extender `theme` en `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: "#f43f5e",
        hover: "#e11d48",
        light: "#ffe4e6",
      },
      surface: {
        dark: "#1e293b",
      },
      warning: {
        bg: "#fffbeb",
        border: "#fef3c7",
        icon: "#d97706",
        text: "#92400e",
        textLight: "#b45309",
      },
    },
  },
},
```

2. Sustituir en todos los archivos:
   - `#f43f5e` → `bg-primary` / `text-primary`
   - `#1e293b` → `bg-surface-dark`
   - Colores de alerta → `bg-warning-bg`, `border-warning-border`, etc.
   - `index.css` `body { background }` → usar clase Tailwind `bg-gray-50` o variable.

3. Actualizar `useProfile` default `theme_color` para que use la misma constante (o leer de un `theme.js`).

### Criterios de aceptación
- No hay hex codes de colores en componentes.
- Cambiar el color primario en `tailwind.config.js` actualiza toda la app.

### Archivos
- `tailwind.config.js`, `src/index.css`
- `InventoryTab.jsx`, `FinanceTab.jsx`, `TreatmentsTab.jsx`, `SessionModal.jsx`, `ClientsTab.jsx`, `useProfile.js`

---

## Sprint 1.5 — Extracción de lógica de negocio

**Objetivo:** Mover cálculos fuera de la UI a `src/utils/calculations.js` y `src/utils/format.js`.

### Pasos
1. Crear **`src/utils/calculations.js`** con:
   - `calculateUnitCost(totalCost, stock)`
   - `calculateSessionCost(consumption, inventory)` — coste real de receta + extras.
   - `calculateStats(entries)` — income, expense, net (actualmente en DashboardTab).
   - `calculateGrowth(current, previous)` — % crecimiento.
   - Reutilizar `calculateTaxFromTotal` de `format.js` o moverlo aquí si se considera cálculo puro.

2. Crear **`src/constants/tax.js`** (opcional):
   - `IVA_OPTIONS`, constantes de categorías (`Servicio`, `Material`, etc.).

3. Refactorizar:
   - `DashboardTab`: usar `calculateStats`, `calculateGrowth`.
   - `InventoryTab`: usar `calculateUnitCost`, `calculateTaxFromTotal`.
   - `App.jsx` `handleSession`: usar `calculateSessionCost` para el coste.
   - `FinanceTab`: mantener `calculateTaxFromTotal` en form, pero importar desde un único sitio.

### Criterios de aceptación
- Componentes no contienen fórmulas de negocio.
- Tests unitarios (opcional) posibles sobre `calculations.js`.

### Archivos
- **Nuevo** `src/utils/calculations.js`
- `src/utils/format.js` (reorganizar)
- `DashboardTab.jsx`, `InventoryTab.jsx`, `App.jsx`, `FinanceTab.jsx`

---

## Sprint 1.6 — Limpieza de código muerto

**Objetivo:** Eliminar imports no usados, variables muertas y código comentado.

### Pasos
1. Ejecutar `eslint .` y corregir warnings de imports no usados.
2. Revisar manualmente cada componente:
   - InventoryTab: ya se limpiaron algunos en auditoría previa.
   - FinanceTab: verificar `Settings`, `FileText`, etc.
   - ClientsTab, TreatmentsTab, etc.
3. Eliminar `console.log` de debug (excepto errores críticos).
4. Eliminar código comentado obsoleto.

### Criterios de aceptación
- `npm run lint` sin errores ni warnings de imports.
- No hay `console.log` superfluos.

### Archivos
- Todos los `.jsx` y `.js` en `src/`

---

# BLOQUE 2: UX/UI Y MÓVIL

---

## Sprint 2.1 — MobileNav 2.0 (4 ítems + Más)

**Objetivo:** Mostrar solo 4 ítems principales y un botón "Más" que abra un Drawer con el resto.

### Pasos
1. Definir los 4 ítems prioritarios: **Inicio, Clientes, Servicios, Stock** (o Inicio, Clientes, Servicios, Finanzas — decidir con negocio).
2. Modificar `MobileNav`:
   - `grid-cols-5` (4 ítems + Más).
   - Añadir botón "Más" (icono `MoreHorizontal` o `Menu`) que abra estado `drawerOpen`.
3. Crear **`MobileDrawer.jsx`**:
   - Overlay + panel que desliza desde la derecha (o bottom).
   - Contenido: Finanzas, Fiscalidad, Configuración.
   - Al hacer clic en un ítem, navegar y cerrar el drawer.
4. Estilo consistente con el resto de la app.

### Criterios de aceptación
- En móvil se ven 5 botones: 4 principales + Más.
- Al tocar Más se abre un drawer con el resto.
- La navegación funciona correctamente.

### Archivos
- `MobileNav.jsx`
- **Nuevo** `MobileDrawer.jsx` (o integrar en `MobileNav.jsx`)

---

## Sprint 2.2 — Componente Modal/Drawer adaptativo

**Objetivo:** Crear un componente `AdaptiveModal` que en desktop sea diálogo centrado y en móvil sea Bottom Drawer.

### Pasos
1. Crear **`src/components/ui/AdaptiveModal.jsx`**:
   - Props: `isOpen`, `onClose`, `title`, `children`, `maxWidth`.
   - Desktop (`xl:`): `fixed inset-0`, `items-center`, `justify-center`, contenido centrado con `max-w-lg`.
   - Móvil: `fixed inset-x-0 bottom-0`, `rounded-t-3xl`, `max-h-[90vh]`, animación slide-up.
   - Usar `useMediaQuery` o clase `xl:` para detectar breakpoint.
   - Backdrop común, cierre al clic fuera.

2. Migrar un modal como prueba: por ejemplo el modal de crear cliente en ClientsTab.
3. Si funciona bien, planificar migración gradual del resto (InventoryTab, FinanceTab, TreatmentsTab, SessionModal opcional por su complejidad).

### Criterios de aceptación
- En móvil, el modal aparece como drawer desde abajo.
- En desktop, se mantiene centrado.
- El teclado virtual no "tapa" el contenido en móvil (el drawer puede hacer scroll).

### Archivos
- **Nuevo** `AdaptiveModal.jsx`
- `ClientsTab.jsx` (piloto)

---

## Sprint 2.3 — Loading States en botones de acción

**Objetivo:** Todos los botones de Guardar/Crear/Eliminar muestran spinner y están deshabilitados durante la mutación.

### Pasos
1. Crear **`src/components/ui/LoadingButton.jsx`** (opcional pero recomendado):
   - Props: `children`, `loading`, `disabled`, `className`, `onClick`, etc.
   - Si `loading`: `disabled`, icono `Loader2` con `animate-spin`.

2. Sustituir en:
   - InventoryTab: Guardar Material, Confirmar Compra (Reponer).
   - FinanceTab: Guardar entrada, Pagar fijo.
   - ClientsTab: Guardar cliente.
   - TreatmentsTab: Guardar tratamiento.
   - SessionModal: Confirmar sesión.
   - Config modals (SettingsTab, recurring).

3. Conectar `loading` al `isPending` de React Query mutations (cuando estén migradas).

### Criterios de aceptación
- Ningún botón de acción permite doble clic durante la petición.
- Se muestra un indicador visual (spinner) durante la carga.

### Archivos
- **Nuevo** `LoadingButton.jsx` (opcional)
- `InventoryTab.jsx`, `FinanceTab.jsx`, `ClientsTab.jsx`, `TreatmentsTab.jsx`, `SessionModal.jsx`

---

## Sprint 2.4 — Componente EmptyState

**Objetivo:** Reemplazar mensajes "Sin X" por un componente visual amigable con ilustración y CTA.

### Pasos
1. Crear **`src/components/ui/EmptyState.jsx`**:
   - Props: `icon` (componente Lucide), `title`, `description`, `actionLabel`, `onAction`.
   - Diseño: icono grande (o SVG), título, descripción, botón de acción.
   - Estilo consistente (primary, sombras suaves).

2. Usar en:
   - InventoryTab: "No hay materiales" → CTA "Añadir primer material".
   - ClientsTab: "No hay clientes" → CTA "Añadir cliente".
   - TreatmentsTab: "No hay tratamientos" → CTA "Crear tratamiento".
   - FinanceTab: "Sin ingresos" / "Sin gastos" (opcional, pueden ser más discretos).

### Criterios de aceptación
- Las listas vacías muestran una pantalla amigable, no solo texto.
- El botón de acción abre el flujo correcto (modal crear).

### Archivos
- **Nuevo** `EmptyState.jsx`
- `InventoryTab.jsx`, `ClientsTab.jsx`, `TreatmentsTab.jsx`, `FinanceTab.jsx`

---

# BLOQUE 3: NUEVAS FUNCIONALIDADES

---

## Sprint 3.1 — Historial fotográfico (Antes/Después)

**Objetivo:** Permitir subir fotos vinculadas a sesiones y visualizar comparación antes/después.

### Pasos (Plan de diseño)

1. **Modelo de datos**
   - Nueva tabla `session_photos`:
     - `id`, `user_id`, `client_id`, `finance_entry_id` (FK a la sesión/ingreso),
     - `type`: `before` | `after`,
     - `storage_path` (Supabase Storage),
     - `created_at`.
   - Políticas RLS: solo el usuario propietario.

2. **Storage**
   - Bucket `session-photos` en Supabase (privado).
   - Subida con `supabase.storage.from('session-photos').upload(path, file)`.
   - Generar path: `{user_id}/{client_id}/{entry_id}/{type}_{timestamp}.jpg`.

3. **UI**
   - En **ClientsTab** (ficha del cliente): sección "Fotos de sesiones".
   - En **TreatmentsTab** o al confirmar sesión: opción "Añadir fotos antes/después" (puede ser posterior a la sesión).
   - Vista de comparación: componente `BeforeAfterViewer` — dos imágenes lado a lado (o slider tipo "before/after" con divisor arrastrable). Librerías: `react-compare-image` o implementación CSS con `clip-path`.

4. **Flujo sugerido**
   - Desde historial del cliente: botón "Añadir fotos" en cada entrada de sesión.
   - Modal: upload 2 imágenes (antes/después), preview, guardar.
   - Vista de galería por cliente con filtro por tratamiento.

### Criterios de aceptación
- Se pueden subir fotos antes/después por sesión.
- Se visualiza comparación lado a lado (o con slider).
- Las fotos están asociadas a cliente y sesión.

### Archivos (estimados)
- **Nuevo** `session_photos` (migración Supabase)
- **Nuevo** `src/services/photoStorage.js`
- **Nuevo** `src/components/photos/BeforeAfterViewer.jsx`
- **Nuevo** `src/components/photos/PhotoUploadModal.jsx`
- `ClientsTab.jsx` (integración en ficha cliente)

---

## Sprint 3.2 — Calendario interno (Agenda visual)

**Objetivo:** Mostrar un calendario con las sesiones registradas.

### Pasos

1. **Elegir librería**
   - **react-big-calendar**: madura, flexible, estilizable. Buena opción.
   - Alternativa: **FullCalendar** (más features, posiblemente de pago para algunas).
   - Recomendación: `react-big-calendar` + `date-fns` para localización.

2. **Modelo**
   - Las sesiones ya están en `finance_entries` (type=income, category=Servicio) con `date` y `client_id`.
   - No hay tabla `appointments` separada: se usa `finance_entries` como fuente.
   - Cada evento del calendario: `{ id, title, start, end, resource: { clientId, treatmentName, ... } }`.
   - `start` = `date` + hora por defecto (ej. 10:00). `end` = `start` + 1h (o duración configurable por tratamiento en el futuro).

3. **Vista**
   - Nueva tab "Agenda" o "Calendario" en Sidebar y MobileNav.
   - `CalendarTab.jsx`: calendario mensual/semanal con eventos.
   - Al hacer clic en un evento: modal con detalle (cliente, tratamiento, importe).
   - Crear cita "rápida" desde el calendario (opcional): abre SessionModal con fecha prefijada.

### Criterios de aceptación
- Se ve un calendario con las sesiones del usuario.
- Los eventos muestran tratamiento y cliente.
- Navegación mes/semana funcional.

### Archivos
- `package.json` (react-big-calendar, date-fns)
- **Nuevo** `src/components/calendar/CalendarTab.jsx`
- **Nuevo** `src/utils/calendarUtils.js` (mapeo entries → eventos)
- `App.jsx`, `Sidebar.jsx`, `MobileNav.jsx` (nueva tab)

---

## Sprint 3.3 — Google Calendar: análisis y estrategia

### Viabilidad técnica actual

- **Supabase Auth + Google OAuth:** Sí está configurado (`signInWithGoogle`).
- **Token de provider:** Tras login con Google, `session.provider_token` contiene el access_token de Google.
- **Limitación:** El provider token actual solo incluye scopes básicos (`email`, `profile`). Para Calendar API se necesitan scopes adicionales: `https://www.googleapis.com/auth/calendar` y/o `calendar.events`.

### Opción A: Calendario interno primero (Recomendada)

- Implementar Sprint 3.2.
- No requiere cambios en Google Cloud.
- El usuario tiene una agenda visual con sus sesiones ya registradas.

### Opción B: Integración completa con Google Calendar

**Requisitos:**

1. **Google Cloud Console**
   - Crear proyecto (o usar el existente para OAuth).
   - Habilitar **Google Calendar API**.
   - En Credenciales → OAuth 2.0 Client ID → añadir scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Configurar pantalla de consentimiento si se añaden scopes sensibles.

2. **Supabase**
   - En Authentication → Providers → Google, configurar los scopes adicionales (si Supabase lo permite en la UI).
   - Si no: usar flujo OAuth manual con `supabase.auth.signInWithOAuth` pasando `scopes: ['...calendar...']` en options.

3. **Backend / Edge Function (recomendado)**
   - Las llamadas a Google Calendar API es mejor hacerlas desde un backend (Edge Function de Supabase o API propia) para no exponer tokens en el cliente.
   - Flujo: Cliente pide "sincronizar con Google" → Edge Function recibe `provider_token` → hace GET/POST a Calendar API → devuelve datos o escribe eventos.

4. **Sincronización**
   - **Exportar:** Crear evento en Google Calendar por cada sesión nueva (al guardar `handleSession`).
   - **Importar:** Leer eventos de Google Calendar y mostrarlos en la agenda (o crear sesiones automáticamente — más complejo).

**Recomendación:** Ejecutar **Opción A** en primer lugar. Opción B como fase posterior, con Sprint dedicado a:
- Configuración de scopes en Google Cloud.
- Edge Function `sync-google-calendar`.
- UI para "Conectar Google Calendar" en Settings.
- Toggle para exportar automáticamente nuevas sesiones.

---

# SUGERENCIAS PROACTIVAS

### 1. Error Boundaries
- Añadir `ErrorBoundary` por sección (por tab) para que un fallo en una pestaña no tumbe toda la app.
- Mostrar mensaje amigable + botón "Reintentar".

### 2. Optimistic Updates (React Query)
- En mutaciones frecuentes (ej. marcar fijo como pagado), usar `onMutate` + `queryClient.setQueryData` para actualizar la UI antes de la respuesta.
- Mejora percibida de velocidad.

### 3. Skeleton Loaders
- En lugar de spinner genérico, usar skeletons en listas (Clientes, Inventario, etc.) durante la carga inicial.
- Librería: `react-loading-skeleton` o implementación con Tailwind.

### 4. Preferencias de usuario
- Guardar `viewMode` y `currentDate` en `localStorage` (o en `profiles`) para que el usuario no pierda su vista al recargar.

### 5. Accesibilidad (a11y)
- Revisar `aria-label` en botones con solo icono.
- Asegurar `focus` visible en modales y navegación por teclado.

### 6. Tests
- Tests unitarios para `calculations.js` y `format.js`.
- Test de integración para flujo de sesión (opcional, con React Testing Library).

---

# Orden de Ejecución Sugerido

| Orden | Sprint | Bloque | Dependencias |
|-------|--------|--------|--------------|
| 1 | 1.1 | Core | Ninguna |
| 2 | 1.4 | Core | Ninguna (independiente) |
| 3 | 1.5 | Core | Ninguna |
| 4 | 1.6 | Core | Ninguna |
| 5 | 1.2 | Core | 1.1 |
| 6 | 1.3 | Core | 1.2 |
| 7 | 2.1 | UX | Ninguna |
| 8 | 2.3 | UX | Preferible 1.3 (mutaciones) |
| 9 | 2.4 | UX | Ninguna |
| 10 | 2.2 | UX | Ninguna |
| 11 | 3.2 | Func | Ninguna |
| 12 | 3.1 | Func | Ninguna |
| 13 | 3.3 (Opción B) | Func | 3.2 |

---

# Checklist de Aprobación

Antes de ejecutar, confirma:

- [ ] Prioridad de los 4 ítems del MobileNav (¿Inicio, Clientes, Servicios, Stock o Finanzas?).
- [ ] Librería de calendario: ¿react-big-calendar o FullCalendar?
- [ ] ¿Implementar Opción B de Google Calendar en esta fase o posponer?
- [ ] ¿Incluir EmptyState en FinanceTab (ingresos/gastos vacíos) o mantener mensaje simple?
