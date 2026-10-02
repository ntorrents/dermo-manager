-- Fase 5 SaaS: clinics active/modules/fee + RLS plataforma (JWT app_metadata.role=superadmin).

-- ---------------------------------------------------------------------------
-- Helper JWT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin',
    false
  );
$$;

COMMENT ON FUNCTION public.is_platform_superadmin() IS
  'True si el JWT tiene app_metadata.role = superadmin.';

GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Columnas clinics
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS active_modules text[] NOT NULL DEFAULT ARRAY[
    'agenda_core',
    'google_calendar',
    'clients_crm',
    'bonos_manager',
    'legal_signatures',
    'photo_vault',
    'finance_basic',
    'daily_cash',
    'finance_analytics',
    'inventory_core',
    'inventory_traceability',
    'suppliers_manager',
    'taxes_aeat'
  ]::text[];

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS custom_fee_eur numeric(12, 2);

COMMENT ON COLUMN public.clinics.active IS 'Clínica operativa; false = acceso tenant bloqueado.';
COMMENT ON COLUMN public.clinics.active_modules IS 'Feature flags SaaS granulares.';
COMMENT ON COLUMN public.clinics.custom_fee_eur IS 'Override de cuota mensual (€). NULL = precio del subscription_tier.';

-- Backfill por si alguna fila quedó con default vacío
UPDATE public.clinics
SET active_modules = ARRAY[
  'agenda_core',
  'google_calendar',
  'clients_crm',
  'bonos_manager',
  'legal_signatures',
  'photo_vault',
  'finance_basic',
  'daily_cash',
  'finance_analytics',
  'inventory_core',
  'inventory_traceability',
  'suppliers_manager',
  'taxes_aeat'
]::text[]
WHERE active_modules IS NULL OR cardinality(active_modules) = 0;

-- ---------------------------------------------------------------------------
-- RLS clinics: superadmin full access (además de policies tenant existentes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinics_select_superadmin ON public.clinics;
CREATE POLICY clinics_select_superadmin
  ON public.clinics FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS clinics_insert_superadmin ON public.clinics;
CREATE POLICY clinics_insert_superadmin
  ON public.clinics FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superadmin());

DROP POLICY IF EXISTS clinics_update_superadmin ON public.clinics;
CREATE POLICY clinics_update_superadmin
  ON public.clinics FOR UPDATE TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

DROP POLICY IF EXISTS clinics_delete_superadmin ON public.clinics;
CREATE POLICY clinics_delete_superadmin
  ON public.clinics FOR DELETE TO authenticated
  USING (public.is_platform_superadmin());

-- ---------------------------------------------------------------------------
-- RLS memberships: superadmin cross-tenant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS memberships_select_superadmin ON public.user_clinic_memberships;
CREATE POLICY memberships_select_superadmin
  ON public.user_clinic_memberships FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS memberships_insert_superadmin ON public.user_clinic_memberships;
CREATE POLICY memberships_insert_superadmin
  ON public.user_clinic_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superadmin());

DROP POLICY IF EXISTS memberships_update_superadmin ON public.user_clinic_memberships;
CREATE POLICY memberships_update_superadmin
  ON public.user_clinic_memberships FOR UPDATE TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

DROP POLICY IF EXISTS memberships_delete_superadmin ON public.user_clinic_memberships;
CREATE POLICY memberships_delete_superadmin
  ON public.user_clinic_memberships FOR DELETE TO authenticated
  USING (public.is_platform_superadmin());

-- ---------------------------------------------------------------------------
-- RLS profiles: superadmin puede listar emails/nombres de cualquier clínica
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_superadmin ON public.profiles;
CREATE POLICY profiles_select_superadmin
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

-- Permitir a superadmin asignar clinic_id (trigger lo bloquea salvo flag)
CREATE OR REPLACE FUNCTION public.platform_assign_user_clinic(
  p_user_id uuid,
  p_clinic_id uuid,
  p_role text DEFAULT 'admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'staff_medico', 'recepcion') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  PERFORM set_config('app.allow_profile_clinic_change', '1', true);

  UPDATE public.profiles
  SET clinic_id = p_clinic_id
  WHERE id = p_user_id;

  INSERT INTO public.user_clinic_memberships (user_id, clinic_id, role)
  VALUES (p_user_id, p_clinic_id, p_role)
  ON CONFLICT (user_id, clinic_id)
  DO UPDATE SET role = EXCLUDED.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_assign_user_clinic(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Solo superadmin puede mutar flags SaaS (active / modules / fee / tier)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinics_protect_saas_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_platform_superadmin() THEN
    RETURN NEW;
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active
     OR NEW.active_modules IS DISTINCT FROM OLD.active_modules
     OR NEW.custom_fee_eur IS DISTINCT FROM OLD.custom_fee_eur
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Solo superadmin puede cambiar plan, módulos o cuota'
      USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_protect_saas_columns_trg ON public.clinics;
CREATE TRIGGER clinics_protect_saas_columns_trg
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.clinics_protect_saas_columns();
