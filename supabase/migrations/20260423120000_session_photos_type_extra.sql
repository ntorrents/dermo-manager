-- Fotos adicionales de sesión (galería), además de antes/después.
ALTER TABLE public.session_photos
	DROP CONSTRAINT IF EXISTS session_photos_type_check;

ALTER TABLE public.session_photos
	ADD CONSTRAINT session_photos_type_check CHECK (
		type = ANY (ARRAY['before'::text, 'after'::text, 'extra'::text])
	);
