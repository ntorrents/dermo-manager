-- Permitir ignorar declaraciones AEAT (p. ej. trimestre sin actividad).

ALTER TABLE public.tax_declarations
  DROP CONSTRAINT IF EXISTS tax_declarations_status_check;

ALTER TABLE public.tax_declarations
  ADD CONSTRAINT tax_declarations_status_check
  CHECK (
    status = ANY (ARRAY['pending'::text, 'completed'::text, 'ignored'::text])
  );

COMMENT ON COLUMN public.tax_declarations.status IS
  'pending | completed | ignored (no avisar; p. ej. baja temporal sin actividad).';
