-- ============================================================
-- DermoManager ERP — Migración facturación, series e IVA
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. FINANCE_ENTRIES: columnas IVA, número factura y notas internas
ALTER TABLE finance_entries
  ADD COLUMN IF NOT EXISTS tax_base numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) DEFAULT 21,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Índice único por usuario + invoice_number para evitar duplicados (solo donde no sea null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_entries_invoice_number_per_user
  ON finance_entries (user_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- 2. Tabla series de facturación (correlativo por año y usuario)
CREATE TABLE IF NOT EXISTS invoice_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  UNIQUE(user_id, year)
);

ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own invoice series" ON invoice_series;
CREATE POLICY "Users manage own invoice series"
  ON invoice_series FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. CLIENTES: NIF, origen, alergias, antecedentes
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS medical_history text;

-- 4. INVENTARIO (opcional): unidad compra vs consumo
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS unit_purchase text DEFAULT 'uds',
  ADD COLUMN IF NOT EXISTS unit_consumption text DEFAULT 'uds';

-- 5. Función atómica para obtener siguiente número de factura (por usuario y año)
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_user_id uuid, p_year int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_series text;
BEGIN
  INSERT INTO invoice_series (user_id, year, last_number)
  VALUES (p_user_id, p_year, 1)
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_number = invoice_series.last_number + 1
  RETURNING last_number INTO v_next;

  v_series := 'F' || p_year || '-' || lpad(v_next::text, 3, '0');
  RETURN v_series;
END;
$$;

-- 6. Backfill opcional: rellenar tax_base/tax_amount en ingresos existentes (IVA 21%)
-- Descomenta y ejecuta si quieres que facturas antiguas tengan desglose:
/*
UPDATE finance_entries
SET
  tax_rate = 21,
  total_amount = amount,
  tax_base = ROUND((amount / 1.21)::numeric, 2),
  tax_amount = amount - ROUND((amount / 1.21)::numeric, 2)
WHERE type = 'income'
  AND (tax_base IS NULL OR tax_amount IS NULL)
  AND amount IS NOT NULL
  AND amount > 0;
*/
