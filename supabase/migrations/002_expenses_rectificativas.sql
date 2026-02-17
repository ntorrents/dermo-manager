-- ============================================================
-- DermoManager — Gastos fiscales (Modelo 303) + Series rectificativas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. TABLA EXPENSES (compras/gastos con datos fiscales completos)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  provider_name text NOT NULL,
  provider_nif text NOT NULL,
  invoice_number text,
  tax_base numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 21,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  category text DEFAULT 'General',
  description text,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own expenses" ON expenses;
CREATE POLICY "Users manage own expenses"
  ON expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Serie para facturas rectificativas (R-2026-001, R-2026-002...)
CREATE TABLE IF NOT EXISTS invoice_series_rectified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  UNIQUE(user_id, year)
);

ALTER TABLE invoice_series_rectified ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own rectified series" ON invoice_series_rectified;
CREATE POLICY "Users manage own rectified series"
  ON invoice_series_rectified FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Función para siguiente número de factura rectificativa
CREATE OR REPLACE FUNCTION get_next_rectified_invoice_number(p_user_id uuid, p_year int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO invoice_series_rectified (user_id, year, last_number)
  VALUES (p_user_id, p_year, 1)
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_number = invoice_series_rectified.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'R-' || p_year || '-' || lpad(v_next::text, 2, '0');
END;
$$;
