-- Diario de visitas: título opcional e indicaciones post tratamiento.
-- Las columnas existentes se reutilizan: fecha_proximo_contacto = fecha de la visita, tratamientos_interes = tratamientos realizados.

ALTER TABLE public.seguimientos_cliente
  ADD COLUMN IF NOT EXISTS titulo text;

ALTER TABLE public.seguimientos_cliente
  ADD COLUMN IF NOT EXISTS indicaciones_post text;

COMMENT ON TABLE public.seguimientos_cliente IS 'Diario de visitas por cliente: fecha, tratamientos realizados, notas de sesión, etc.';

COMMENT ON COLUMN public.seguimientos_cliente.titulo IS 'Resumen o título breve de la visita (opcional)';

COMMENT ON COLUMN public.seguimientos_cliente.indicaciones_post IS 'Indicaciones o cuidados post tratamiento dados al paciente (opcional)';

COMMENT ON COLUMN public.seguimientos_cliente.tratamientos_interes IS 'Tratamientos realizados en la visita (texto libre; varios separados por comas si procede)';

COMMENT ON COLUMN public.seguimientos_cliente.fecha_proximo_contacto IS 'Fecha de la visita / sesión clínica';
