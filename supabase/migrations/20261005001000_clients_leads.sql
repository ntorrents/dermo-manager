-- Leads / clientes potenciales (misma tabla clients, filtrados del directorio).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_interest text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_message text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_source text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_entered_at timestamptz;

COMMENT ON COLUMN public.clients.is_lead IS
  'true = lead/potencial; no aparece en el directorio de pacientes hasta convertir.';
COMMENT ON COLUMN public.clients.lead_interest IS
  'Tratamiento o interés declarado por el lead.';
COMMENT ON COLUMN public.clients.lead_message IS
  'Mensaje libre (p. ej. webhook web / formulario).';
COMMENT ON COLUMN public.clients.lead_source IS
  'Origen: manual | webhook | web | otro.';
COMMENT ON COLUMN public.clients.lead_entered_at IS
  'Fecha de entrada como lead (si null, usar created_at).';

CREATE INDEX IF NOT EXISTS idx_clients_clinic_leads
  ON public.clients (clinic_id, lead_entered_at DESC NULLS LAST, created_at DESC)
  WHERE is_lead = true AND activo = true;

-- Secreto opcional para webhooks de entrada de leads por clínica
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS leads_webhook_secret text;

COMMENT ON COLUMN public.clinics.leads_webhook_secret IS
  'Secreto compartido para POST /functions/v1/webhook-leads (header x-webhook-secret).';
