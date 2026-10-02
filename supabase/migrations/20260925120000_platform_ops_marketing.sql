-- Plataforma ops: auditoría filtrada, impersonación, métricas storage, marketing.

-- ---------------------------------------------------------------------------
-- 1) Eventos de plataforma (importancia) + lectura global de audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL
    CONSTRAINT platform_event_severity_check CHECK (
      severity = ANY (ARRAY['error'::text, 'warning'::text, 'info'::text])
    ),
  category text NOT NULL
    CONSTRAINT platform_event_category_check CHECK (
      category = ANY (ARRAY[
        'system_error'::text,
        'admin_access'::text,
        'critical_config'::text
      ])
    ),
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  title text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_event_log_created_idx
  ON public.platform_event_log (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_event_log_category_idx
  ON public.platform_event_log (category, created_at DESC);

ALTER TABLE public.platform_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_event_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pel_select_superadmin ON public.platform_event_log;
CREATE POLICY pel_select_superadmin
  ON public.platform_event_log FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS pel_insert_superadmin ON public.platform_event_log;
CREATE POLICY pel_insert_superadmin
  ON public.platform_event_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superadmin());

GRANT SELECT, INSERT ON TABLE public.platform_event_log TO authenticated;
GRANT ALL ON TABLE public.platform_event_log TO service_role;

DROP POLICY IF EXISTS audit_log_select_superadmin ON public.audit_log;
CREATE POLICY audit_log_select_superadmin
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

