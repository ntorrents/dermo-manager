-- Bloque 4 (mejora): nombre/identificador + descuentos visibles (original vs aplicado)

ALTER TABLE presupuestos
	ADD COLUMN IF NOT EXISTS nombre text,
	ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'manual' CHECK (discount_mode IN ('manual', 'global_percent')),
	ADD COLUMN IF NOT EXISTS discount_percent numeric;

ALTER TABLE presupuesto_lineas
	ADD COLUMN IF NOT EXISTS original_unit_price_ttc numeric;

COMMENT ON COLUMN presupuestos.nombre IS 'Nombre/identificador interno del presupuesto (ej. \"María - labios + botox\")';
COMMENT ON COLUMN presupuestos.discount_mode IS 'manual = precio aplicado por línea; global_percent = aplicar % global (solo informativo, se guarda ya calculado en unit_price_ttc)';
COMMENT ON COLUMN presupuestos.discount_percent IS 'Porcentaje global aplicado (0-100). Se refleja en PDF como descuento total.';
COMMENT ON COLUMN presupuesto_lineas.original_unit_price_ttc IS 'Precio unitario original (IVA inc.) para mostrar descuento vs aplicado';

