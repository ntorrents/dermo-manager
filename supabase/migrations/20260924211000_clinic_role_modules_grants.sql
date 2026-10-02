-- Asegura grants de escritura en clinic_role_modules para políticas superadmin.
GRANT INSERT, UPDATE, DELETE ON TABLE public.clinic_role_modules TO authenticated;
