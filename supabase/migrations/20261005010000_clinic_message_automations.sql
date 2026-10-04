-- Automatizaciones de mensajes + webhooks de salida (PRE).
-- Arquitectura lista para Email (Resend) / WhatsApp en el futuro.

-- Ampliar kinds de plantillas de marketing
ALTER TABLE public.marketing_templates
  DROP CONSTRAINT IF EXISTS marketing_templates_kind_check;

ALTER TABLE public.marketing_templates
  ADD CONSTRAINT marketing_templates_kind_check CHECK (
    kind = ANY (ARRAY[
      'budget'::text,
      'bonus'::text,
      'email_followup'::text,
      'email_reminder'::text,
      'email_campaign'::text,
      'email_pre_session'::text,
      'email_google_review'::text
    ])
  );

-- Webhook de salida por clínica (eventos → URL externa)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS outbound_webhook_url text;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS outbound_webhook_secret text;

COMMENT ON COLUMN public.clinics.outbound_webhook_url IS
  'URL opcional para notificar eventos (pre/post sesión, reseña, etc.).';
COMMENT ON COLUMN public.clinics.outbound_webhook_secret IS
  'Secreto enviado en header x-webhook-secret en webhooks de salida.';

CREATE TABLE IF NOT EXISTS public.clinic_message_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  event_key text NOT NULL
    CONSTRAINT clinic_message_automations_event_check CHECK (
      event_key = ANY (ARRAY[
        'pre_session'::text,
        'reminder_24h'::text,
        'post_session'::text,
        'google_review'::text
      ])
    ),
  is_active boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'email'
    CONSTRAINT clinic_message_automations_channel_check CHECK (
      channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'none'::text])
    ),
  template_id uuid REFERENCES public.marketing_templates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_message_automations_clinic_event_uq UNIQUE (clinic_id, event_key)
);

COMMENT ON TABLE public.clinic_message_automations IS
  'Asignación evento → plantilla/canal por clínica. Canal whatsapp preparado; envío futuro.';

CREATE INDEX IF NOT EXISTS idx_clinic_message_automations_clinic
  ON public.clinic_message_automations (clinic_id);

ALTER TABLE public.clinic_message_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_message_automations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cma_select ON public.clinic_message_automations;
CREATE POLICY cma_select ON public.clinic_message_automations
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

DROP POLICY IF EXISTS cma_insert ON public.clinic_message_automations;
CREATE POLICY cma_insert ON public.clinic_message_automations
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

DROP POLICY IF EXISTS cma_update ON public.clinic_message_automations;
CREATE POLICY cma_update ON public.clinic_message_automations
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  )
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

DROP POLICY IF EXISTS cma_delete ON public.clinic_message_automations;
CREATE POLICY cma_delete ON public.clinic_message_automations
  FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_message_automations TO authenticated;
GRANT ALL ON public.clinic_message_automations TO service_role;
