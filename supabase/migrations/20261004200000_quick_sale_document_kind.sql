-- TPV / Venta rápida: Ticket (factura simplificada) vs Factura completa.
-- Serie de tickets TYYYY-NNN + document_kind en finance_entries + RPC carrito atómico.

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS document_kind text;

ALTER TABLE public.finance_entries
  DROP CONSTRAINT IF EXISTS finance_entries_document_kind_check;

ALTER TABLE public.finance_entries
  ADD CONSTRAINT finance_entries_document_kind_check
  CHECK (
    document_kind IS NULL
    OR document_kind IN ('ticket', 'factura')
  );

COMMENT ON COLUMN public.finance_entries.document_kind IS
  'ticket = factura simplificada (mostrador); factura = factura completa con paciente.';

-- Serie correlativa de tickets (paralela a invoice_series F…)
CREATE TABLE IF NOT EXISTS public.invoice_series_ticket (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, year)
);

ALTER TABLE public.invoice_series_ticket ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_ticket_series_select" ON public.invoice_series_ticket;
CREATE POLICY "tenant_ticket_series_select"
  ON public.invoice_series_ticket FOR SELECT TO authenticated
  USING (clinic_id = public.current_user_clinic_id());

CREATE OR REPLACE FUNCTION public.get_next_ticket_number_by_clinic(
  p_clinic_id uuid,
  p_year integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  IF p_clinic_id IS NULL OR p_clinic_id IS DISTINCT FROM public.current_user_clinic_id() THEN
    RAISE EXCEPTION 'Clínica no autorizada';
  END IF;

  INSERT INTO public.invoice_series_ticket (clinic_id, user_id, year, last_number)
  VALUES (p_clinic_id, auth.uid(), p_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET
    last_number = public.invoice_series_ticket.last_number + 1,
    user_id = auth.uid()
  RETURNING last_number INTO v_next;

  RETURN 'T' || p_year || '-' || lpad(v_next::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_ticket_number_by_clinic(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_ticket_number_by_clinic(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_ticket_number_by_clinic(uuid, integer) TO service_role;

-- Sustituye sobrecargas previas (9 args) por la firma con document_kind
DROP FUNCTION IF EXISTS public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text, boolean
);
DROP FUNCTION IF EXISTS public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text
);

-- Venta de un producto: admite document_kind (compat. con catálogo)
CREATE OR REPLACE FUNCTION public.sell_catalog_product(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_date date,
  p_client_id uuid DEFAULT NULL,
  p_buyer_name text DEFAULT NULL,
  p_issue_invoice boolean DEFAULT true,
  p_internal_notes text DEFAULT NULL,
  p_plan_amigo boolean DEFAULT false,
  p_document_kind text DEFAULT NULL
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
  v_kind text;
BEGIN
  v_clinic := public.current_user_clinic_id();
  v_uid := auth.uid();
  IF v_clinic IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Sin clínica o sesión';
  END IF;

  v_amigo := coalesce(p_plan_amigo, false);

  v_kind := lower(nullif(trim(coalesce(p_document_kind, '')), ''));
  IF v_kind IS NULL THEN
    IF v_amigo THEN
      v_kind := NULL;
    ELSIF p_client_id IS NOT NULL THEN
      v_kind := 'factura';
    ELSE
      v_kind := 'ticket';
    END IF;
  END IF;
  IF v_kind IS NOT NULL AND v_kind NOT IN ('ticket', 'factura') THEN
    RAISE EXCEPTION 'document_kind inválido';
  END IF;
  IF v_kind = 'factura' AND p_client_id IS NULL AND NOT v_amigo THEN
    RAISE EXCEPTION 'La factura completa requiere un paciente';
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
      v_buyer := 'Mostrador';
    END IF;
  END IF;

  v_desc := v_prod.name || ' × ' || trim(to_char(v_qty, 'FM999999990.###')) || ' (' || v_buyer || ')';

  v_invoice := NULL;
  IF NOT v_amigo AND coalesce(p_issue_invoice, true) THEN
    BEGIN
      IF v_kind = 'ticket' THEN
        v_invoice := public.get_next_ticket_number_by_clinic(
          v_clinic,
          extract(year from p_date)::int
        );
      ELSE
        v_invoice := public.get_next_invoice_number_by_clinic(
          v_clinic,
          extract(year from p_date)::int
        );
      END IF;
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
    internal_notes, plan_amigo, activo, document_kind
  ) VALUES (
    v_uid, v_clinic, p_date, 'income', 'Producto', v_desc,
    v_total, v_total, v_tax_rate, v_tax_base, v_tax_amount,
    v_invoice, p_client_id, CASE WHEN p_client_id IS NULL THEN v_buyer ELSE NULL END,
    v_prod.id, v_qty,
    nullif(trim(coalesce(p_internal_notes, '')), ''), v_amigo, true, v_kind
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text, boolean, text
) TO authenticated;

-- Carrito TPV: varias líneas, un solo correlativo, stock + caja atómicos
CREATE OR REPLACE FUNCTION public.sell_catalog_cart(
  p_lines jsonb,
  p_date date,
  p_client_id uuid DEFAULT NULL,
  p_buyer_name text DEFAULT NULL,
  p_document_kind text DEFAULT 'ticket',
  p_internal_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_uid uuid;
  v_kind text;
  v_buyer text;
  v_invoice text;
  v_line jsonb;
  v_prod public.products%ROWTYPE;
  v_qty numeric;
  v_price numeric;
  v_tax_rate numeric;
  v_tax_base numeric;
  v_tax_amount numeric;
  v_total numeric;
  v_desc text;
  v_entry_id uuid;
  v_entry_ids uuid[] := ARRAY[]::uuid[];
  v_idx int := 0;
BEGIN
  v_clinic := public.current_user_clinic_id();
  v_uid := auth.uid();
  IF v_clinic IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Sin clínica o sesión';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío';
  END IF;

  v_kind := lower(nullif(trim(coalesce(p_document_kind, 'ticket')), ''));
  IF v_kind NOT IN ('ticket', 'factura') THEN
    RAISE EXCEPTION 'document_kind inválido (ticket|factura)';
  END IF;

  IF v_kind = 'factura' THEN
    IF p_client_id IS NULL THEN
      RAISE EXCEPTION 'La factura completa requiere un paciente';
    END IF;
  END IF;

  IF p_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id AND c.clinic_id = v_clinic AND coalesce(c.activo, true) = true
    ) THEN
      RAISE EXCEPTION 'Cliente no válido';
    END IF;
    SELECT trim(both from coalesce(c.name, '') || ' ' || coalesce(c.surname, ''))
      INTO v_buyer
    FROM public.clients c WHERE c.id = p_client_id;
  ELSE
    v_buyer := nullif(trim(coalesce(p_buyer_name, '')), '');
    IF v_buyer IS NULL THEN
      v_buyer := 'Mostrador';
    END IF;
  END IF;

  BEGIN
    IF v_kind = 'ticket' THEN
      v_invoice := public.get_next_ticket_number_by_clinic(
        v_clinic,
        extract(year from p_date)::int
      );
    ELSE
      v_invoice := public.get_next_invoice_number_by_clinic(
        v_clinic,
        extract(year from p_date)::int
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_invoice := NULL;
  END;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_idx := v_idx + 1;
    v_qty := coalesce((v_line->>'quantity')::numeric, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en la línea %', v_idx;
    END IF;

    SELECT * INTO v_prod
    FROM public.products
    WHERE id = (v_line->>'product_id')::uuid
      AND clinic_id = v_clinic
      AND activo = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado (línea %)', v_idx;
    END IF;

    IF v_prod.stock_qty < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente de «%» (disponible: %)', v_prod.name, v_prod.stock_qty;
    END IF;

    v_price := coalesce((v_line->>'unit_price')::numeric, v_prod.price);
    IF v_price < 0 THEN
      RAISE EXCEPTION 'Precio inválido en «%»', v_prod.name;
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

    v_desc := v_prod.name || ' × ' || trim(to_char(v_qty, 'FM999999990.###')) || ' (' || v_buyer || ')';

    UPDATE public.products
    SET stock_qty = stock_qty - v_qty,
        updated_at = now()
    WHERE id = v_prod.id;

    INSERT INTO public.finance_entries (
      user_id, clinic_id, date, type, category, description,
      amount, total_amount, tax_rate, tax_base, tax_amount,
      invoice_number, client_id, buyer_name, product_id, quantity,
      internal_notes, plan_amigo, activo, document_kind
    ) VALUES (
      v_uid, v_clinic, p_date, 'income', 'Producto', v_desc,
      v_total, v_total, v_tax_rate, v_tax_base, v_tax_amount,
      v_invoice, p_client_id, CASE WHEN p_client_id IS NULL THEN v_buyer ELSE NULL END,
      v_prod.id, v_qty,
      nullif(trim(coalesce(p_internal_notes, '')), ''), false, true, v_kind
    )
    RETURNING id INTO v_entry_id;

    v_entry_ids := array_append(v_entry_ids, v_entry_id);
  END LOOP;

  RETURN jsonb_build_object(
    'document_kind', v_kind,
    'invoice_number', v_invoice,
    'entry_ids', to_jsonb(v_entry_ids),
    'buyer', v_buyer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sell_catalog_cart(jsonb, date, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_catalog_cart(jsonb, date, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_catalog_cart(jsonb, date, uuid, text, text, text) TO service_role;
