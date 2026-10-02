-- Coste medio por unidad en catálogo de productos (margen sobre PVP).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_cost_nonneg;

ALTER TABLE public.products
  ADD CONSTRAINT products_unit_cost_nonneg CHECK (unit_cost >= 0);

COMMENT ON COLUMN public.products.unit_cost IS
  'Coste medio ponderado por unidad (compra). 0 = regalado / sin coste.';
