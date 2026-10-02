-- Evitar overload antiguo sin Plan Amigo (PostgREST ambigüedad).

DROP FUNCTION IF EXISTS public.sell_catalog_product(
  uuid, numeric, numeric, date, uuid, text, boolean, text
);
