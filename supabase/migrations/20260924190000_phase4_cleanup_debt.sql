-- Fase 4 limpieza deuda técnica SaaS / fiscal.
-- 1) DROP tabla expenses (sustituida por finance_entries)
-- 2) DROP finance_entries.is_automatic
-- 3) Conservar tax_declarations.notes
-- 4) Migrar clients.dni → nif y DROP dni
-- 5) DROP profiles.theme_color

-- ---------------------------------------------------------------------------
-- 1) expenses
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.expenses CASCADE;

-- ---------------------------------------------------------------------------
-- 2) finance_entries.is_automatic
-- ---------------------------------------------------------------------------
ALTER TABLE public.finance_entries
  DROP COLUMN IF EXISTS is_automatic;

-- ---------------------------------------------------------------------------
-- 4) clients.dni → nif, luego DROP dni
-- ---------------------------------------------------------------------------
UPDATE public.clients
SET nif = dni
WHERE (nif IS NULL OR btrim(nif) = '')
  AND dni IS NOT NULL
  AND btrim(dni) <> '';

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS dni;

-- ---------------------------------------------------------------------------
-- 5) profiles.theme_color
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS theme_color;
