-- ============================================================
-- Políticas de Storage para el bucket "recibos"
-- Rutas: recibos/receipts/{user_id}/{expense_id}.ext
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- IMPORTANTE: Primero crea el bucket "recibos" en Supabase Dashboard > Storage
-- Puede ser público o privado (si es privado, usa URLs firmadas)

-- Eliminar políticas existentes si las hay (para evitar conflictos)
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;

-- Subir: solo a su carpeta (receipts/{auth.uid()}/...)
-- Usamos LIKE para mayor compatibilidad que storage.foldername()
CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recibos'
  AND name LIKE 'receipts/' || auth.uid()::text || '/%'
);

-- Ver / descargar: solo sus archivos
CREATE POLICY "Users can read own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recibos'
  AND name LIKE 'receipts/' || auth.uid()::text || '/%'
);

-- Actualizar: solo sus archivos
CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recibos'
  AND name LIKE 'receipts/' || auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'recibos'
  AND name LIKE 'receipts/' || auth.uid()::text || '/%'
);

-- Borrar: solo sus archivos
CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recibos'
  AND name LIKE 'receipts/' || auth.uid()::text || '/%'
);
