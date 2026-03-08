-- Añade la columna dashboard_widgets al perfil del usuario para persistir
-- el orden y los IDs de los widgets visibles en el dashboard (sincronización entre dispositivos).
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dashboard_widgets JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.dashboard_widgets IS 'Array de IDs de widgets activos en el dashboard, en orden. Ej: ["kpi-facturacion","kpi-impuestos",...]. Máximo 8.';