-- Log crítico al cambiar plan / módulos / cuota / active
CREATE OR REPLACE FUNCTION public.clinics_log_critical_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
    OR NEW.active_modules IS DISTINCT FROM OLD.active_modules
    OR NEW.custom_fee_eur IS DISTINCT FROM OLD.custom_fee_eur
    OR NEW.active IS DISTINCT FROM OLD.active
  ) THEN
    INSERT INTO public.platform_event_log (severity, category, clinic_id, user_id, title, detail)
    VALUES (
      'warning',
      'critical_config',
      NEW.id,
      auth.uid(),
      'Cambio crítico de configuración de clínica',
      jsonb_build_object(
        'before', jsonb_build_object(
          'subscription_tier', OLD.subscription_tier,
          'active', OLD.active,
          'custom_fee_eur', OLD.custom_fee_eur,
          'active_modules', OLD.active_modules
        ),
        'after', jsonb_build_object(
          'subscription_tier', NEW.subscription_tier,
          'active', NEW.active,
          'custom_fee_eur', NEW.custom_fee_eur,
          'active_modules', NEW.active_modules
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_log_critical_config_trg ON public.clinics;
CREATE TRIGGER clinics_log_critical_config_trg
  AFTER UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.clinics_log_critical_config();

-- Vista unificada filtrada (RPC)
CREATE OR REPLACE FUNCTION public.platform_important_logs(
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  source text,
  severity text,
  category text,
  clinic_id uuid,
  clinic_name text,
  user_id uuid,
  user_email text,
  title text,
  detail jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH combined AS (
    SELECT
      e.id,
      'platform'::text AS source,
      e.severity,
      e.category,
      e.clinic_id,
      e.title,
      e.detail,
      e.created_at,
      e.user_id
    FROM public.platform_event_log e
    WHERE p_category IS NULL OR e.category = p_category

    UNION ALL

    SELECT
      a.id,
      'audit'::text,
      CASE
        WHEN a.action = 'delete' THEN 'error'
        WHEN a.entity_type IN ('clinics', 'user_clinic_memberships') THEN 'warning'
        ELSE 'info'
      END,
      CASE
        WHEN a.action = 'delete' THEN 'system_error'
        WHEN a.entity_type IN ('clinics', 'user_clinic_memberships') THEN 'critical_config'
        WHEN a.entity_type = 'user_clinic_memberships' THEN 'admin_access'
        ELSE 'critical_config'
      END,
      a.clinic_id,
      a.summary,
      jsonb_build_object(
        'action', a.action,
        'entity_type', a.entity_type,
        'entity_id', a.entity_id,
        'metadata', a.metadata
      ),
      a.created_at,
      a.user_id
    FROM public.audit_log a
    WHERE (
        a.action = 'delete'
        OR a.entity_type IN ('clinics', 'user_clinic_memberships')
      )
      AND (
        p_category IS NULL
        OR (p_category = 'system_error' AND a.action = 'delete')
        OR (p_category = 'critical_config' AND a.entity_type IN ('clinics', 'user_clinic_memberships'))
        OR (p_category = 'admin_access' AND a.entity_type = 'user_clinic_memberships')
      )
  )
  SELECT
    c.id,
    c.source,
    c.severity,
    c.category,
    c.clinic_id,
    cl.name,
    c.user_id,
    u.email::text,
    c.title,
    c.detail,
    c.created_at
  FROM combined c
  LEFT JOIN public.clinics cl ON cl.id = c.clinic_id
  LEFT JOIN auth.users u ON u.id = c.user_id
  ORDER BY c.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_important_logs(text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Impersonación (superadmin → clinic_id efectivo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_impersonation (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_impersonation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_impersonation FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pi_select_own ON public.platform_impersonation;
CREATE POLICY pi_select_own
  ON public.platform_impersonation FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_platform_superadmin());

GRANT SELECT ON TABLE public.platform_impersonation TO authenticated;
GRANT ALL ON TABLE public.platform_impersonation TO service_role;

CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT i.clinic_id
      FROM public.platform_impersonation i
      WHERE i.user_id = auth.uid()
        AND public.is_platform_superadmin()
      LIMIT 1
    ),
    (
      SELECT p.clinic_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_start_impersonation(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;
  IF p_clinic_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'Clínica inválida';
  END IF;

  INSERT INTO public.platform_impersonation (user_id, clinic_id, started_at)
  VALUES (auth.uid(), p_clinic_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id,
        started_at = now();

  INSERT INTO public.platform_event_log (severity, category, clinic_id, user_id, title, detail)
  VALUES (
    'info',
    'admin_access',
    p_clinic_id,
    auth.uid(),
    'Impersonación iniciada',
    jsonb_build_object('action', 'start_impersonation')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_stop_impersonation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;

  SELECT clinic_id INTO v_clinic
  FROM public.platform_impersonation
  WHERE user_id = auth.uid();

  DELETE FROM public.platform_impersonation WHERE user_id = auth.uid();

  IF v_clinic IS NOT NULL THEN
    INSERT INTO public.platform_event_log (severity, category, clinic_id, user_id, title, detail)
    VALUES (
      'info',
      'admin_access',
      v_clinic,
      auth.uid(),
      'Impersonación finalizada',
      jsonb_build_object('action', 'stop_impersonation')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_impersonation()
RETURNS TABLE (clinic_id uuid, clinic_name text, started_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT i.clinic_id, c.name, i.started_at
  FROM public.platform_impersonation i
  JOIN public.clinics c ON c.id = i.clinic_id
  WHERE i.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_start_impersonation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_stop_impersonation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_impersonation() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Métricas crecimiento + almacenamiento
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_photos
  ADD COLUMN IF NOT EXISTS byte_size bigint;

ALTER TABLE public.signed_consents
  ADD COLUMN IF NOT EXISTS byte_size bigint;

CREATE OR REPLACE FUNCTION public.platform_growth_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;

  SELECT jsonb_build_object(
    'months', coalesce((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.month)
      FROM (
        SELECT
          to_char(d, 'YYYY-MM') AS month,
          (SELECT count(*)::int FROM public.clinics c
           WHERE date_trunc('month', c.created_at) = d) AS new_clinics,
          (SELECT count(*)::int FROM auth.users u
           WHERE date_trunc('month', u.created_at) = d) AS new_users
        FROM generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS d
      ) t
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'clinics', (SELECT count(*)::int FROM public.clinics),
      'active_clinics', (SELECT count(*)::int FROM public.clinics WHERE active IS DISTINCT FROM false),
      'users', (SELECT count(*)::int FROM auth.users)
    )
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_storage_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  db_bytes bigint;
  result jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;

  SELECT pg_database_size(current_database()) INTO db_bytes;

  SELECT jsonb_build_object(
    'database_bytes', db_bytes,
    'database_pretty', pg_size_pretty(db_bytes),
    'by_clinic', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.approx_bytes DESC)
      FROM (
        SELECT
          c.id AS clinic_id,
          c.name AS clinic_name,
          coalesce(ph.cnt, 0)::int AS photos_count,
          coalesce(ph.bytes, 0)::bigint AS photos_bytes,
          coalesce(sc.cnt, 0)::int AS consents_count,
          coalesce(sc.bytes, 0)::bigint AS consents_bytes,
          (
            CASE WHEN coalesce(ph.bytes, 0) > 0 THEN ph.bytes
                 ELSE coalesce(ph.cnt, 0) * 150000 END
            + CASE WHEN coalesce(sc.bytes, 0) > 0 THEN sc.bytes
                   ELSE coalesce(sc.cnt, 0) * 80000 END
          )::bigint AS approx_bytes
        FROM public.clinics c
        LEFT JOIN (
          SELECT clinic_id,
                 count(*)::bigint AS cnt,
                 coalesce(sum(byte_size), 0)::bigint AS bytes
          FROM public.session_photos
          GROUP BY clinic_id
        ) ph ON ph.clinic_id = c.id
        LEFT JOIN (
          SELECT clinic_id,
                 count(*)::bigint AS cnt,
                 coalesce(sum(byte_size), 0)::bigint AS bytes
          FROM public.signed_consents
          GROUP BY clinic_id
        ) sc ON sc.clinic_id = c.id
      ) x
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_growth_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_storage_metrics() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Marketing: plantillas globales + campañas clínicas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT marketing_templates_kind_check CHECK (
      kind = ANY (ARRAY[
        'budget'::text,
        'bonus'::text,
        'email_followup'::text,
        'email_reminder'::text,
        'email_campaign'::text
      ])
    ),
  name text NOT NULL,
  subject text,
  body_html text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_templates IS
  'clinic_id NULL = plantilla maestra global (superadmin); con clinic_id = clon/local.';

CREATE INDEX IF NOT EXISTS idx_marketing_templates_clinic
  ON public.marketing_templates (clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_kind
  ON public.marketing_templates (kind);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.marketing_templates (id) ON DELETE SET NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT marketing_campaigns_status_check CHECK (
      status = ANY (ARRAY['draft'::text, 'queued'::text, 'sent'::text, 'failed'::text])
    ),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic
  ON public.marketing_campaigns (clinic_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CONSTRAINT marketing_sends_status_check CHECK (
      status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'skipped'::text])
    ),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign
  ON public.marketing_sends (campaign_id);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sends FORCE ROW LEVEL SECURITY;

-- Templates: globales (NULL) lectibles por cualquier authenticated; escritura SA
-- Locales: tenant
DROP POLICY IF EXISTS mt_select ON public.marketing_templates;
CREATE POLICY mt_select ON public.marketing_templates
  FOR SELECT TO authenticated
  USING (
    clinic_id IS NULL
    OR clinic_id = public.current_user_clinic_id()
    OR public.is_platform_superadmin()
  );

DROP POLICY IF EXISTS mt_write_superadmin ON public.marketing_templates;
CREATE POLICY mt_write_superadmin ON public.marketing_templates
  FOR ALL TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

DROP POLICY IF EXISTS mt_write_tenant ON public.marketing_templates;
CREATE POLICY mt_write_tenant ON public.marketing_templates
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  )
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

DROP POLICY IF EXISTS mc_tenant ON public.marketing_campaigns;
CREATE POLICY mc_tenant ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS mc_superadmin ON public.marketing_campaigns;
CREATE POLICY mc_superadmin ON public.marketing_campaigns
  FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS ms_tenant ON public.marketing_sends;
CREATE POLICY ms_tenant ON public.marketing_sends
  FOR ALL TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_sends TO authenticated;
GRANT ALL ON TABLE public.marketing_templates TO service_role;
GRANT ALL ON TABLE public.marketing_campaigns TO service_role;
GRANT ALL ON TABLE public.marketing_sends TO service_role;

-- Clonar plantilla global → clínica
CREATE OR REPLACE FUNCTION public.clone_marketing_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_new uuid;
  v_src public.marketing_templates%ROWTYPE;
BEGIN
  v_clinic := public.current_user_clinic_id();
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Sin clínica activa';
  END IF;

  SELECT * INTO v_src FROM public.marketing_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;
  IF v_src.clinic_id IS NOT NULL AND v_src.clinic_id IS DISTINCT FROM v_clinic
     AND NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Plantilla no accesible';
  END IF;

  INSERT INTO public.marketing_templates (
    clinic_id, kind, name, subject, body_html, is_active, created_by
  ) VALUES (
    v_clinic, v_src.kind, v_src.name || ' (copia)', v_src.subject, v_src.body_html, true, auth.uid()
  )
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_marketing_template(uuid) TO authenticated;

-- Encolar envío a clientes con email (sin SMTP aún: status queued)
CREATE OR REPLACE FUNCTION public.queue_marketing_campaign(p_campaign_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp public.marketing_campaigns%ROWTYPE;
  v_count int := 0;
BEGIN
  SELECT * INTO v_camp FROM public.marketing_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR v_camp.clinic_id IS DISTINCT FROM public.current_user_clinic_id() THEN
    RAISE EXCEPTION 'Campaña no encontrada';
  END IF;

  INSERT INTO public.marketing_sends (campaign_id, clinic_id, client_id, to_email, status)
  SELECT
    v_camp.id,
    v_camp.clinic_id,
    c.id,
    lower(trim(c.email)),
    'queued'
  FROM public.clients c
  WHERE c.clinic_id = v_camp.clinic_id
    AND c.email IS NOT NULL
    AND trim(c.email) <> ''
    AND coalesce(c.estado, 'activo') <> 'baja';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.marketing_campaigns
  SET status = 'queued', updated_at = now()
  WHERE id = v_camp.id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_marketing_campaign(uuid) TO authenticated;

-- Añadir módulos marketing (bypass trigger protect SaaS en migraciones)
ALTER TABLE public.clinics DISABLE TRIGGER clinics_protect_saas_columns_trg;

UPDATE public.clinics
SET active_modules = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      coalesce(active_modules, '{}'::text[])
      || ARRAY['marketing_campaigns', 'client_followup']::text[]
    )
  )
)
WHERE subscription_tier IN ('integral', 'clinic');

UPDATE public.clinic_role_modules
SET allowed_modules = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      coalesce(allowed_modules, '{}'::text[])
      || CASE
           WHEN role = 'admin' THEN ARRAY['marketing_campaigns', 'client_followup']::text[]
           WHEN role = 'recepcion' THEN ARRAY['client_followup']::text[]
           ELSE '{}'::text[]
         END
    )
  )
);

ALTER TABLE public.clinics ENABLE TRIGGER clinics_protect_saas_columns_trg;

-- Seed global templates
INSERT INTO public.marketing_templates (clinic_id, kind, name, subject, body_html, created_by)
SELECT NULL, v.kind, v.name, v.subject, v.body_html, NULL
FROM (VALUES
  (
    'email_reminder',
    'Recordatorio de cita',
    'Recordatorio: tu cita en {{clinic_name}}',
    '<p>Hola {{client_name}},</p><p>Te recordamos tu cita el <strong>{{appointment_date}}</strong>.</p><p>¡Te esperamos!</p>'
  ),
  (
    'email_followup',
    'Seguimiento post-sesión',
    '¿Cómo te encuentras tras tu sesión?',
    '<p>Hola {{client_name}},</p><p>Esperamos que todo vaya bien tras tu última sesión de <strong>{{treatment_name}}</strong>.</p><p>Si tienes cualquier duda, responde a este correo.</p>'
  ),
  (
    'email_campaign',
    'Campaña comercial',
    'Novedades y ofertas en {{clinic_name}}',
    '<p>Hola {{client_name}},</p><p>Queremos compartirte nuestras novedades y promociones del mes.</p><p>Reserva tu cita cuando quieras.</p>'
  ),
  (
    'budget',
    'Presupuesto estándar',
    NULL,
    '<p>Presupuesto orientativo para {{client_name}}.</p><p>Detalle de tratamientos y precios según consulta.</p>'
  ),
  (
    'bonus',
    'Bono de sesiones',
    NULL,
    '<p>Información del bono de sesiones para {{client_name}}.</p>'
  )
) AS v(kind, name, subject, body_html)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates t
  WHERE t.clinic_id IS NULL AND t.kind = v.kind AND t.name = v.name
);
