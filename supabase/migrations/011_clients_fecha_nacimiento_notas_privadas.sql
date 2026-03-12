-- Bloque 1: Historia Clínica – Fecha de nacimiento y notas privadas en clientes
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
ADD COLUMN IF NOT EXISTS notas_privadas text;

COMMENT ON COLUMN clients.fecha_nacimiento IS 'Fecha de nacimiento del cliente (edad se calcula en frontend)';
COMMENT ON COLUMN clients.notas_privadas IS 'Notas privadas de historia clínica, no exportables';
