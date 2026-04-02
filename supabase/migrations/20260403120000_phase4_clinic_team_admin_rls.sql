-- Fase 4 — Gestión de equipo en Configuración: admins ven perfiles de la clínica,
-- roles y pueden invitar (usuario ya existente en auth) / quitar miembros / actualizar rol.
-- Mantiene el bloqueo general de clinic_id en profiles salvo vía RPC con bypass controlado.

-- 1) Bypass temporal para cambios de clinic_id solo desde RPC de mantenimiento
CREATE OR REPLACE FUNCTION public.profiles_prevent_clinic_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'UPDATE'
     AND new.clinic_id IS DISTINCT FROM old.clinic_id THEN
    IF COALESCE(current_setting('app.allow_profile_clinic_change', true), '') = '1' THEN
      RETURN new;
    END IF;
    RAISE EXCEPTION 'No está permitido cambiar clinic_id desde la aplicación'
      USING errcode = 'check_violation';
  END IF;
  RETURN new;
END;
$$;

-- 2) Evitar quitar el último admin de una clínica (UPDATE de rol)
CREATE OR REPLACE FUNCTION public.user_clinic_memberships_enforce_min_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  admin_count int;
BEGIN
  IF tg_op = 'UPDATE'
     AND old.role = 'admin'::text
     AND new.role IS DISTINCT FROM 'admin'::text THEN
    SELECT count(*) INTO admin_count
    FROM public.user_clinic_memberships
    WHERE clinic_id = old.clinic_id
      AND role = 'admin'::text;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Debe existir al menos un administrador en la clínica'
        USING errcode = 'check_violation';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS user_clinic_memberships_enforce_min_admin_trg ON public.user_clinic_memberships;
CREATE TRIGGER user_clinic_memberships_enforce_min_admin_trg
  BEFORE UPDATE ON public.user_clinic_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.user_clinic_memberships_enforce_min_admin();

COMMENT ON FUNCTION public.user_clinic_memberships_enforce_min_admin() IS 'Impide degradar al último admin de una clínica.';

-- 3) RLS: admins leen membresías de su clínica; actualizan / insertan
CREATE POLICY "memberships_select_clinic_admins"
  ON public.user_clinic_memberships
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

CREATE POLICY "memberships_update_clinic_admins"
  ON public.user_clinic_memberships
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  )
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

CREATE POLICY "memberships_insert_clinic_admins"
  ON public.user_clinic_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

-- 4) RLS: admins leen perfiles de la clínica (listado equipo; OR con profiles_select_own)
CREATE POLICY "profiles_select_same_clinic_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

GRANT INSERT, UPDATE ON TABLE public.user_clinic_memberships TO authenticated;

-- 5) UUID clínica legado (mismo que fase 1A)
-- 6) RPC: invitar por email (cuenta ya creada en Supabase Auth)
CREATE OR REPLACE FUNCTION public.admin_invite_user_to_my_clinic(p_email text, p_role text DEFAULT 'recepcion')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_uid uuid;
  v_role text;
BEGIN
  IF NOT public.tenant_role_is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING errcode = '42501';
  END IF;

  v_clinic := public.current_user_clinic_id();
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Clínica no disponible';
  END IF;

  v_role := lower(trim(p_role));
  IF v_role IS NULL OR v_role NOT IN ('admin', 'staff_medico', 'recepcion') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email));

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario registrado con ese correo'; -- hint: debe registrarse antes
  END IF;

  IF v_uid = auth.uid() THEN
    RAISE EXCEPTION 'No puedes invitarte a ti mismo';
  END IF;

  PERFORM set_config('app.allow_profile_clinic_change', '1', true);

  UPDATE public.profiles
  SET clinic_id = v_clinic,
      updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.user_clinic_memberships (user_id, clinic_id, role)
  VALUES (v_uid, v_clinic, v_role)
  ON CONFLICT (user_id, clinic_id) DO UPDATE
  SET role = EXCLUDED.role;
END;
$$;

COMMENT ON FUNCTION public.admin_invite_user_to_my_clinic(text, text) IS
  'Admin: asigna un usuario existente (auth) a su clínica y rol. No crea cuentas nuevas.';

-- 7) RPC: quitar miembro (reubica al tenant legado y elimina membresía)
CREATE OR REPLACE FUNCTION public.admin_remove_user_from_my_clinic(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  admin_count int;
BEGIN
  IF NOT public.tenant_role_is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING errcode = '42501';
  END IF;

  v_clinic := public.current_user_clinic_id();
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Clínica no disponible';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo de la clínica';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_clinic_memberships m
    WHERE m.user_id = p_user_id
      AND m.clinic_id = v_clinic
  ) THEN
    RAISE EXCEPTION 'Usuario no pertenece a esta clínica';
  END IF;

  SELECT count(*) INTO admin_count
  FROM public.user_clinic_memberships
  WHERE clinic_id = v_clinic
    AND role = 'admin'::text;

  IF EXISTS (
      SELECT 1
      FROM public.user_clinic_memberships
      WHERE user_id = p_user_id
        AND clinic_id = v_clinic
        AND role = 'admin'::text
    )
    AND admin_count <= 1 THEN
    RAISE EXCEPTION 'No se puede eliminar al único administrador de la clínica';
  END IF;

  DELETE FROM public.user_clinic_memberships
  WHERE user_id = p_user_id
    AND clinic_id = v_clinic;

  PERFORM set_config('app.allow_profile_clinic_change', '1', true);

  UPDATE public.profiles
  SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.admin_remove_user_from_my_clinic(uuid) IS
  'Admin: elimina membresía y mueve el perfil al tenant legado por defecto.';

GRANT EXECUTE ON FUNCTION public.admin_invite_user_to_my_clinic(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_from_my_clinic(uuid) TO authenticated;
