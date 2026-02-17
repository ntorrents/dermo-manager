-- ============================================================
-- Eliminar índice único de invoice_number
-- Permite múltiples gastos con el mismo número de factura
-- (válido cuando son materiales diferentes de la misma factura)
-- ============================================================

-- Eliminar el índice único que impide múltiples gastos con el mismo número de factura
DROP INDEX IF EXISTS idx_finance_entries_invoice_number_per_user;

-- Crear un índice normal (no único) para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_finance_entries_invoice_number 
  ON finance_entries (user_id, invoice_number) 
  WHERE invoice_number IS NOT NULL;
