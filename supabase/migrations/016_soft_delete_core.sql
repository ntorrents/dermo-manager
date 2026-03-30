-- Bloque 6: borrado lógico en tablas principales
ALTER TABLE clients ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN clients.activo IS 'false = archivado; no mostrar en UI habitual';
COMMENT ON COLUMN treatments.activo IS 'false = archivado';
COMMENT ON COLUMN appointments.activo IS 'false = archivada / cancelada lógica';
COMMENT ON COLUMN finance_entries.activo IS 'false = movimiento archivado';

CREATE INDEX IF NOT EXISTS idx_clients_user_activo ON clients(user_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_treatments_user_activo ON treatments(user_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_appointments_user_activo ON appointments(user_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_activo ON finance_entries(user_id) WHERE activo = true;
