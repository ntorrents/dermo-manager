-- Rediseño Gastos Fijos: enlace por UUID, impuestos preconfigurados, pagos multi-mes

-- recurring_config: impuestos por defecto y deducibilidad
ALTER TABLE recurring_config
ADD COLUMN IF NOT EXISTS is_deductible boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 21,
ADD COLUMN IF NOT EXISTS irpf_rate numeric DEFAULT 0;

COMMENT ON COLUMN recurring_config.is_deductible IS 'Si el pago recurrente suele ser factura deducible';
COMMENT ON COLUMN recurring_config.tax_rate IS 'IVA % por defecto (ej: 21, 10, 4, 0)';
COMMENT ON COLUMN recurring_config.irpf_rate IS 'IRPF % por defecto (ej: 0, 7, 15, 19)';

-- finance_entries: enlace al gasto fijo y soporte multi-mes
ALTER TABLE finance_entries
ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES recurring_config(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS months_paid integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS coverage_start_date date;

COMMENT ON COLUMN finance_entries.recurring_id IS 'Gasto fijo que originó este pago (enlace fuerte por UUID)';
COMMENT ON COLUMN finance_entries.months_paid IS 'Meses cubiertos por este pago (ej: 3 = cubre 3 meses desde coverage_start_date o date)';
COMMENT ON COLUMN finance_entries.coverage_start_date IS 'Fecha del primer mes cubierto por el pago (solo fijos; si null se usa date)';

CREATE INDEX IF NOT EXISTS idx_finance_entries_recurring_id ON finance_entries(recurring_id);
