-- Fase 3C — Backfill: copiar datos “de empresa” desde profiles hacia clinics.
-- Regla: para cada clínica, un perfil determinista por clínica (profiles no tiene created_at:
-- orden por updated_at ascendente, desempate por id).
-- Si clinics.* ya tiene valor, no lo sobreescribe (COALESCE).

-- Nota: depende de que profiles tenga columnas históricas: company_name, nif, address, city, mobile, logo_url.
-- Si algún campo no existe en tu schema, elimina esa asignación.

WITH src AS (
  SELECT DISTINCT ON (p.clinic_id)
    p.clinic_id,
    p.company_name,
    p.nif,
    p.address,
    p.city,
    p.mobile,
    p.logo_url
  FROM public.profiles p
  WHERE p.clinic_id IS NOT NULL
  ORDER BY p.clinic_id, p.updated_at ASC NULLS LAST, p.id ASC
)
UPDATE public.clinics c
SET
  name = COALESCE(c.name, src.company_name),
  billing_nif = COALESCE(c.billing_nif, src.nif),
  billing_address = COALESCE(c.billing_address, src.address),
  billing_city = COALESCE(c.billing_city, src.city),
  billing_phone = COALESCE(c.billing_phone, src.mobile),
  logo_url = COALESCE(c.logo_url, src.logo_url)
FROM src
WHERE c.id = src.clinic_id;

