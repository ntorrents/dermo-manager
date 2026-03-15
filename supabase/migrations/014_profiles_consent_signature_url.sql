-- Firma profesional para consentimientos: URL pública (mismo criterio que logo_url)
ALTER TABLE profiles
	ADD COLUMN IF NOT EXISTS consent_signature_url text;

COMMENT ON COLUMN profiles.consent_signature_url IS 'URL de imagen de firma profesional para PDFs de consentimiento; si está vacío, solo se dibuja la línea.';

-- Logo y firma se guardan en el bucket público existente company-assets (junto al logo.svg).
-- No se crea bucket nuevo. Si el upload desde la app falla por RLS, añade políticas como las de abajo
-- (o ajusta rutas: p. ej. carpeta por user_id).

-- Políticas para company-assets: subir/borrar solo en carpeta propia (primer segmento = user_id).
-- Si ya tienes políticas que permiten INSERT global, estas añaden restricción por carpeta;
-- si INSERT está denegado, estas lo habilitan para tu carpeta.
-- Ejecutar solo si te da error al subir; si falla por "policy already exists", renombra o elimina la duplicada.

CREATE POLICY "company_assets_insert_own_folder"
	ON storage.objects FOR INSERT
	WITH CHECK (
		bucket_id = 'company-assets'
		AND (storage.foldername(name))[1] = (auth.uid())::text
	);

CREATE POLICY "company_assets_select_public"
	ON storage.objects FOR SELECT
	USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_delete_own_folder"
	ON storage.objects FOR DELETE
	USING (
		bucket_id = 'company-assets'
		AND (storage.foldername(name))[1] = (auth.uid())::text
	);
