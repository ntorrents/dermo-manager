# Plan por bloques – 6 funcionalidades ERP Dermo Manager

Entre cada bloque **parar** para pruebas, commit y luego continuar con el siguiente.

---

## Bloque 1 – Historia Clínica: Fecha de Nacimiento y Notas Privadas
- **BD:** Migración que añade a `clients`: `fecha_nacimiento` (date), `notas_privadas` (text).
- **UI:** En el formulario de clientes: selector de fecha (fecha nacimiento) y textarea (notas privadas).
- **Lógica:** No guardar edad en BD. Calcular edad en frontend con `dateUtils.js` y mostrarla en la pestaña Filiación del perfil del cliente.
- **Acción BD:** Ejecutar migración `011_clients_fecha_nacimiento_notas_privadas.sql`.

---

## Bloque 2 – Generador de Consentimientos Informados en PDF ✅
- **BD:** Nueva tabla `plantillas_consentimiento` vinculada a tratamientos (y migración).
- **Funcionalidad:** En vista cliente, opción "Generar Consentimiento" → modal: seleccionar tratamiento, cargar plantilla, reemplazar variables ({{NOMBRE}}, {{DNI}}, {{TRATAMIENTO}}, {{FECHA}}) y generar PDF (jsPDF).
- **Acción BD:** Ejecutar migración `012_plantillas_consentimiento.sql`.
- **Implementado:** Hook useConsentTemplates, consentGenerator.js, modal en ClientsTab, sección Plantillas en Ajustes.

---

## Bloque 3 – Pestaña Seguimiento (Follow-up) de Clientes ✅
- **BD:** Nueva tabla `seguimientos_cliente` (cliente_id, tratamientos_interes, fecha_proximo_contacto, notas, user_id, etc.).
- **UI:** Nueva pestaña **"Seguimiento"** como **primera** pestaña en detalle del cliente (antes de Filiación, Médico, Legal, Bonos, Historial, Consentimientos).
- **Funcionalidad:** Registrar tratamientos de interés, fecha próximo contacto/recordatorio, notas de seguimiento. Listado con opción de eliminar.
- **Acción BD:** Ejecutar migración `015_seguimientos_cliente.sql`.

---

## Bloque 4 – Creador de Presupuestos (Budgets)
- **Funcionalidad:** Constructor de presupuestos: seleccionar cliente, añadir tratamientos (cantidades) y gastos extra. Exportar a PDF con `budgetGenerator.js` (sin numeración de factura ni QR VeriFactu).
- **UI:** Decisión de ubicación (Finanzas o dentro del perfil Cliente).
- **Acción BD:** Si se almacenan presupuestos, migración para tabla `presupuestos` / `budget_items` (opcional según diseño).

---

## Bloque 5 – Refactor Widget Alertas de Stock
- **UI:** Extraer `WidgetAlerts.jsx` del sistema Drag & Drop; colocarlo fijo en la parte superior de `DashboardTab.jsx`, encima de la cuadrícula de widgets. Altura dinámica (Tailwind, ej. `h-auto`).
- **Acción BD:** Ninguna.

---

## Bloque 6 – Soft-Delete (Borrado Lógico)
- **BD:** Añadir columna `activo` (boolean, default true) o `fecha_eliminacion` a tablas críticas: clients, treatments, appointments, finance_entries (según criterio).
- **Lógica:** Hooks (React Query/Supabase) filtran `activo = true`; al "eliminar" en UI hacer UPDATE a inactivo en lugar de DELETE.
- **Acción BD:** Ejecutar migraciones de soft-delete en cada tabla.
