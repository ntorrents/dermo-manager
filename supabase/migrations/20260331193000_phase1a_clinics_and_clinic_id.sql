-- Fase 1A — Tenants: tabla clinics, clinic_id en tablas operativas, backfill y restricciones.
-- UUID fijo para la clínica “legado” (single-tenant → multi-tenant sin romper datos existentes).
-- La app puede seguir sin enviar clinic_id en INSERT gracias al DEFAULT.

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'integral'
    CONSTRAINT clinics_subscription_tier_check CHECK (
      subscription_tier = ANY (ARRAY['basic'::text, 'clinic'::text, 'integral'::text])
    ),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinics IS 'Tenant (clínica). Datos existentes se asocian inicialmente a la clínica por defecto.';
COMMENT ON COLUMN public.clinics.subscription_tier IS 'Plan comercial; se usará en Fase 2 para feature gating.';

INSERT INTO public.clinics (id, name, subscription_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Clínica principal',
  'integral'
)
ON CONFLICT (id) DO NOTHING;

-- Perfil: membresía en clínica (una fila por usuario en esta fase).
ALTER TABLE public.profiles
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;

UPDATE public.profiles
SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE clinic_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;

-- Tablas con user_id u operación por clínica.
ALTER TABLE public.appointments
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.bonus_templates
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.client_bonuses
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.clients
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.expenses
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.finance_entries
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.inventory
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_batches
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.invoice_series
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.invoice_series_rectified
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.plantillas_consentimiento
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.presupuesto_lineas
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.presupuestos
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.recurring_config
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.seguimientos_cliente
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.session_photos
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.signed_consents
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.treatment_groups
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;
ALTER TABLE public.treatments
  ADD COLUMN clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;

UPDATE public.appointments SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.bonus_templates SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.client_bonuses SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.clients SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.expenses SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.finance_entries SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.inventory SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.invoice_series SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.invoice_series_rectified SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.plantillas_consentimiento SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.presupuestos SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.recurring_config SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.seguimientos_cliente SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.session_photos SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.signed_consents SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.treatment_groups SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;
UPDATE public.treatments SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE clinic_id IS NULL;

UPDATE public.inventory_batches ib
SET clinic_id = i.clinic_id
FROM public.inventory i
WHERE ib.inventory_id = i.id AND ib.clinic_id IS NULL;

UPDATE public.presupuesto_lineas pl
SET clinic_id = p.clinic_id
FROM public.presupuestos p
WHERE pl.presupuesto_id = p.id AND pl.clinic_id IS NULL;

-- DEFAULT + NOT NULL: compatibilidad con INSERT actuales sin clinic_id en el cliente.
ALTER TABLE public.appointments
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.bonus_templates
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.client_bonuses
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.clients
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.expenses
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.finance_entries
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.inventory
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.inventory_batches
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.invoice_series
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.invoice_series_rectified
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.plantillas_consentimiento
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.presupuesto_lineas
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.presupuestos
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.recurring_config
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.seguimientos_cliente
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.session_photos
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.signed_consents
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.treatment_groups
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.treatments
  ALTER COLUMN clinic_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ALTER COLUMN clinic_id SET NOT NULL;

CREATE INDEX idx_profiles_clinic_id ON public.profiles USING btree (clinic_id);
CREATE INDEX idx_appointments_clinic_id ON public.appointments USING btree (clinic_id);
CREATE INDEX idx_bonus_templates_clinic_id ON public.bonus_templates USING btree (clinic_id);
CREATE INDEX idx_client_bonuses_clinic_id ON public.client_bonuses USING btree (clinic_id);
CREATE INDEX idx_clients_clinic_id ON public.clients USING btree (clinic_id);
CREATE INDEX idx_clients_clinic_activo ON public.clients USING btree (clinic_id) WHERE (activo = true);
CREATE INDEX idx_expenses_clinic_id ON public.expenses USING btree (clinic_id);
CREATE INDEX idx_finance_entries_clinic_id ON public.finance_entries USING btree (clinic_id);
CREATE INDEX idx_inventory_clinic_id ON public.inventory USING btree (clinic_id);
CREATE INDEX idx_inventory_batches_clinic_id ON public.inventory_batches USING btree (clinic_id);
CREATE INDEX idx_invoice_series_clinic_id ON public.invoice_series USING btree (clinic_id);
CREATE INDEX idx_invoice_series_rectified_clinic_id ON public.invoice_series_rectified USING btree (clinic_id);
CREATE INDEX idx_plantillas_consentimiento_clinic_id ON public.plantillas_consentimiento USING btree (clinic_id);
CREATE INDEX idx_presupuesto_lineas_clinic_id ON public.presupuesto_lineas USING btree (clinic_id);
CREATE INDEX idx_presupuestos_clinic_id ON public.presupuestos USING btree (clinic_id);
CREATE INDEX idx_recurring_config_clinic_id ON public.recurring_config USING btree (clinic_id);
CREATE INDEX idx_seguimientos_cliente_clinic_id ON public.seguimientos_cliente USING btree (clinic_id);
CREATE INDEX idx_session_photos_clinic_id ON public.session_photos USING btree (clinic_id);
CREATE INDEX idx_signed_consents_clinic_id ON public.signed_consents USING btree (clinic_id);
CREATE INDEX idx_treatment_groups_clinic_id ON public.treatment_groups USING btree (clinic_id);
CREATE INDEX idx_treatments_clinic_id ON public.treatments USING btree (clinic_id);

-- Nuevos registros reciben la clínica por defecto desde el trigger de auth.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, company_name, clinic_id)
  VALUES (
    new.id,
    new.email,
    'Usuario Nuevo',
    'Mi Empresa',
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  RETURN new;
END;
$$;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinics_select_own"
  ON public.clinics
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT p.clinic_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.clinics TO authenticated;
GRANT ALL ON TABLE public.clinics TO service_role;
