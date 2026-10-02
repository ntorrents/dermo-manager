-- Plan Amigo en ventas de catálogo: sin factura / sin serie AEAT.

CREATE OR REPLACE FUNCTION public.sell_catalog_product(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_date date,
  p_client_id uuid DEFAULT NULL,
  p_buyer_name text DEFAULT NULL,
  p_issue_invoice boolean DEFAULT true,
  p_internal_notes text DEFAULT NULL,
  p_plan_amigo boolean DEFAULT false
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
  v_amigo boolean;
BEGIN
  v_clinic := public.current_user_clinic_id();
  v_uid := auth.uid();
  IF v_clinic IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Sin clínica o sesión';
  END IF;

  v_amigo := coalesce(p_plan_amigo, false);

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
      v_buyer := 'Cliente sin ficha';
    END IF;
  END IF;

  v_desc := v_prod.name || ' × ' || trim(to_char(v_qty, 'FM999999990.###')) || ' (' || v_buyer || ')';

  v_invoice := NULL;
  -- Plan Amigo: no consume serie ni genera factura fiscal
  IF NOT v_amigo AND coalesce(p_issue_invoice, true) THEN
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
    nullif(trim(coalesce(p_internal_notes, '')), ''), v_amigo, true
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text, boolean
) TO authenticated;
