-- Bloque 2: Plantillas de consentimiento informado vinculadas a tratamientos
CREATE TABLE IF NOT EXISTS plantillas_consentimiento (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
	nombre text NOT NULL,
	contenido text NOT NULL DEFAULT '',
	created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE plantillas_consentimiento IS 'Plantillas de texto para consentimientos informados por tratamiento';
COMMENT ON COLUMN plantillas_consentimiento.treatment_id IS 'Tratamiento asociado; NULL = plantilla genérica';
COMMENT ON COLUMN plantillas_consentimiento.contenido IS 'Texto con variables {{NOMBRE}}, {{APELLIDOS}}, {{DNI}}, {{TRATAMIENTO}}, {{FECHA}}';

CREATE INDEX IF NOT EXISTS idx_plantillas_consentimiento_user_id ON plantillas_consentimiento(user_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_consentimiento_treatment_id ON plantillas_consentimiento(treatment_id);

-- RLS (opcional: permitir solo al dueño)
ALTER TABLE plantillas_consentimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own consent templates"
	ON plantillas_consentimiento
	FOR ALL
	USING (auth.uid() = user_id)
	WITH CHECK (auth.uid() = user_id);
