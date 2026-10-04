-- Ledger de movimientos de stock clínico (compras, consumo sesión, ajustes, mermas).
-- Habilita trazabilidad lote → cliente → fecha y regularización sin impacto financiero.

CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  movement_type text NOT NULL
    CONSTRAINT inventory_stock_movements_type_check CHECK (
      movement_type = ANY (ARRAY[
        'purchase'::text,
        'restock'::text,
        'session_consume'::text,
        'sale'::text,
        'adjustment'::text,
        'waste'::text,
        'correction'::text
      ])
    ),
  quantity numeric(14, 4) NOT NULL,
  reason text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  finance_entry_id uuid REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.inventory_stock_movements IS
  'Movimientos de stock (entrada/salida). quantity > 0 entrada; < 0 salida. Ajustes sin finance_entry.';

CREATE INDEX IF NOT EXISTS idx_ism_clinic_date
  ON public.inventory_stock_movements (clinic_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ism_inventory
  ON public.inventory_stock_movements (inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ism_batch
  ON public.inventory_stock_movements (batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ism_client
  ON public.inventory_stock_movements (client_id, occurred_at DESC)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ism_type
  ON public.inventory_stock_movements (clinic_id, movement_type);

ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_ism_select ON public.inventory_stock_movements;
CREATE POLICY tenant_ism_select ON public.inventory_stock_movements
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS tenant_ism_insert ON public.inventory_stock_movements;
CREATE POLICY tenant_ism_insert ON public.inventory_stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS tenant_ism_update ON public.inventory_stock_movements;
CREATE POLICY tenant_ism_update ON public.inventory_stock_movements
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  )
  WITH CHECK (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

DROP POLICY IF EXISTS tenant_ism_delete ON public.inventory_stock_movements;
CREATE POLICY tenant_ism_delete ON public.inventory_stock_movements
  FOR DELETE TO authenticated
  USING (
    clinic_id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

GRANT SELECT, INSERT ON TABLE public.inventory_stock_movements TO authenticated;
GRANT UPDATE, DELETE ON TABLE public.inventory_stock_movements TO authenticated;
GRANT ALL ON TABLE public.inventory_stock_movements TO service_role;
