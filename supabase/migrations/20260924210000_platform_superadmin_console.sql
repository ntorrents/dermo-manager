-- Fase 5b: consola plataforma — perfiles sin clínica + visibilidad por rol.

-- ---------------------------------------------------------------------------
-- profiles.clinic_id nullable (superadmin de plataforma sin tenant)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(new.raw_app_meta_data ->> 'role', '') = 'superadmin'
     OR lower(coalesce(new.email, '')) = 'superadmin@baseclinica.com' THEN
    INSERT INTO public.profiles (id, email, name, company_name, clinic_id)
    VALUES (new.id, new.email, 'Superadmin', 'Base Clínica', NULL);
  ELSE
    INSERT INTO public.profiles (id, email, name, company_name, clinic_id)
    VALUES (
      new.id,
      new.email,
      'Usuario Nuevo',
      'Mi Empresa',
      '00000000-0000-0000-0000-000000000001'::uuid
    );
  END IF;
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Visibilidad de módulos por rol (por clínica)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_role_modules (
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  role text NOT NULL
    CONSTRAINT clinic_role_modules_role_check CHECK (
      role = ANY (ARRAY['admin'::text, 'staff_medico'::text, 'recepcion'::text])
    ),
  allowed_modules text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, role)
);

COMMENT ON TABLE public.clinic_role_modules IS
  'Módulos de UI visibles por rol dentro de una clínica (intersección con clinics.active_modules).';

CREATE INDEX IF NOT EXISTS idx_clinic_role_modules_clinic_id
  ON public.clinic_role_modules USING btree (clinic_id);

ALTER TABLE public.clinic_role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_role_modules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_select_tenant ON public.clinic_role_modules;
CREATE POLICY crm_select_tenant
  ON public.clinic_role_modules FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS crm_select_superadmin ON public.clinic_role_modules;
CREATE POLICY crm_select_superadmin
  ON public.clinic_role_modules FOR SELECT TO authenticated
  USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS crm_write_superadmin ON public.clinic_role_modules;
CREATE POLICY crm_write_superadmin
  ON public.clinic_role_modules FOR ALL TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

GRANT SELECT ON TABLE public.clinic_role_modules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.clinic_role_modules TO authenticated;
GRANT ALL ON TABLE public.clinic_role_modules TO service_role;

-- Defaults razonables al crear clínica (si no hay filas)
CREATE OR REPLACE FUNCTION public.seed_clinic_role_modules(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_role_modules (clinic_id, role, allowed_modules)
  VALUES
    (
      p_clinic_id,
      'admin',
      ARRAY[
        'agenda_core','google_calendar','clients_crm','bonos_manager','legal_signatures',
        'photo_vault','finance_basic','daily_cash','finance_analytics','inventory_core',
        'inventory_traceability','suppliers_manager','taxes_aeat'
      ]::text[]
    ),
    (
      p_clinic_id,
      'staff_medico',
      ARRAY[
        'agenda_core','clients_crm','bonos_manager','legal_signatures','photo_vault',
        'inventory_core','inventory_traceability'
      ]::text[]
    ),
    (
      p_clinic_id,
      'recepcion',
      ARRAY[
        'agenda_core','clients_crm','bonos_manager','finance_basic','daily_cash'
      ]::text[]
    )
  ON CONFLICT (clinic_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_clinic_role_modules(uuid) TO authenticated;

-- Seed clínicas existentes
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.clinics LOOP
    PERFORM public.seed_clinic_role_modules(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RPCs plataforma (miembros / roles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_set_membership_role(
  p_clinic_id uuid,
  p_user_id uuid,
  p_role text
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

  UPDATE public.user_clinic_memberships
  SET role = p_role
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membresía no encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_membership_role(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_remove_membership(
  p_clinic_id uuid,
  p_user_id uuid
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

  DELETE FROM public.user_clinic_memberships
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_remove_membership(uuid, uuid) TO authenticated;

-- Asignar por email (usa platform_assign_user_clinic)
CREATE OR REPLACE FUNCTION public.platform_assign_user_by_email(
  p_email text,
  p_clinic_id uuid,
  p_role text DEFAULT 'recepcion'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Solo superadmin' USING errcode = '42501';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_email;
  END IF;

  -- No asignar clínica al propio superadmin de plataforma
  IF coalesce(
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = v_user_id),
    ''
  ) = 'superadmin' THEN
    RAISE EXCEPTION 'No se puede asignar clínica al usuario superadmin de plataforma';
  END IF;

  PERFORM public.platform_assign_user_clinic(v_user_id, p_clinic_id, p_role);
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_assign_user_by_email(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_users(p_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  surname text,
  clinic_id uuid,
  clinic_name text,
  role text,
  is_platform_superadmin boolean
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
  SELECT
    u.id,
    u.email::text,
    p.name,
    p.surname,
    p.clinic_id,
    c.name AS clinic_name,
    m.role,
    coalesce((u.raw_app_meta_data ->> 'role') = 'superadmin', false) AS is_platform_superadmin
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.clinics c ON c.id = p.clinic_id
  LEFT JOIN LATERAL (
    SELECT um.role
    FROM public.user_clinic_memberships um
    WHERE um.user_id = u.id AND um.clinic_id = p.clinic_id
    LIMIT 1
  ) m ON true
  WHERE p_search IS NULL
     OR p_search = ''
     OR u.email ILIKE '%' || p_search || '%'
     OR coalesce(p.name, '') ILIKE '%' || p_search || '%'
  ORDER BY u.email
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_users(text) TO authenticated;
