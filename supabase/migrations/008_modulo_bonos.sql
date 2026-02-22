-- ============================================================
-- Módulo Bonos de Sesiones — Plantillas y bonos por cliente
-- ============================================================

-- Tabla 1: Plantillas de bonos (catálogo)
CREATE TABLE IF NOT EXISTS bonus_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  treatment_id uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  default_price numeric(12, 2) NOT NULL CHECK (default_price >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonus_templates_user
  ON bonus_templates (user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_templates_treatment
  ON bonus_templates (treatment_id);

ALTER TABLE bonus_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bonus_templates" ON bonus_templates;
CREATE POLICY "Users manage own bonus_templates"
  ON bonus_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabla 2: Bonos vendidos a clientes
CREATE TABLE IF NOT EXISTS client_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES bonus_templates(id) ON DELETE RESTRICT,
  treatment_id uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  used_sessions integer NOT NULL DEFAULT 0 CHECK (used_sessions >= 0 AND used_sessions <= total_sessions),
  price_paid numeric(12, 2) NOT NULL CHECK (price_paid >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_bonuses_user
  ON client_bonuses (user_id);
CREATE INDEX IF NOT EXISTS idx_client_bonuses_client
  ON client_bonuses (client_id);
CREATE INDEX IF NOT EXISTS idx_client_bonuses_client_treatment_active
  ON client_bonuses (client_id, treatment_id, status)
  WHERE status = 'active';

ALTER TABLE client_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own client_bonuses" ON client_bonuses;
CREATE POLICY "Users manage own client_bonuses"
  ON client_bonuses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE bonus_templates IS 'Plantillas de bonos (ej. 5 sesiones de Bótox)';
COMMENT ON TABLE client_bonuses IS 'Bonos vendidos a clientes; used_sessions se incrementa al consumir en sesión';
