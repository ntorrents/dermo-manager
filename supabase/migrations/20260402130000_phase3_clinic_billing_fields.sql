-- Fase 3A — Datos de clínica compartidos para facturación/UI.
-- Mueve los datos “de empresa” al tenant (public.clinics) para que sean comunes
-- a todos los usuarios de la clínica. Editables solo por admin (política RLS).

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS billing_nif text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_phone text,
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.clinics.billing_nif IS 'NIF/CIF del emisor (clínica).';
COMMENT ON COLUMN public.clinics.billing_address IS 'Dirección fiscal del emisor (clínica).';
COMMENT ON COLUMN public.clinics.billing_city IS 'Ciudad/CP del emisor (clínica).';
COMMENT ON COLUMN public.clinics.billing_phone IS 'Teléfono principal del emisor (clínica).';
COMMENT ON COLUMN public.clinics.logo_url IS 'Logo compartido de la clínica.';

-- RLS: permitir UPDATE del registro de su clínica solo a admins.
DROP POLICY IF EXISTS "clinics_update_own_admin" ON public.clinics;
CREATE POLICY "clinics_update_own_admin"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  )
  WITH CHECK (
    id = public.current_user_clinic_id()
    AND public.tenant_role_is_admin()
  );

