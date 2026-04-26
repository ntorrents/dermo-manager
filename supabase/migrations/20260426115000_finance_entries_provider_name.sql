-- Directorio de proveedores en gastos deducibles
ALTER TABLE public.finance_entries
ADD COLUMN IF NOT EXISTS provider_name text;

COMMENT ON COLUMN public.finance_entries.provider_name IS
'Nombre comercial del proveedor para autocompletar y listado de proveedores.';

CREATE INDEX IF NOT EXISTS idx_finance_entries_provider_name
ON public.finance_entries (clinic_id, provider_name)
WHERE provider_name IS NOT NULL;
