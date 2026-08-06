-- Soft-delete en inventario (alineado con clients, treatments, finance_entries)

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.inventory.activo IS
  'false = material/máquina archivado; no aparece en listados operativos';

CREATE INDEX IF NOT EXISTS idx_inventory_clinic_activo
  ON public.inventory (clinic_id)
  WHERE activo = true;
