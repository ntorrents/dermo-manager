-- Bienes de inversión amortizables en fiscalidad IRPF
ALTER TABLE public.finance_entries
ADD COLUMN IF NOT EXISTS is_investment boolean NOT NULL DEFAULT false;

ALTER TABLE public.finance_entries
ADD COLUMN IF NOT EXISTS amortization_rate numeric;

COMMENT ON COLUMN public.finance_entries.is_investment IS
'true si el gasto deducible corresponde a un bien de inversión amortizable.';

COMMENT ON COLUMN public.finance_entries.amortization_rate IS
'Porcentaje anual de amortización del bien (ej: 26).';

CREATE INDEX IF NOT EXISTS idx_finance_entries_investment
ON public.finance_entries (clinic_id, is_investment, date)
WHERE is_investment = true;
