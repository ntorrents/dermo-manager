-- Reaplica RPC de marketing con destinatarios explícitos (corrige overload 1-arg).

DROP FUNCTION IF EXISTS public.queue_marketing_campaign(uuid);
DROP FUNCTION IF EXISTS public.queue_marketing_campaign(uuid, uuid[], text[]);

CREATE OR REPLACE FUNCTION public.queue_marketing_campaign(
  p_campaign_id uuid,
  p_client_ids uuid[] DEFAULT NULL,
  p_extra_emails text[] DEFAULT NULL
)
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
  v_email text;
  v_ids uuid[];
  v_extras text[];
BEGIN
  SELECT * INTO v_camp FROM public.marketing_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR v_camp.clinic_id IS DISTINCT FROM public.current_user_clinic_id() THEN
    RAISE EXCEPTION 'Campaña no encontrada';
  END IF;

  v_ids := coalesce(p_client_ids, ARRAY[]::uuid[]);
  v_extras := coalesce(p_extra_emails, ARRAY[]::text[]);

  IF coalesce(cardinality(v_ids), 0) = 0 AND coalesce(cardinality(v_extras), 0) = 0 THEN
    RAISE EXCEPTION 'Debes indicar al menos un destinatario (clientes o emails sueltos)';
  END IF;

  SELECT * INTO v_clinic FROM public.clinics WHERE id = v_camp.clinic_id;

  FOR r IN
    SELECT c.id, c.name, c.surname, c.email
    FROM public.clients c
    WHERE c.clinic_id = v_camp.clinic_id
      AND c.id = ANY (v_ids)
      AND c.email IS NOT NULL
      AND trim(c.email) <> ''
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
      trim(both from coalesce(r.name, '') || ' ' || coalesce(r.surname, '')),
      v_camp.subject,
      v_camp.body_html,
      jsonb_build_object(
        'nombre_paciente', coalesce(nullif(trim(both from coalesce(r.name, '') || ' ' || coalesce(r.surname, '')), ''), r.name, 'Cliente'),
        'client_name', coalesce(nullif(trim(both from coalesce(r.name, '') || ' ' || coalesce(r.surname, '')), ''), r.name, 'Cliente'),
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

  FOREACH v_email IN ARRAY v_extras
  LOOP
    v_email := lower(trim(v_email));
    IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.queued_emails q
      WHERE q.campaign_id = v_camp.id AND q.to_email = v_email AND q.status = 'queued'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.marketing_sends (campaign_id, clinic_id, client_id, to_email, status)
    VALUES (v_camp.id, v_camp.clinic_id, NULL, v_email, 'queued');

    INSERT INTO public.queued_emails (
      clinic_id, campaign_id, client_id, to_email, to_name, subject, body_html, variables, status
    ) VALUES (
      v_camp.clinic_id,
      v_camp.id,
      NULL,
      v_email,
      split_part(v_email, '@', 1),
      v_camp.subject,
      v_camp.body_html,
      jsonb_build_object(
        'nombre_paciente', split_part(v_email, '@', 1),
        'client_name', split_part(v_email, '@', 1),
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

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Ningún destinatario válido con email';
  END IF;

  UPDATE public.marketing_campaigns
  SET status = 'queued', updated_at = now()
  WHERE id = v_camp.id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_marketing_campaign(uuid, uuid[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_marketing_email(
  p_to_email text,
  p_subject text,
  p_body_html text,
  p_client_id uuid DEFAULT NULL,
  p_to_name text DEFAULT NULL,
  p_variables jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_clinic_name text;
  v_id uuid;
  v_email text;
  v_vars jsonb;
BEGIN
  v_clinic_id := public.current_user_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Sin clínica activa';
  END IF;

  v_email := lower(trim(coalesce(p_to_email, '')));
  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF trim(coalesce(p_subject, '')) = '' THEN
    RAISE EXCEPTION 'Asunto obligatorio';
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = v_clinic_id;

  v_vars := coalesce(p_variables, '{}'::jsonb)
    || jsonb_build_object(
      'nombre_clinica', coalesce(v_clinic_name, 'Clínica'),
      'clinic_name', coalesce(v_clinic_name, 'Clínica')
    );

  INSERT INTO public.queued_emails (
    clinic_id, campaign_id, client_id, to_email, to_name, subject, body_html, variables, status
  ) VALUES (
    v_clinic_id,
    NULL,
    p_client_id,
    v_email,
    coalesce(nullif(trim(p_to_name), ''), split_part(v_email, '@', 1)),
    p_subject,
    p_body_html,
    v_vars,
    'queued'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_marketing_email(text, text, text, uuid, text, jsonb) TO authenticated;
