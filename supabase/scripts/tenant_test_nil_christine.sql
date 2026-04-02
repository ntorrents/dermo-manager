-- =============================================================================
-- Datos de prueba multi-tenant: Nil (clínica 1) + Christine (clínica 2)
-- Ejecutar en SQL Editor (rol postgres). Revisar bloques antes de lanzar.
-- =============================================================================

-- UUIDs fijos (no editar)
-- Nil          -> 91ac2733-62fb-46f9-9319-a31d8b5ea44f
-- Christine    -> c2d0ae0c-5483-47e0-a382-35f73543143d
-- Clínica 1    -> 00000000-0000-0000-0000-000000000001
-- Clínica 2    -> 6380b7c8-05e0-4e49-861b-ac08323de50e

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Perfiles: asegurar clinic_id correcto (el trigger bloquea cambios sin esto)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_clinic_id_change_trg;

UPDATE public.profiles
SET clinic_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE id = '91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid;

UPDATE public.profiles
SET clinic_id = '6380b7c8-05e0-4e49-861b-ac08323de50e'::uuid
WHERE id = 'c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid;

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_clinic_id_change_trg;

-- -----------------------------------------------------------------------------
-- 2) Membresías: una fila por usuario (prueba de aislamiento “limpio”)
-- -----------------------------------------------------------------------------
DELETE FROM public.user_clinic_memberships
WHERE user_id IN (
  '91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid,
  'c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid
);

INSERT INTO public.user_clinic_memberships (user_id, clinic_id, role)
VALUES
  ('91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid, '6380b7c8-05e0-4e49-861b-ac08323de50e'::uuid, 'admin');

-- -----------------------------------------------------------------------------
-- 3) Quitar filas de prueba anteriores (mismo prefijo de nombre)
-- -----------------------------------------------------------------------------
DELETE FROM public.clients
WHERE name = 'TEST-A-CLINICA1' OR name = 'TEST-B-CLINICA2';

-- -----------------------------------------------------------------------------
-- 4) Clientes de prueba: uno por clínica (evidente en listados)
-- -----------------------------------------------------------------------------
INSERT INTO public.clients (user_id, name, surname, clinic_id)
VALUES
  (
    '91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid,
    'TEST-A-CLINICA1',
    'Solo tenant principal',
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid,
    'TEST-B-CLINICA2',
    'Solo tenant B',
    '6380b7c8-05e0-4e49-861b-ac08323de50e'::uuid
  );

COMMIT;

-- =============================================================================
-- SOLO INSERTS — si perfiles/membresías ya están bien, ejecuta solo esto:
-- (mismo INSERT que el bloque 4, sin transacción envolvente)
-- =============================================================================
-- INSERT INTO public.clients (user_id, name, surname, clinic_id)
-- VALUES
--   ('91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid, 'TEST-A-CLINICA1', 'Solo tenant principal', '00000000-0000-0000-0000-000000000001'::uuid),
--   ('c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid, 'TEST-B-CLINICA2', 'Solo tenant B', '6380b7c8-05e0-4e49-861b-ac08323de50e'::uuid);

-- =============================================================================
-- 5) Verificación como admin (postgres): datos separados por clinic_id
-- =============================================================================
SELECT clinic_id, count(*) AS n
FROM public.clients
GROUP BY clinic_id
ORDER BY clinic_id;

SELECT id, name, surname, clinic_id, user_id
FROM public.clients
WHERE name IN ('TEST-A-CLINICA1', 'TEST-B-CLINICA2')
ORDER BY name;

SELECT id, email, clinic_id
FROM public.profiles
WHERE id IN (
  '91ac2733-62fb-46f9-9319-a31d8b5ea44f'::uuid,
  'c2d0ae0c-5483-47e0-a382-35f73543143d'::uuid
);

-- =============================================================================
-- 6) Simular JWT (puede no aplicar RLS si el rol postgres hace bypass)
--     Si auth.uid() devuelve NULL, prueba RLS en la app con login Nil / Christine.
-- =============================================================================

-- Como Christine: no debería ver filas de clinic_id = 00000000-...
SELECT set_config('request.jwt.claim.sub', 'c2d0ae0c-5483-47e0-a382-35f73543143d', true);
SELECT set_config('role', 'authenticated', true);
SELECT auth.uid() AS soy_christine;
SELECT id, name, clinic_id FROM public.clients ORDER BY name;

-- Como Nil: no debería ver filas de clinic_id = 6380b7c8-...
SELECT set_config('request.jwt.claim.sub', '91ac2733-62fb-46f9-9319-a31d8b5ea44f', true);
SELECT set_config('role', 'authenticated', true);
SELECT auth.uid() AS soy_nil;
SELECT id, name, clinic_id FROM public.clients ORDER BY name;
