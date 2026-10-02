-- Motor de correo Resend: dominio propio + cola queued_emails + módulo SaaS.

-- ---------------------------------------------------------------------------
-- 1) Campos clinics (identidad / dominio)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS custom_email_domain text;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS resend_domain_id text;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS email_domain_status text NOT NULL DEFAULT 'not_configured';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_email_domain_status_check;

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_email_domain_status_check CHECK (
    email_domain_status = ANY (ARRAY[
      'not_configured'::text,
      'pending'::text,
      'verified'::text,
      'failed'::text
    ])
  );

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS email_dns_records jsonb;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS sender_email_name text;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS sender_reply_to text;

COMMENT ON COLUMN public.clinics.custom_email_domain IS 'Dominio propio (ej. c3linic.com) para resend.';
COMMENT ON COLUMN public.clinics.email_domain_status IS 'not_configured | pending | verified | failed';
COMMENT ON COLUMN public.clinics.email_dns_records IS 'Registros DNS (DKIM/SPF) de Resend.';

-- ---------------------------------------------------------------------------
-- 2) Módulo custom_email_domain en planes
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinics DISABLE TRIGGER clinics_protect_saas_columns_trg;

-- Integral / legado clinic → ON
UPDATE public.clinics
SET active_modules = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      coalesce(active_modules, '{}'::text[])
      || ARRAY['custom_email_domain']::text[]
    )
  )
)
WHERE subscription_tier IN ('integral', 'clinic')
  AND NOT ('custom_email_domain' = ANY (coalesce(active_modules, '{}'::text[])));

-- Basic → OFF (por si se añadió antes)
UPDATE public.clinics
SET active_modules = array_remove(coalesce(active_modules, '{}'::text[]), 'custom_email_domain')
WHERE subscription_tier = 'basic';

UPDATE public.clinic_role_modules
SET allowed_modules = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      coalesce(allowed_modules, '{}'::text[])
      || CASE WHEN role = 'admin' THEN ARRAY['custom_email_domain']::text[] ELSE '{}'::text[] END
    )
  )
)
WHERE role = 'admin';

ALTER TABLE public.clinics ENABLE TRIGGER clinics_protect_saas_columns_trg;

-- ---------------------------------------------------------------------------
-- 3) Cola unificada de envíos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queued_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.marketing_campaigns (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CONSTRAINT queued_emails_status_check CHECK (
      status = ANY (ARRAY[
        'queued'::text,
        'processing'::text,
        'sent'::text,
        'failed'::text
      ])
    ),
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queued_emails_status_created
  ON public.queued_emails (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queued_emails_clinic
  ON public.queued_emails (clinic_id, created_at DESC);

ALTER TABLE public.queued_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queued_emails FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qe_select_tenant ON public.queued_emails;
CREATE POLICY qe_select_tenant
  ON public.queued_emails FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS qe_insert_tenant ON public.queued_emails;
CREATE POLICY qe_insert_tenant
  ON public.queued_emails FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS qe_select_superadmin ON public.queued_emails;
CREATE POLICY qe_select_superadmin
  ON public.queued_emails FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

GRANT SELECT, INSERT ON TABLE public.queued_emails TO authenticated;
GRANT ALL ON TABLE public.queued_emails TO service_role;

-- Encolar campaña → marketing_sends + queued_emails (HTML con vars crudas; edge sustituye)
CREATE OR REPLACE FUNCTION public.queue_marketing_campaign(p_campaign_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp public.marketing_campaigns%ROWTYPE;
  v_clinic public.clinics%ROWTYPE;
  v_count int := 0;
  r record;
BEGIN
  SELECT * INTO v_camp FROM public.marketing_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR v_camp.clinic_id IS DISTINCT FROM public.current_user_clinic_id() THEN
    RAISE EXCEPTION 'Campaña no encontrada';
  END IF;

  SELECT * INTO v_clinic FROM public.clinics WHERE id = v_camp.clinic_id;

  FOR r IN
    SELECT c.id, c.name, c.surname, c.email
    FROM public.clients c
    WHERE c.clinic_id = v_camp.clinic_id
      AND c.email IS NOT NULL
      AND trim(c.email) <> ''
      AND coalesce(c.estado, 'activo') <> 'baja'
  LOOP
    INSERT INTO public.marketing_sends (campaign_id, clinic_id, client_id, to_email, status)
    VALUES (v_camp.id, v_camp.clinic_id, r.id, lower(trim(r.email)), 'queued');

    INSERT INTO public.queued_emails (
      clinic_id, campaign_id, client_id, to_email, to_name, subject, body_html, variables, status
    ) VALUES (
      v_camp.clinic_id,
      v_camp.id,
      r.id,
      lower(trim(r.email)),
      trim(both FROM coalesce(r.name, '') || ' ' || coalesce(r.surname, '')),
      v_camp.subject,
      v_camp.body_html,
      jsonb_build_object(
        'nombre_paciente', coalesce(nullif(trim(both FROM coalesce(r.name, '') || ' ' || coalesce(r.surname, '')), ''), r.name, 'Cliente'),
        'client_name', coalesce(nullif(trim(both FROM coalesce(r.name, '') || ' ' || coalesce(r.surname, '')), ''), r.name, 'Cliente'),
        'nombre_clinica', coalesce(v_clinic.name, 'Clínica'),
        'clinic_name', coalesce(v_clinic.name, 'Clínica'),
        'fecha_cita', to_char(now(), 'DD/MM/YYYY'),
        'appointment_date', to_char(now(), 'DD/MM/YYYY'),
        'treatment_name', 'tu tratamiento'
      ),
      'queued'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.marketing_campaigns
  SET status = 'queued', updated_at = now()
  WHERE id = v_camp.id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_marketing_campaign(uuid) TO authenticated;
