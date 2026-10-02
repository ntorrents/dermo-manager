-- Módulos SaaS más granulares: clientes (historial/docs), facturas, Plan Amigo.
-- Backfill sin romper clínicas existentes. Plan Amigo NO se activa por defecto.

CREATE OR REPLACE FUNCTION public.seed_clinic_role_modules(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_role_modules (clinic_id, role, allowed_modules)
  VALUES
    (
      p_clinic_id,
      'admin',
      ARRAY[
        'agenda_core','google_calendar','clients_crm','clients_history','clients_docs',
        'photo_vault','bonos_manager','legal_signatures','finance_basic','finance_invoices',
        'daily_cash','finance_analytics','finance_plan_amigo','inventory_core',
        'inventory_traceability','suppliers_manager','taxes_aeat','marketing_campaigns',
        'client_followup','custom_email_domain'
      ]::text[]
    ),
    (
      p_clinic_id,
      'staff_medico',
      ARRAY[
        'agenda_core','clients_crm','clients_history','clients_docs','bonos_manager',
        'legal_signatures','photo_vault','inventory_core','inventory_traceability'
      ]::text[]
    ),
    (
      p_clinic_id,
      'recepcion',
      ARRAY[
        'agenda_core','clients_crm','clients_history','bonos_manager','finance_basic',
        'finance_invoices','daily_cash','client_followup'
      ]::text[]
    )
  ON CONFLICT (clinic_id, role) DO NOTHING;
END;
$$;

-- Evitar trigger «solo superadmin» durante el backfill de migración
ALTER TABLE public.clinics DISABLE TRIGGER clinics_protect_saas_columns_trg;

UPDATE public.clinics c
SET active_modules = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(
      coalesce(c.active_modules, ARRAY[]::text[])
      || CASE
           WHEN 'clients_crm' = ANY (coalesce(c.active_modules, ARRAY[]::text[]))
           THEN ARRAY['clients_history','clients_docs']::text[]
           ELSE ARRAY[]::text[]
         END
      || CASE
           WHEN 'finance_basic' = ANY (coalesce(c.active_modules, ARRAY[]::text[]))
           THEN ARRAY['finance_invoices']::text[]
           ELSE ARRAY[]::text[]
         END
    ) AS x
    WHERE x IS NOT NULL AND x <> ''
  )
)
WHERE true;

ALTER TABLE public.clinics ENABLE TRIGGER clinics_protect_saas_columns_trg;

UPDATE public.clinic_role_modules r
SET allowed_modules = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(
      coalesce(r.allowed_modules, ARRAY[]::text[])
      || CASE
           WHEN 'clients_crm' = ANY (coalesce(r.allowed_modules, ARRAY[]::text[]))
           THEN ARRAY['clients_history','clients_docs']::text[]
           ELSE ARRAY[]::text[]
         END
      || CASE
           WHEN 'finance_basic' = ANY (coalesce(r.allowed_modules, ARRAY[]::text[]))
           THEN ARRAY['finance_invoices']::text[]
           ELSE ARRAY[]::text[]
         END
    ) AS x
    WHERE x IS NOT NULL AND x <> ''
  )
)
WHERE true;

ALTER TABLE public.clinics
  ALTER COLUMN active_modules SET DEFAULT ARRAY[
    'agenda_core','clients_crm','clients_history','bonos_manager','legal_signatures',
    'finance_basic','finance_invoices','daily_cash','inventory_core','client_followup'
  ]::text[];
