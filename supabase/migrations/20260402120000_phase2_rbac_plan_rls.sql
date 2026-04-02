-- Fase 2 — RBAC por rol en clínica + límites por subscription_tier (presupuestos/bonos).
-- Sustituye políticas tenant_all_* (FOR ALL) por SELECT/INSERT/UPDATE/DELETE donde aplica.

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
    'admin'::text
  );
$$;

COMMENT ON FUNCTION public.current_user_role_in_clinic() IS 'Rol en la clínica activa (user_clinic_memberships); por defecto admin.';

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
    'integral'::text
  );
$$;

COMMENT ON FUNCTION public.current_clinic_subscription_tier() IS 'Plan de la clínica actual (clinics.subscription_tier).';

CREATE OR REPLACE FUNCTION public.current_clinic_allows_presupuestos_and_bonos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_clinic_subscription_tier() = ANY (
    ARRAY['clinic'::text, 'integral'::text]
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_role_can_delete_operational()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role_in_clinic() = ANY (
    ARRAY['admin'::text, 'staff_medico'::text]
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_role_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role_in_clinic() = 'admin'::text;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role_in_clinic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_subscription_tier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_allows_presupuestos_and_bonos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_role_can_delete_operational() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_role_is_admin() TO authenticated;

-- Quitar políticas FOR ALL de la fase 1C
DROP POLICY IF EXISTS "tenant_all_clients" ON public.clients;
DROP POLICY IF EXISTS "tenant_all_appointments" ON public.appointments;
DROP POLICY IF EXISTS "tenant_all_bonus_templates" ON public.bonus_templates;
DROP POLICY IF EXISTS "tenant_all_client_bonuses" ON public.client_bonuses;
DROP POLICY IF EXISTS "tenant_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "tenant_all_finance_entries" ON public.finance_entries;
DROP POLICY IF EXISTS "tenant_all_inventory" ON public.inventory;
DROP POLICY IF EXISTS "tenant_all_inventory_batches" ON public.inventory_batches;
DROP POLICY IF EXISTS "tenant_all_invoice_series" ON public.invoice_series;
DROP POLICY IF EXISTS "tenant_all_invoice_series_rectified" ON public.invoice_series_rectified;
DROP POLICY IF EXISTS "tenant_all_plantillas_consentimiento" ON public.plantillas_consentimiento;
DROP POLICY IF EXISTS "tenant_all_presupuestos" ON public.presupuestos;
DROP POLICY IF EXISTS "tenant_all_presupuesto_lineas" ON public.presupuesto_lineas;
DROP POLICY IF EXISTS "tenant_all_recurring_config" ON public.recurring_config;
DROP POLICY IF EXISTS "tenant_all_seguimientos_cliente" ON public.seguimientos_cliente;
DROP POLICY IF EXISTS "tenant_all_session_photos" ON public.session_photos;
DROP POLICY IF EXISTS "tenant_all_signed_consents" ON public.signed_consents;
DROP POLICY IF EXISTS "tenant_all_treatment_groups" ON public.treatment_groups;
DROP POLICY IF EXISTS "tenant_all_treatments" ON public.treatments;

-- clients
CREATE POLICY "tenant_clients_select" ON public.clients FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
  );

-- appointments (recepción puede dar de baja citas)
CREATE POLICY "tenant_appts_select" ON public.appointments FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_appts_insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_appts_update" ON public.appointments FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_appts_delete" ON public.appointments FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

-- bonus_templates (plan clinic|integral)
CREATE POLICY "tenant_bt_select" ON public.bonus_templates FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_bt_insert" ON public.bonus_templates FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_bt_update" ON public.bonus_templates FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_bt_delete" ON public.bonus_templates FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );

-- client_bonuses
CREATE POLICY "tenant_cb_select" ON public.client_bonuses FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_cb_insert" ON public.client_bonuses FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_cb_update" ON public.client_bonuses FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_cb_delete" ON public.client_bonuses FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );

-- expenses: borrar solo admin
CREATE POLICY "tenant_exp_select" ON public.expenses FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_exp_insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_exp_update" ON public.expenses FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_exp_delete" ON public.expenses FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

-- finance_entries
CREATE POLICY "tenant_fe_select" ON public.finance_entries FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_fe_insert" ON public.finance_entries FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_fe_update" ON public.finance_entries FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_fe_delete" ON public.finance_entries FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

-- inventory
CREATE POLICY "tenant_inv_select" ON public.inventory FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_inv_insert" ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_inv_update" ON public.inventory FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_inv_delete" ON public.inventory FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
  );

