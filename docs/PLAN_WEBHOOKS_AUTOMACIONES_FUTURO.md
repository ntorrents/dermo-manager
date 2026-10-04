# Plan futuro — Webhooks de salida y envío de automatizaciones

**Estado:** aparcado a propósito.  
**Cuándo retomarlo:** después de cerrar la última fase activa del roadmap / epic en curso.  
**Alcance:** lo que queda pendiente tras la UI de Integraciones + Marketing → Automatizaciones (octubre 2026).

---

## Qué ya está hecho (no repetir)

| Pieza | Dónde |
| ----- | ----- |
| Captación Leads (entrada) | Edge Function `webhook-leads`, módulo `web_leads`, UI Integraciones |
| Tabla leads | `clients.is_lead` + campos `lead_*` |
| Automatizaciones (config UI) | `clinic_message_automations` + cards en Marketing |
| Plantillas por evento | `marketing_templates` (kinds pre/post/review/reminder) |
| Webhook de salida (solo datos) | `clinics.outbound_webhook_url` / `outbound_webhook_secret` |
| Canales en UI | `email` \| `whatsapp` \| `none` (WhatsApp = placeholder) |

---

## Hecho (worker citas → Resend)

- Edge Function `dispatch-appointment-automations` + cron horario (`:10`) en PRO.
- Eventos: **reminder_24h** (ventana ~23–25 h) y **pre_session** (~90–150 min).
- Solo si `clinic_message_automations.is_active` y `channel = email` + plantilla.
- Idempotencia: `automation_dispatch_log` (una vez por cita+evento).
- Cron auxiliar `process-email-queue-hourly` (`:20`).

**Si el toggle está off → no se encola ni se envía nada**, aunque exista la plantilla.

---

## Pendiente (resto)

### 1. Más disparadores

- **Post-sesión:** tras sesión / `finance_entries`.
- **Reseña Google:** N días después.
- Respetar `channel`:
  - `whatsapp` → stub hasta proveedor (Meta / Twilio).
  - `none` → solo webhook de salida (si hay URL).

### 2. Emisor de webhook de salida

- POST JSON a `clinics.outbound_webhook_url` con header `x-webhook-secret`.
- Payload sugerido:

```json
{
  "event": "post_session",
  "clinic_id": "uuid",
  "client_id": "uuid",
  "occurred_at": "ISO-8601",
  "channel": "email",
  "template_id": "uuid",
  "data": { "nombre_paciente": "...", "tratamiento": "..." }
}
```

- Reintentos, log de fallos, idempotencia (`event_key` + `client_id` + día).

### 3. Encuestas / reseña Google

- Campo o ajuste por clínica: URL de reseña Google.
- Plantilla `email_google_review` con variable `{{url_resena}}`.
- Opt-in / no enviar si el paciente no tiene email o ha optado out (RGPD).

### 4. Despliegue y ops

- Publicar `webhook-leads` en el proyecto Supabase correcto (PRE/PRO) con `verify_jwt = false`.
- Activar módulo `web_leads` solo en clínicas contratadas (superadmin).
- Documentar para cada clínica: URL, token, mapeo de campos del formulario.
- Tests de contrato: payload Elementor / CF7 / Wix → lead en ERP.

### 5. UX opcional

- Historial “últimos disparos” por automatización.
- Dry-run / enviar prueba a un email.
- Desactivar globalmente por clínica sin borrar plantillas.

---

## Orden de implementación sugerido (cuando se retome)

1. Emisor outbound webhook (simple, testeable con webhook.site).
2. Cron recordatorio 24h (solo email + flag `is_active`).
3. Post-sesión (enganche tras `useSessionMutation`).
4. Pre-sesión + reseña Google.
5. Stub WhatsApp + proveedor real.

---

## Fuera de este plan

- Verifactu / AEAT tiempo real.
- TPV físico / datáfono.
- Cambiar el modelo de Leads de entrada (ya estable).
