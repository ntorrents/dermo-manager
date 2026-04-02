-- Fase 3D — Plantillas de consentimiento: CRUD para cualquier miembro autenticado de la clínica.
-- (Según requisito: todos pueden crear/borrar/editar plantillas compartidas.)

DROP POLICY IF EXISTS "tenant_pc_delete" ON public.plantillas_consentimiento;

CREATE POLICY "tenant_pc_delete"
  ON public.plantillas_consentimiento
  FOR DELETE
  TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

