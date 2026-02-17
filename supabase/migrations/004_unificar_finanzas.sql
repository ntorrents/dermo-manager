-- ============================================================
-- Unificación financiera: finance_entries con datos fiscales completos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Añadir columnas fiscales a finance_entries (si no existen)
ALTER TABLE finance_entries
  ADD COLUMN IF NOT EXISTS supplier_nif text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS is_deductible boolean DEFAULT false;

-- Comentarios
COMMENT ON COLUMN finance_entries.supplier_nif IS 'NIF/CIF del proveedor (para gastos deducibles)';
COMMENT ON COLUMN finance_entries.file_url IS 'Ruta en bucket recibos de la factura/justificante';
COMMENT ON COLUMN finance_entries.is_deductible IS 'true si es factura deducible (requiere datos fiscales)';

-- Índice para búsquedas rápidas de gastos deducibles
CREATE INDEX IF NOT EXISTS idx_finance_entries_deductible 
  ON finance_entries (user_id, is_deductible, date DESC) 
  WHERE is_deductible = true;
