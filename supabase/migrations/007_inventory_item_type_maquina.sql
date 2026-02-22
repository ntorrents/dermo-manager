-- Tipo de ítem en inventario: material (consumible con stock) o máquina (coste por uso, sin stock)
-- Las máquinas se usan en recetas de tratamientos; el coste (unit_cost) es por sesión/uso.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'material'
  CHECK (item_type IN ('material', 'maquina'));

COMMENT ON COLUMN inventory.item_type IS 'material: consumible con stock y lotes; maquina: coste por uso (unit_cost €/sesión), sin stock.';

CREATE INDEX IF NOT EXISTS idx_inventory_item_type
  ON inventory (user_id, item_type);
