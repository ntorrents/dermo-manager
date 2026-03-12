-- Consentimientos firmados: tabla + bucket privado para PDFs

CREATE TABLE IF NOT EXISTS signed_consents (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
	treatment_name text NOT NULL,
	storage_path text NOT NULL,
	uploaded_at timestamptz DEFAULT now()
);

COMMENT ON TABLE signed_consents IS 'PDFs de consentimientos informados firmados por cliente';
COMMENT ON COLUMN signed_consents.treatment_name IS 'Nombre del tratamiento (para listado aunque treatment_id sea NULL)';
COMMENT ON COLUMN signed_consents.storage_path IS 'Ruta en bucket signed-consents';

CREATE INDEX IF NOT EXISTS idx_signed_consents_client_id ON signed_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_signed_consents_user_id ON signed_consents(user_id);

ALTER TABLE signed_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own signed consents"
	ON signed_consents
	FOR ALL
	USING (auth.uid() = user_id)
	WITH CHECK (auth.uid() = user_id);

-- Bucket privado para PDFs de consentimientos firmados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'signed-consents',
	'signed-consents',
	false,
	10485760,
	ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: solo el usuario dueño puede leer/escribir en su carpeta (primer segmento = user_id)
CREATE POLICY "Users can upload signed consents in own folder"
	ON storage.objects FOR INSERT
	WITH CHECK (
		bucket_id = 'signed-consents'
		AND (storage.foldername(name))[1] = (auth.uid())::text
	);

CREATE POLICY "Users can read signed consents in own folder"
	ON storage.objects FOR SELECT
	USING (
		bucket_id = 'signed-consents'
		AND (storage.foldername(name))[1] = (auth.uid())::text
	);

CREATE POLICY "Users can delete signed consents in own folder"
	ON storage.objects FOR DELETE
	USING (
		bucket_id = 'signed-consents'
		AND (storage.foldername(name))[1] = (auth.uid())::text
	);
