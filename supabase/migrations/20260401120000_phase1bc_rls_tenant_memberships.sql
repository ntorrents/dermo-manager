-- Fase 1B + 1C — Membresías clínica↔usuario, bloqueo de clinic_id en perfiles,
-- y RLS por tenant (todas las filas visibles/modificables dentro de la misma clínica).

-- === 1B: membresías (base RBAC futura) + integridad perfil ===

CREATE TABLE public.user_clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin'
    CONSTRAINT user_clinic_memberships_role_check CHECK (
      role = ANY (ARRAY['admin'::text, 'staff_medico'::text, 'recepcion'::text])
    ),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_clinic_memberships_user_clinic_key UNIQUE (user_id, clinic_id)
);

COMMENT ON TABLE public.user_clinic_memberships IS 'Membresía usuario–clínica; Fase 2 usará role. clinic_id primario sigue en profiles hasta selector multi-clínica.';

INSERT INTO public.user_clinic_memberships (user_id, clinic_id, role)
SELECT p.id, p.clinic_id, 'admin'::text
FROM public.profiles p
ON CONFLICT (user_id, clinic_id) DO NOTHING;

CREATE INDEX idx_user_clinic_memberships_clinic_id ON public.user_clinic_memberships USING btree (clinic_id);
CREATE INDEX idx_user_clinic_memberships_user_id ON public.user_clinic_memberships USING btree (user_id);

ALTER TABLE public.user_clinic_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select_own"
  ON public.user_clinic_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.user_clinic_memberships TO authenticated;
GRANT ALL ON TABLE public.user_clinic_memberships TO service_role;

CREATE OR REPLACE FUNCTION public.profiles_prevent_clinic_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'UPDATE'
     AND new.clinic_id IS DISTINCT FROM old.clinic_id THEN
    RAISE EXCEPTION 'No está permitido cambiar clinic_id desde la aplicación'
      USING errcode = 'check_violation';
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER profiles_prevent_clinic_id_change_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_clinic_id_change();

COMMENT ON FUNCTION public.profiles_prevent_clinic_id_change() IS 'Evita escalada de tenant alterando profiles.clinic_id (solo migraciones/service_role fuera de RLS).';

-- === 1C: helper de tenant (lee perfil; bypass RLS con SECURITY DEFINER) ===

CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_clinic_id() IS 'Clínica activa del usuario (profiles.clinic_id). Usado en políticas RLS.';

GRANT EXECUTE ON FUNCTION public.current_user_clinic_id() TO authenticated;

-- === 1C: eliminar políticas antiguas (solo user_id) ===

DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users manage own bonus_templates" ON public.bonus_templates;
DROP POLICY IF EXISTS "Users manage own client_bonuses" ON public.client_bonuses;
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users manage own finance_entries" ON public.finance_entries;
DROP POLICY IF EXISTS "Users can crud own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users manage own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage own batches" ON public.inventory_batches;
DROP POLICY IF EXISTS "Users manage own invoice series" ON public.invoice_series;
DROP POLICY IF EXISTS "Users manage own rectified series" ON public.invoice_series_rectified;
DROP POLICY IF EXISTS "Users can manage own consent templates" ON public.plantillas_consentimiento;
DROP POLICY IF EXISTS "Users manage own presupuesto_lineas" ON public.presupuesto_lineas;
DROP POLICY IF EXISTS "Users manage own presupuestos" ON public.presupuestos;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users manage own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can crud own config" ON public.recurring_config;
DROP POLICY IF EXISTS "Users manage own recurring_config" ON public.recurring_config;
DROP POLICY IF EXISTS "Users can manage own client follow-ups" ON public.seguimientos_cliente;
DROP POLICY IF EXISTS "Users can manage own session photos" ON public.session_photos;
DROP POLICY IF EXISTS "Users can manage own signed consents" ON public.signed_consents;
DROP POLICY IF EXISTS "Users manage own treatment_groups" ON public.treatment_groups;
DROP POLICY IF EXISTS "Users can crud own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users manage own treatments" ON public.treatments;

-- === Perfiles: solo la fila propia; sin leak cross-tenant ===

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- === Tablas operativas: todo el personal de la clínica comparte datos ===

CREATE POLICY "tenant_all_clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_bonus_templates"
  ON public.bonus_templates
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_client_bonuses"
  ON public.client_bonuses
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_finance_entries"
  ON public.finance_entries
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_inventory"
  ON public.inventory
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_inventory_batches"
  ON public.inventory_batches
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_invoice_series"
  ON public.invoice_series
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_invoice_series_rectified"
  ON public.invoice_series_rectified
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_plantillas_consentimiento"
  ON public.plantillas_consentimiento
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_presupuestos"
  ON public.presupuestos
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_presupuesto_lineas"
  ON public.presupuesto_lineas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
    AND clinic_id = public.current_user_clinic_id()
  );

CREATE POLICY "tenant_all_recurring_config"
  ON public.recurring_config
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_seguimientos_cliente"
  ON public.seguimientos_cliente
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_session_photos"
  ON public.session_photos
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_signed_consents"
  ON public.signed_consents
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_treatment_groups"
  ON public.treatment_groups
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_all_treatments"
  ON public.treatments
  FOR ALL
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
