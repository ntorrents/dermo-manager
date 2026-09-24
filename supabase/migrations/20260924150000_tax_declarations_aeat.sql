-- Fiscalidad AEAT: estados de presentación, tipo withholding 111/115,
-- appointments tax_deadline y bucket tax-declarations.

-- 1) Distinguir retenciones 111 (profesionales) vs 115 (alquiler)
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS withholding_kind text;

ALTER TABLE public.finance_entries
  DROP CONSTRAINT IF EXISTS finance_entries_withholding_kind_check;

ALTER TABLE public.finance_entries
  ADD CONSTRAINT finance_entries_withholding_kind_check
  CHECK (
    withholding_kind IS NULL
    OR withholding_kind = ANY (ARRAY['111'::text, '115'::text])
  );

COMMENT ON COLUMN public.finance_entries.withholding_kind IS
  'Modelo AEAT de retención en gastos: 111 profesionales / 115 alquiler. NULL = sin retención o legacy.';

-- 2) Allow tax_deadline on appointments (excluded from clinical KPIs in app)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_type_check
  CHECK (type = ANY (ARRAY['appointment'::text, 'task'::text, 'tax_deadline'::text]));

COMMENT ON COLUMN public.appointments.type IS
  'appointment | task | tax_deadline (ventana fiscal; no cuenta como cita clínica).';

-- 3) tax_declarations — estado de presentación por modelo/periodo
CREATE TABLE IF NOT EXISTS public.tax_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE RESTRICT,
  model text NOT NULL,
  year integer NOT NULL,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_amount numeric(12, 2),
  presented_at timestamp with time zone,
  presented_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  storage_path text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tax_declarations_model_check
    CHECK (model = ANY (ARRAY['130'::text, '303'::text, '115'::text, '390'::text, '180'::text])),
  CONSTRAINT tax_declarations_period_check
    CHECK (period = ANY (ARRAY['T1'::text, 'T2'::text, 'T3'::text, 'T4'::text, 'ANUAL'::text])),
  CONSTRAINT tax_declarations_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text])),
  CONSTRAINT tax_declarations_unique_period
    UNIQUE (clinic_id, model, year, period)
);

CREATE INDEX IF NOT EXISTS tax_declarations_clinic_year_idx
  ON public.tax_declarations (clinic_id, year);

COMMENT ON TABLE public.tax_declarations IS
  'Estado de presentación AEAT por clínica, modelo y periodo (T1–T4 o ANUAL).';

ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_tax_decl_select" ON public.tax_declarations;
DROP POLICY IF EXISTS "tenant_tax_decl_insert" ON public.tax_declarations;
DROP POLICY IF EXISTS "tenant_tax_decl_update" ON public.tax_declarations;
DROP POLICY IF EXISTS "tenant_tax_decl_delete" ON public.tax_declarations;

CREATE POLICY "tenant_tax_decl_select" ON public.tax_declarations
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_tax_decl_insert" ON public.tax_declarations
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_tax_decl_update" ON public.tax_declarations
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

CREATE POLICY "tenant_tax_decl_delete" ON public.tax_declarations
  FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_declarations TO authenticated;
GRANT ALL ON public.tax_declarations TO service_role;

-- 4) Storage bucket privado para PDFs de declaraciones
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-declarations',
  'tax-declarations',
  false,
  20971520,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path: {user_id}/{clinic_id}/{model}-{year}-{period}.pdf
DROP POLICY IF EXISTS "Users can read own tax declarations" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own tax declarations" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own tax declarations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own tax declarations" ON storage.objects;

CREATE POLICY "Users can read own tax declarations"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tax-declarations'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can upload own tax declarations"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tax-declarations'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can update own tax declarations"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tax-declarations'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'tax-declarations'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can delete own tax declarations"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tax-declarations'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
