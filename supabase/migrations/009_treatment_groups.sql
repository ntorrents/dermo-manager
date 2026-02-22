-- ============================================================
-- Grupos de tratamientos (ej. Mesoterapia: facial, corporal, capilar)
-- ============================================================

CREATE TABLE IF NOT EXISTS treatment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_groups_user
  ON treatment_groups (user_id);

ALTER TABLE treatment_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own treatment_groups" ON treatment_groups;
CREATE POLICY "Users manage own treatment_groups"
  ON treatment_groups FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Añadir group_id a treatments
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES treatment_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatments_group_id
  ON treatments (group_id);

COMMENT ON TABLE treatment_groups IS 'Grupos para agrupar tratamientos (ej. Mesoterapia, Limpiezas)';
COMMENT ON COLUMN treatments.group_id IS 'Grupo al que pertenece el tratamiento; null = sin grupo';
