-- Registro de auditoría por clínica (eventos desde triggers en tablas operativas).
-- Lectura: solo administradores de la clínica.

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])),
  entity_type text NOT NULL,
  entity_id text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Historial de cambios relevantes por clínica; escrito solo vía triggers (sin INSERT directo desde cliente).';

CREATE INDEX audit_log_clinic_created_idx ON public.audit_log (clinic_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admins"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

GRANT SELECT ON TABLE public.audit_log TO authenticated;

-- Sin políticas INSERT/UPDATE/DELETE para authenticated: solo service role / triggers como propietario.

CREATE OR REPLACE FUNCTION public.audit_log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cl uuid;
  v_id text;
  v_action text;
  v_summary text;
BEGIN
  v_action := lower(TG_OP);

  IF TG_TABLE_NAME = 'clinics' THEN
    IF TG_OP = 'DELETE' THEN
      v_cl := OLD.id;
      v_id := OLD.id::text;
      v_summary := 'clinics · eliminado';
    ELSIF TG_OP = 'UPDATE' THEN
      v_cl := NEW.id;
      v_id := NEW.id::text;
      v_summary := 'clinics · actualizado';
    ELSE
      v_cl := NEW.id;
      v_id := NEW.id::text;
      v_summary := 'clinics · creado';
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_cl := OLD.clinic_id;
      IF v_cl IS NULL THEN
        RETURN OLD;
      END IF;
      v_id := OLD.id::text;
      v_summary := TG_TABLE_NAME || ' · eliminado';
    ELSIF TG_OP = 'UPDATE' THEN
      v_cl := NEW.clinic_id;
      IF v_cl IS NULL THEN
        RETURN NEW;
      END IF;
      v_id := NEW.id::text;
      v_summary := TG_TABLE_NAME || ' · actualizado';
    ELSE
      v_cl := NEW.clinic_id;
      IF v_cl IS NULL THEN
        RETURN NEW;
      END IF;
      v_id := NEW.id::text;
      v_summary := TG_TABLE_NAME || ' · creado';
    END IF;
  END IF;

  INSERT INTO public.audit_log (clinic_id, user_id, action, entity_type, entity_id, summary, metadata)
  VALUES (
    v_cl,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_id,
    v_summary,
    jsonb_build_object('op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_log_row_change() IS 'Trigger genérico: registra insert/update/delete en audit_log con clinic_id en fila (o id en clinics).';

-- Tablas principales
DROP TRIGGER IF EXISTS audit_clients_trg ON public.clients;
CREATE TRIGGER audit_clients_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_finance_entries_trg ON public.finance_entries;
CREATE TRIGGER audit_finance_entries_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_appointments_trg ON public.appointments;
CREATE TRIGGER audit_appointments_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_treatments_trg ON public.treatments;
CREATE TRIGGER audit_treatments_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.treatments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_inventory_trg ON public.inventory;
CREATE TRIGGER audit_inventory_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_user_clinic_memberships_trg ON public.user_clinic_memberships;
CREATE TRIGGER audit_user_clinic_memberships_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.user_clinic_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS audit_clinics_trg ON public.clinics;
CREATE TRIGGER audit_clinics_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_row_change();
