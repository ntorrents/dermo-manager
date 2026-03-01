-- Añade soporte de retenciones IRPF a finance_entries (cálculo inverso Gross-to-Net)
ALTER TABLE finance_entries
ADD COLUMN IF NOT EXISTS irpf_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS irpf_amount numeric DEFAULT 0;

COMMENT ON COLUMN finance_entries.irpf_rate IS 'Porcentaje de retención IRPF aplicado (ej: 0, 7, 15, 19)';
COMMENT ON COLUMN finance_entries.irpf_amount IS 'Cuota de retención IRPF (Modelo 111/115)';
