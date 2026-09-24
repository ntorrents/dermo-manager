-- Congela el crédito IVA arrastrable (próxima casilla 110 del M303)
-- cuando se marca un trimestre como presentado en la AEAT.
-- result_amount = Casilla 71; credit_carry_amount = Casilla 87 + |71| si 71 < 0.

ALTER TABLE public.tax_declarations
  ADD COLUMN IF NOT EXISTS credit_carry_amount numeric(12, 2);

COMMENT ON COLUMN public.tax_declarations.credit_carry_amount IS
  'Modelo 303: importe que alimenta la Casilla 110 del trimestre siguiente (87 + |71| si 71 < 0). Inmutable una vez status=completed.';
