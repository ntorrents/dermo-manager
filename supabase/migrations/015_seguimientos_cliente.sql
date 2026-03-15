-- Bloque 3: Seguimiento (follow-up) de clientes
CREATE TABLE IF NOT EXISTS seguimientos_cliente (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	tratamientos_interes text,
	fecha_proximo_contacto date,
	notas text,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE seguimientos_cliente IS 'Seguimiento y recordatorios por cliente: tratamientos de interés, próxima cita, notas';
COMMENT ON COLUMN seguimientos_cliente.tratamientos_interes IS 'Tratamientos de interés (texto libre o lista separada por comas)';
COMMENT ON COLUMN seguimientos_cliente.fecha_proximo_contacto IS 'Fecha prevista para próximo contacto o recordatorio';

CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_client_id ON seguimientos_cliente(client_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_user_id ON seguimientos_cliente(user_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_fecha ON seguimientos_cliente(fecha_proximo_contacto);

ALTER TABLE seguimientos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own client follow-ups"
	ON seguimientos_cliente
	FOR ALL
	USING (auth.uid() = user_id)
	WITH CHECK (auth.uid() = user_id);
