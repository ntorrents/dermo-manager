-- IVA por tratamiento (estética 21 % / sanitario exento 0 %)
-- Cliente empresa + retención IRPF en facturas emitidas (B2B)

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) NOT NULL DEFAULT 21;

COMMENT ON COLUMN public.treatments.tax_rate IS
  'IVA % sobre el PVP: 21 estética habitual, 0 exento asistencia sanitaria (art. 20.1.3 LIVA)';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_company boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS irpf_withholding_rate numeric(5, 2) NULL;

COMMENT ON COLUMN public.clients.is_company IS
  'Si true, las facturas emitidas aplican retención IRPF (modelo 111 / crédito en IRPF)';

COMMENT ON COLUMN public.clients.irpf_withholding_rate IS
  'Retención IRPF % en facturas a este cliente (ej. 7 primeros años, 15). NULL = 7 % si is_company';

CREATE INDEX IF NOT EXISTS idx_clients_is_company
  ON public.clients (clinic_id, is_company)
  WHERE is_company = true;
