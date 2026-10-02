-- Catálogo de productos (stock propio, independiente del inventario clínico).

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) NOT NULL DEFAULT 21,
  stock_qty numeric(12, 3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'ud',
  image_url text,
  image_path text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_price_nonneg CHECK (price >= 0),
  CONSTRAINT products_stock_nonneg CHECK (stock_qty >= 0),
  CONSTRAINT products_tax_rate_check CHECK (tax_rate >= 0 AND tax_rate <= 100)
);

CREATE INDEX IF NOT EXISTS idx_products_clinic_activo
  ON public.products (clinic_id, activo);

COMMENT ON TABLE public.products IS
  'Catálogo comercial de productos (stock propio; no usa inventory).';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_user_clinic_id())
  WITH CHECK (clinic_id = public.current_user_clinic_id());

DROP POLICY IF EXISTS products_delete ON public.products;
CREATE POLICY products_delete ON public.products
  FOR DELETE TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;

-- Campos en finanzas para ventas de producto / comprador anónimo
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products (id) ON DELETE SET NULL;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS buyer_name text;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS quantity numeric(12, 3);

COMMENT ON COLUMN public.finance_entries.product_id IS
  'Venta de catálogo de productos (si aplica).';
COMMENT ON COLUMN public.finance_entries.buyer_name IS
  'Nombre del comprador cuando no hay client_id (venta anónima / walk-in).';
COMMENT ON COLUMN public.finance_entries.quantity IS
  'Cantidad vendida (productos); NULL en ingresos de sesión clásicos.';

CREATE INDEX IF NOT EXISTS idx_finance_entries_product
  ON public.finance_entries (clinic_id, product_id)
  WHERE product_id IS NOT NULL;

-- Bucket imágenes de producto (público, como company-assets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;
CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Venta atómica: descuenta stock + inserta ingreso
CREATE OR REPLACE FUNCTION public.sell_catalog_product(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_date date,
  p_client_id uuid DEFAULT NULL,
  p_buyer_name text DEFAULT NULL,
  p_issue_invoice boolean DEFAULT true,
  p_internal_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_uid uuid;
  v_prod public.products%ROWTYPE;
  v_qty numeric;
  v_price numeric;
  v_tax_rate numeric;
  v_tax_base numeric;
  v_tax_amount numeric;
  v_total numeric;
  v_buyer text;
  v_invoice text;
  v_entry_id uuid;
  v_desc text;
BEGIN
  v_clinic := public.current_user_clinic_id();
  v_uid := auth.uid();
  IF v_clinic IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Sin clínica o sesión';
  END IF;

  v_qty := coalesce(p_quantity, 0);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT * INTO v_prod
  FROM public.products
  WHERE id = p_product_id AND clinic_id = v_clinic AND activo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_prod.stock_qty < v_qty THEN
    RAISE EXCEPTION 'Stock insuficiente (disponible: %)', v_prod.stock_qty;
  END IF;

  v_price := coalesce(p_unit_price, v_prod.price);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'Precio inválido';
  END IF;

  v_tax_rate := coalesce(v_prod.tax_rate, 21);
  -- PVP unitario con IVA → base y cuota sobre el total de la línea
  v_total := round((v_price * v_qty)::numeric, 2);
  IF v_tax_rate > 0 THEN
    v_tax_base := round(v_total / (1 + v_tax_rate / 100), 2);
    v_tax_amount := round(v_total - v_tax_base, 2);
  ELSE
    v_tax_base := v_total;
    v_tax_amount := 0;
  END IF;

  IF p_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id AND c.clinic_id = v_clinic
    ) THEN
      RAISE EXCEPTION 'Cliente no válido';
    END IF;
    SELECT trim(both from coalesce(c.name, '') || ' ' || coalesce(c.surname, ''))
      INTO v_buyer
    FROM public.clients c WHERE c.id = p_client_id;
  ELSE
    v_buyer := nullif(trim(coalesce(p_buyer_name, '')), '');
    IF v_buyer IS NULL THEN
      v_buyer := 'Cliente anónimo';
    END IF;
  END IF;

  v_desc := v_prod.name || ' × ' || trim(to_char(v_qty, 'FM999999990.###')) || ' (' || v_buyer || ')';

  v_invoice := NULL;
  IF p_issue_invoice THEN
    BEGIN
      v_invoice := public.get_next_invoice_number_by_clinic(
        v_clinic,
        extract(year from p_date)::int
      );
    EXCEPTION WHEN OTHERS THEN
      v_invoice := NULL;
    END;
  END IF;

  UPDATE public.products
  SET stock_qty = stock_qty - v_qty,
      updated_at = now()
  WHERE id = v_prod.id;

  INSERT INTO public.finance_entries (
    user_id, clinic_id, date, type, category, description,
    amount, total_amount, tax_rate, tax_base, tax_amount,
    invoice_number, client_id, buyer_name, product_id, quantity,
    internal_notes, plan_amigo, activo
  ) VALUES (
    v_uid, v_clinic, p_date, 'income', 'Producto', v_desc,
    v_total, v_total, v_tax_rate, v_tax_base, v_tax_amount,
    v_invoice, p_client_id, CASE WHEN p_client_id IS NULL THEN v_buyer ELSE NULL END,
    v_prod.id, v_qty,
    nullif(trim(coalesce(p_internal_notes, '')), ''), false, true
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text
) TO authenticated;
