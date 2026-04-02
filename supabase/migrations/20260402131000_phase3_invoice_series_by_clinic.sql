-- Fase 3B — Serie de facturación por clínica (clinic_id) en vez de por usuario.
-- Mantiene el formato actual: FYYYY-XXX y R-YYYY-XX
-- Garantiza contador único por (clinic_id, year).

-- 1) Consolidar series existentes por clínica/año (evita duplicados al cambiar UNIQUE).
-- Nota: user_id se conserva como auditoría (se elige uno determinista por grupo).

DO $$
BEGIN
  -- invoice_series
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_series'
  ) THEN
    CREATE TEMP TABLE tmp_invoice_series_agg AS
      SELECT
        clinic_id,
        year,
        MAX(last_number) AS last_number,
        (MIN(user_id::text))::uuid AS user_id
      FROM public.invoice_series
      GROUP BY clinic_id, year;

    TRUNCATE TABLE public.invoice_series;

    INSERT INTO public.invoice_series (id, clinic_id, user_id, year, last_number)
    SELECT gen_random_uuid(), clinic_id, user_id, year, last_number
    FROM tmp_invoice_series_agg;

    DROP TABLE tmp_invoice_series_agg;
  END IF;

  -- invoice_series_rectified
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_series_rectified'
  ) THEN
    CREATE TEMP TABLE tmp_invoice_series_rect_agg AS
      SELECT
        clinic_id,
        year,
        MAX(last_number) AS last_number,
        (MIN(user_id::text))::uuid AS user_id
      FROM public.invoice_series_rectified
      GROUP BY clinic_id, year;

    TRUNCATE TABLE public.invoice_series_rectified;

    INSERT INTO public.invoice_series_rectified (id, clinic_id, user_id, year, last_number)
    SELECT gen_random_uuid(), clinic_id, user_id, year, last_number
    FROM tmp_invoice_series_rect_agg;

    DROP TABLE tmp_invoice_series_rect_agg;
  END IF;
END;
$$;

-- 2) Cambiar UNIQUE: de (user_id, year) a (clinic_id, year)
ALTER TABLE public.invoice_series
  DROP CONSTRAINT IF EXISTS invoice_series_user_id_year_key;
ALTER TABLE public.invoice_series
  ADD CONSTRAINT invoice_series_clinic_id_year_key UNIQUE (clinic_id, year);

ALTER TABLE public.invoice_series_rectified
  DROP CONSTRAINT IF EXISTS invoice_series_rectified_user_id_year_key;
ALTER TABLE public.invoice_series_rectified
  ADD CONSTRAINT invoice_series_rectified_clinic_id_year_key UNIQUE (clinic_id, year);

-- 3) Nuevas funciones RPC: siguiente número por clínica
CREATE OR REPLACE FUNCTION public.get_next_invoice_number_by_clinic(p_clinic_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO public.invoice_series (clinic_id, user_id, year, last_number)
  VALUES (p_clinic_id, auth.uid(), p_year, 1)
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
BEGIN
  INSERT INTO public.invoice_series_rectified (clinic_id, user_id, year, last_number)
  VALUES (p_clinic_id, auth.uid(), p_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET last_number = public.invoice_series_rectified.last_number + 1,
                user_id = auth.uid()
  RETURNING last_number INTO v_next;

  RETURN 'R-' || p_year || '-' || lpad(v_next::text, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number_by_clinic(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_rectified_invoice_number_by_clinic(uuid, integer) TO authenticated;

