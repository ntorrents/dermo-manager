-- Log de disparos de automatizaciones (idempotencia por cita + evento).

CREATE TABLE IF NOT EXISTS public.automation_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  event_key text NOT NULL
    CONSTRAINT automation_dispatch_log_event_check CHECK (
      event_key = ANY (ARRAY[
        'pre_session'::text,
        'reminder_24h'::text,
        'post_session'::text,
        'google_review'::text
      ])
    ),
  appointment_id uuid NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  queued_email_id uuid REFERENCES public.queued_emails (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CONSTRAINT automation_dispatch_log_status_check CHECK (
      status = ANY (ARRAY['queued'::text, 'skipped'::text, 'failed'::text])
    ),
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_dispatch_log_uq UNIQUE (clinic_id, event_key, appointment_id)
);

COMMENT ON TABLE public.automation_dispatch_log IS
  'Evita reenvíos: un disparo por (clínica, evento, cita).';

CREATE INDEX IF NOT EXISTS idx_automation_dispatch_log_clinic_created
  ON public.automation_dispatch_log (clinic_id, created_at DESC);

ALTER TABLE public.automation_dispatch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_dispatch_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adl_select ON public.automation_dispatch_log;
CREATE POLICY adl_select ON public.automation_dispatch_log
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

-- Escritura solo service_role / edge (sin policy insert para authenticated)
GRANT SELECT ON public.automation_dispatch_log TO authenticated;
GRANT ALL ON public.automation_dispatch_log TO service_role;

-- Extensiones para cron → edge (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
