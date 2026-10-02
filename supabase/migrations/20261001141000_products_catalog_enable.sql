-- Activar catálogo de productos en clínicas existentes (sin Plan Amigo / extras).
ALTER TABLE public.clinics DISABLE TRIGGER clinics_protect_saas_columns_trg;

UPDATE public.clinics
SET active_modules = array_append(active_modules, 'products_catalog')
WHERE NOT ('products_catalog' = ANY (active_modules));

ALTER TABLE public.clinics ENABLE TRIGGER clinics_protect_saas_columns_trg;

UPDATE public.clinic_role_modules
SET allowed_modules = array_append(allowed_modules, 'products_catalog')
WHERE role IN ('admin', 'recepcion')
  AND NOT ('products_catalog' = ANY (allowed_modules));
