-- Bloque 4: presupuestos (cotizaciones) persistidos
CREATE TABLE IF NOT EXISTS presupuestos (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
	notas text,
	valid_until date,
	activo boolean NOT NULL DEFAULT true,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presupuesto_lineas (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
	line_kind text NOT NULL CHECK (line_kind IN ('treatment', 'extra')),
	treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
	description text NOT NULL,
	quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
	-- Precio unitario con IVA incluido (TTC), alineado con tratamiento.price en UI
	unit_price_ttc numeric NOT NULL DEFAULT 0 CHECK (unit_price_ttc >= 0),
	tax_rate numeric NOT NULL DEFAULT 21,
	sort_order int NOT NULL DEFAULT 0
);

COMMENT ON TABLE presupuestos IS 'Presupuestos / cotizaciones guardados';
COMMENT ON COLUMN presupuesto_lineas.unit_price_ttc IS 'Precio unitario con IVA incluido';

CREATE INDEX IF NOT EXISTS idx_presupuestos_user_id ON presupuestos(user_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_client_id ON presupuestos(client_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_lineas_presupuesto ON presupuesto_lineas(presupuesto_id);

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own presupuestos"
	ON presupuestos FOR ALL
	USING (auth.uid() = user_id)
	WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own presupuesto_lineas"
	ON presupuesto_lineas FOR ALL
	USING (
		EXISTS (
			SELECT 1 FROM presupuestos p
			WHERE p.id = presupuesto_lineas.presupuesto_id AND p.user_id = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM presupuestos p
			WHERE p.id = presupuesto_lineas.presupuesto_id AND p.user_id = auth.uid()
		)
	);
