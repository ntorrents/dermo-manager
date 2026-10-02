-- Fase 2 seguridad SaaS: endurecer aislamiento multi-tenant.
-- 1) RPCs de numeración de facturas: no aceptar clinic_id ajeno (SECURITY DEFINER).
-- 2) Revocar EXECUTE de RPCs legacy (user_id) a anon/authenticated.
-- 3) Defaults fail-closed en rol y plan.
-- 4) FORCE ROW LEVEL SECURITY en tablas de negocio (evita bypass del owner de tabla).

-- ---------------------------------------------------------------------------
-- 1) Invoice RPCs by clinic: exigir auth + clinic propia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_invoice_number_by_clinic(p_clinic_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING errcode = '42501';
  END IF;

  v_clinic := public.current_user_clinic_id();
  IF v_clinic IS NULL OR p_clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'clinic_id no autorizado para numeración de facturas'
      USING errcode = '42501';
  END IF;

  INSERT INTO public.invoice_series (clinic_id, user_id, year, last_number)
  VALUES (v_clinic, auth.uid(), p_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET last_number = public.invoice_series.last_number + 1,
                user_id = auth.uid()
  RETURNING last_number INTO v_next;

  RETURN 'F' || p_year || '-' || lpad(v_next::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_rectified_invoice_number_by_clinic(p_clinic_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING errcode = '42501';
  END IF;

  v_clinic := public.current_user_clinic_id();
  IF v_clinic IS NULL OR p_clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'clinic_id no autorizado para numeración de facturas rectificativas'
      USING errcode = '42501';
  END IF;

  INSERT INTO public.invoice_series_rectified (clinic_id, user_id, year, last_number)
  VALUES (v_clinic, auth.uid(), p_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET last_number = public.invoice_series_rectified.last_number + 1,
                user_id = auth.uid()
  RETURNING last_number INTO v_next;

  RETURN 'R-' || p_year || '-' || lpad(v_next::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_invoice_number_by_clinic(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_invoice_number_by_clinic(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number_by_clinic(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number_by_clinic(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_next_rectified_invoice_number_by_clinic(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_rectified_invoice_number_by_clinic(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_rectified_invoice_number_by_clinic(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_rectified_invoice_number_by_clinic(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Legacy RPCs (por user_id): bloquear a clientes; solo service_role si hace falta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_user_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'RPC legado get_next_invoice_number deshabilitado. Usa get_next_invoice_number_by_clinic.'
    USING errcode = '0A000';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_rectified_invoice_number(p_user_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'RPC legado get_next_rectified_invoice_number deshabilitado. Usa get_next_rectified_invoice_number_by_clinic.'
    USING errcode = '0A000';
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_invoice_number(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_invoice_number(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_next_invoice_number(uuid, integer) FROM authenticated;

REVOKE ALL ON FUNCTION public.get_next_rectified_invoice_number(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_rectified_invoice_number(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_next_rectified_invoice_number(uuid, integer) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3) Defaults fail-closed (rol / plan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role_in_clinic()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT m.role
      FROM public.user_clinic_memberships m
      WHERE m.user_id = auth.uid()
        AND m.clinic_id = public.current_user_clinic_id()
      LIMIT 1
    ),
    'recepcion'::text
  );
$$;

COMMENT ON FUNCTION public.current_user_role_in_clinic() IS
  'Rol en la clínica activa; sin membresía → recepcion (fail-closed, no admin).';

CREATE OR REPLACE FUNCTION public.current_clinic_subscription_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.subscription_tier
      FROM public.clinics c
      WHERE c.id = public.current_user_clinic_id()
    ),
    'basic'::text
  );
$$;

COMMENT ON FUNCTION public.current_clinic_subscription_tier() IS
  'Plan de la clínica actual; sin fila → basic (fail-closed, no integral).';

-- ---------------------------------------------------------------------------
-- 4) FORCE RLS en tablas de negocio con clinic_id (y clinics)
-- google_calendar_connections: RLS on + sin grants a authenticated (solo service_role) — OK
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointments',
    'audit_log',
    'bonus_templates',
    'client_bonuses',
    'clients',
    'clinics',
    'expenses',
    'finance_entries',
    'inventory',
    'inventory_batches',
    'invoice_series',
    'invoice_series_rectified',
    'plantillas_consentimiento',
    'presupuesto_lineas',
    'presupuestos',
    'profiles',
    'recurring_config',
    'seguimientos_cliente',
    'session_photos',
    'signed_consents',
    'tax_declarations',
    'treatment_groups',
    'treatments',
    'user_clinic_memberships'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;
