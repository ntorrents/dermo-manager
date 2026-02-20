-- Plan Amigo: ingresos sin factura (familia/amigos, sin registro Verifactu)
-- No consumen número de factura ni se incluyen en exportación fiscal.

ALTER TABLE finance_entries
  ADD COLUMN IF NOT EXISTS plan_amigo boolean DEFAULT false;

COMMENT ON COLUMN finance_entries.plan_amigo IS 'Si true: ingreso por sesión sin factura (Plan Amigo). No cuenta para fiscalidad/303.';

CREATE INDEX IF NOT EXISTS idx_finance_entries_plan_amigo
  ON finance_entries (user_id, plan_amigo)
  WHERE plan_amigo = true;
