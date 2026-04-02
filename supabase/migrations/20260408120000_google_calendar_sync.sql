-- Google Calendar: credenciales (solo service_role) + vínculo en citas + estado legible vía RPC.
-- La sincronización bidireccional la ejecutan Edge Functions con service_role.

-- Campos en citas para mapear eventos de Google y resolver conflictos (última actualización gana).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_etag text,
  ADD COLUMN IF NOT EXISTS google_remote_updated timestamp with time zone;

COMMENT ON COLUMN public.appointments.google_event_id IS 'ID del evento en Google Calendar API v3';
COMMENT ON COLUMN public.appointments.google_etag IS 'ETag de Google para If-Match en actualizaciones';
COMMENT ON COLUMN public.appointments.google_remote_updated IS 'Valor event.updated de Google en la última importación';

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_clinic_google_event_active
  ON public.appointments (clinic_id, google_event_id)
  WHERE google_event_id IS NOT NULL AND activo = true;

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamp with time zone,
  next_sync_token text,
  last_full_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.google_calendar_connections IS 'OAuth Google Calendar; tokens solo accesibles con service_role (Edge Functions).';

DROP TRIGGER IF EXISTS google_calendar_connections_updated_at ON public.google_calendar_connections;
CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at ();

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Sin políticas: anónimo y autenticado no leen/escriben filas (solo postgres y service_role).
REVOKE ALL ON public.google_calendar_connections FROM PUBLIC;
REVOKE ALL ON public.google_calendar_connections FROM anon;
REVOKE ALL ON public.google_calendar_connections FROM authenticated;
GRANT ALL ON TABLE public.google_calendar_connections TO service_role;

CREATE OR REPLACE FUNCTION public.google_calendar_link_status ()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'connected', true,
        'google_calendar_id', c.google_calendar_id,
        'last_sync_at', c.last_full_sync_at,
        'last_error', c.last_error
      )
      FROM public.google_calendar_connections c
      WHERE c.user_id = auth.uid ()
      LIMIT 1
    ),
    jsonb_build_object(
      'connected', false,
      'google_calendar_id', null,
      'last_sync_at', null,
      'last_error', null
    )
  );
$$;

COMMENT ON FUNCTION public.google_calendar_link_status IS 'Estado de enlace Google Calendar (sin exponer tokens).';

GRANT EXECUTE ON FUNCTION public.google_calendar_link_status () TO authenticated;
