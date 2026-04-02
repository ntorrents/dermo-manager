-- Enriquecer auditoría: resumen con entidad + etiqueta, metadata con cambios campo a campo (UPDATE).

CREATE OR REPLACE FUNCTION public.audit_jsonb_field_changes(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  k text;
  ignore_keys text[] := ARRAY[
    'id'::text,
    'clinic_id'::text,
    'created_at'::text,
    'updated_at'::text
  ];
BEGIN
  IF old_row IS NULL OR new_row IS NULL THEN
    RETURN NULL;
  END IF;
  FOR k IN SELECT jsonb_object_keys(new_row)
  LOOP
    CONTINUE WHEN k = ANY (ignore_keys);
    CONTINUE WHEN (old_row -> k) IS NOT DISTINCT FROM (new_row -> k);
    changes := changes || jsonb_build_object(
      k,
      jsonb_build_object('before', old_row -> k, 'after', new_row -> k)
    );
  END LOOP;
  RETURN NULLIF(changes, '{}'::jsonb);
END;
$$;

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
  v_label text;
  v_summary text;
  v_meta jsonb;
  v_changes jsonb := NULL;
  old_j jsonb;
  new_j jsonb;
BEGIN
  v_action := lower(TG_OP);
  v_meta := jsonb_build_object('op', TG_OP);
  v_changes := NULL;

  IF TG_TABLE_NAME = 'clinics' THEN
    IF TG_OP = 'DELETE' THEN
      v_cl := OLD.id;
      v_id := OLD.id::text;
      v_label := COALESCE(OLD.name, OLD.id::text);
      v_summary := 'Clínica · ' || v_label || ' · baja';
      v_meta := v_meta || jsonb_build_object('label', v_label);
    ELSIF TG_OP = 'UPDATE' THEN
      v_cl := NEW.id;
      v_id := NEW.id::text;
      v_label := COALESCE(NEW.name, NEW.id::text);
      old_j := to_jsonb(OLD);
      new_j := to_jsonb(NEW);
      v_changes := public.audit_jsonb_field_changes(old_j, new_j);
      v_meta := v_meta || jsonb_build_object('label', v_label);
      IF v_changes IS NOT NULL THEN
        v_meta := v_meta || jsonb_build_object('changes', v_changes);
      END IF;
      v_summary := 'Clínica · ' || v_label || ' · cambios';
    ELSE
      v_cl := NEW.id;
      v_id := NEW.id::text;
      v_label := COALESCE(NEW.name, NEW.id::text);
      v_summary := 'Clínica · ' || v_label || ' · alta';
      v_meta := v_meta || jsonb_build_object('label', v_label);
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_cl := OLD.clinic_id;
      IF v_cl IS NULL THEN
        RETURN OLD;
      END IF;
      v_id := OLD.id::text;
      CASE TG_TABLE_NAME
        WHEN 'clients' THEN
          v_label := trim(both FROM concat_ws(' ', COALESCE(OLD.name, ''), COALESCE(OLD.surname, '')));
        WHEN 'treatments' THEN v_label := COALESCE(OLD.name, OLD.id::text);
        WHEN 'inventory' THEN v_label := COALESCE(OLD.name, OLD.id::text);
        WHEN 'appointments' THEN
          v_label := left(COALESCE(OLD.title, OLD.notes, OLD.id::text), 80);
        WHEN 'finance_entries' THEN
          v_label := left(COALESCE(OLD.description, OLD.category, 'Movimiento'), 80);
        WHEN 'user_clinic_memberships' THEN
          v_label := COALESCE(OLD.user_id::text, '') || ' · rol ' || COALESCE(OLD.role, '');
        ELSE v_label := TG_TABLE_NAME || ' ' || OLD.id::text;
      END CASE;
      IF v_label IS NULL OR v_label = '' THEN
        v_label := v_id;
      END IF;
      v_summary :=
        CASE TG_TABLE_NAME
          WHEN 'clients' THEN 'Cliente'
          WHEN 'treatments' THEN 'Tratamiento'
          WHEN 'inventory' THEN 'Stock'
          WHEN 'appointments' THEN 'Cita'
          WHEN 'finance_entries' THEN 'Movimiento'
          WHEN 'user_clinic_memberships' THEN 'Equipo'
          ELSE TG_TABLE_NAME
        END || ' · ' || v_label || ' · baja';
      v_meta := v_meta || jsonb_build_object('label', v_label);
    ELSIF TG_OP = 'UPDATE' THEN
      v_cl := NEW.clinic_id;
      IF v_cl IS NULL THEN
        RETURN NEW;
      END IF;
      v_id := NEW.id::text;
      CASE TG_TABLE_NAME
        WHEN 'clients' THEN
          v_label := trim(both FROM concat_ws(' ', COALESCE(NEW.name, OLD.name, ''), COALESCE(NEW.surname, OLD.surname, '')));
        WHEN 'treatments' THEN v_label := COALESCE(NEW.name, OLD.name, NEW.id::text);
        WHEN 'inventory' THEN v_label := COALESCE(NEW.name, OLD.name, NEW.id::text);
        WHEN 'appointments' THEN
          v_label := left(COALESCE(NEW.title, OLD.title, NEW.notes, OLD.notes, NEW.id::text), 80);
        WHEN 'finance_entries' THEN
          v_label := left(COALESCE(NEW.description, OLD.description, NEW.category, OLD.category, 'Movimiento'), 80);
        WHEN 'user_clinic_memberships' THEN
          v_label := COALESCE(NEW.user_id::text, OLD.user_id::text, '') || ' · rol ' || COALESCE(NEW.role, OLD.role);
        ELSE v_label := TG_TABLE_NAME || ' ' || NEW.id::text;
      END CASE;
      IF v_label IS NULL OR v_label = '' THEN
        v_label := v_id;
      END IF;
      old_j := to_jsonb(OLD);
      new_j := to_jsonb(NEW);
      v_changes := public.audit_jsonb_field_changes(old_j, new_j);
      v_meta := v_meta || jsonb_build_object('label', v_label);
      IF v_changes IS NOT NULL THEN
        v_meta := v_meta || jsonb_build_object('changes', v_changes);
      END IF;
      v_summary :=
        CASE TG_TABLE_NAME
          WHEN 'clients' THEN 'Cliente'
          WHEN 'treatments' THEN 'Tratamiento'
          WHEN 'inventory' THEN 'Stock'
          WHEN 'appointments' THEN 'Cita'
          WHEN 'finance_entries' THEN 'Movimiento'
          WHEN 'user_clinic_memberships' THEN 'Equipo'
          ELSE TG_TABLE_NAME
        END || ' · ' || v_label || ' · cambios';
    ELSE
      v_cl := NEW.clinic_id;
      IF v_cl IS NULL THEN
        RETURN NEW;
      END IF;
      v_id := NEW.id::text;
      CASE TG_TABLE_NAME
        WHEN 'clients' THEN
          v_label := trim(both FROM concat_ws(' ', COALESCE(NEW.name, ''), COALESCE(NEW.surname, '')));
        WHEN 'treatments' THEN v_label := COALESCE(NEW.name, NEW.id::text);
        WHEN 'inventory' THEN v_label := COALESCE(NEW.name, NEW.id::text);
        WHEN 'appointments' THEN
          v_label := left(COALESCE(NEW.title, NEW.notes, NEW.id::text), 80);
        WHEN 'finance_entries' THEN
          v_label := left(COALESCE(NEW.description, NEW.category, 'Movimiento'), 80);
        WHEN 'user_clinic_memberships' THEN
          v_label := COALESCE(NEW.user_id::text, '') || ' · rol ' || COALESCE(NEW.role, '');
        ELSE v_label := TG_TABLE_NAME || ' ' || NEW.id::text;
      END CASE;
      IF v_label IS NULL OR v_label = '' THEN
        v_label := v_id;
      END IF;
      v_summary :=
        CASE TG_TABLE_NAME
          WHEN 'clients' THEN 'Cliente'
          WHEN 'treatments' THEN 'Tratamiento'
          WHEN 'inventory' THEN 'Stock'
          WHEN 'appointments' THEN 'Cita'
          WHEN 'finance_entries' THEN 'Movimiento'
          WHEN 'user_clinic_memberships' THEN 'Equipo'
          ELSE TG_TABLE_NAME
        END || ' · ' || v_label || ' · alta';
      v_meta := v_meta || jsonb_build_object('label', v_label);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND (v_changes IS NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (clinic_id, user_id, action, entity_type, entity_id, summary, metadata)
  VALUES (
    v_cl,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_id,
    v_summary,
    v_meta
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_log_row_change() IS 'Auditoría con etiqueta de registro y diff JSON en UPDATE.';