-- inventory_batches
CREATE POLICY "tenant_ib_select" ON public.inventory_batches FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_ib_insert" ON public.inventory_batches FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_ib_update" ON public.inventory_batches FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_ib_delete" ON public.inventory_batches FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

-- series fiscales: solo admin modifica
CREATE POLICY "tenant_is_select" ON public.invoice_series FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_is_insert" ON public.invoice_series FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );
CREATE POLICY "tenant_is_update" ON public.invoice_series FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );
CREATE POLICY "tenant_is_delete" ON public.invoice_series FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

CREATE POLICY "tenant_isr_select" ON public.invoice_series_rectified FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_isr_insert" ON public.invoice_series_rectified FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );
CREATE POLICY "tenant_isr_update" ON public.invoice_series_rectified FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );
CREATE POLICY "tenant_isr_delete" ON public.invoice_series_rectified FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

-- plantillas
CREATE POLICY "tenant_pc_select" ON public.plantillas_consentimiento FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_pc_insert" ON public.plantillas_consentimiento FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_pc_update" ON public.plantillas_consentimiento FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_pc_delete" ON public.plantillas_consentimiento FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
  );

-- presupuestos
CREATE POLICY "tenant_pres_select" ON public.presupuestos FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_pres_insert" ON public.presupuestos FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_pres_update" ON public.presupuestos FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );
CREATE POLICY "tenant_pres_delete" ON public.presupuestos FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
    AND public.current_clinic_allows_presupuestos_and_bonos()
  );

-- presupuesto_lineas
CREATE POLICY "tenant_pl_select" ON public.presupuesto_lineas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  );
CREATE POLICY "tenant_pl_insert" ON public.presupuesto_lineas FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
    AND EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  );
CREATE POLICY "tenant_pl_update" ON public.presupuesto_lineas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  )
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.current_clinic_allows_presupuestos_and_bonos()
    AND EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  );
CREATE POLICY "tenant_pl_delete" ON public.presupuesto_lineas FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
    AND public.current_clinic_allows_presupuestos_and_bonos()
    AND EXISTS (
      SELECT 1
      FROM public.presupuestos p
      WHERE p.id = presupuesto_lineas.presupuesto_id
        AND p.clinic_id = public.current_user_clinic_id()
    )
  );

-- recurring_config
CREATE POLICY "tenant_rc_select" ON public.recurring_config FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_rc_insert" ON public.recurring_config FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_rc_update" ON public.recurring_config FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_rc_delete" ON public.recurring_config FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

-- seguimientos
CREATE POLICY "tenant_seg_select" ON public.seguimientos_cliente FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_seg_insert" ON public.seguimientos_cliente FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_seg_update" ON public.seguimientos_cliente FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_seg_delete" ON public.seguimientos_cliente FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

-- session_photos
CREATE POLICY "tenant_sp_select" ON public.session_photos FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sp_insert" ON public.session_photos FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sp_update" ON public.session_photos FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sp_delete" ON public.session_photos FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

-- signed_consents
CREATE POLICY "tenant_sc_select" ON public.signed_consents FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sc_insert" ON public.signed_consents FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sc_update" ON public.signed_consents FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_sc_delete" ON public.signed_consents FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

-- treatment_groups
CREATE POLICY "tenant_tg_select" ON public.treatment_groups FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tg_insert" ON public.treatment_groups FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tg_update" ON public.treatment_groups FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tg_delete" ON public.treatment_groups FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
  );

-- treatments
CREATE POLICY "tenant_tr_select" ON public.treatments FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tr_insert" ON public.treatments FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tr_update" ON public.treatments FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());
CREATE POLICY "tenant_tr_delete" ON public.treatments FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_can_delete_operational()
  );
