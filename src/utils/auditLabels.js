/** Etiquetas legibles para tipos de entidad en auditoría */
export const AUDIT_ENTITY_LABELS = {
	clients: "Cliente",
	finance_entries: "Movimiento",
	appointments: "Cita",
	treatments: "Tratamiento",
	inventory: "Artículo stock",
	user_clinic_memberships: "Equipo",
	clinics: "Clínica",
};

export function auditActionLabel(action) {
	switch (action) {
		case "insert":
			return "Alta";
		case "update":
			return "Cambio";
		case "delete":
			return "Baja";
		default:
			return action || "—";
	}
}

export function auditEntityLabel(entityType) {
	if (!entityType) return "—";
	return AUDIT_ENTITY_LABELS[entityType] || entityType;
}

/** Etiquetas para columnas en metadata.changes (triggers SQL) */
const AUDIT_FIELD_LABELS = {
	name: "Nombre",
	surname: "Apellidos",
	phone: "Teléfono",
	email: "Email",
	dni: "DNI/NIF",
	fecha_nacimiento: "Fecha nacimiento",
	notas: "Notas",
	activo: "Activo",
	title: "Título",
	notes: "Notas",
	start_at: "Inicio",
	end_at: "Fin",
	status: "Estado",
	description: "Descripción",
	category: "Categoría",
	amount: "Importe",
	date: "Fecha",
	type: "Tipo",
	price: "Precio",
	stock: "Stock",
	min_stock: "Stock mínimo",
	unit_cost: "Coste unitario",
	item_type: "Tipo artículo",
	internal_notes: "Notas internas",
	group_id: "Grupo",
	role: "Rol",
	user_id: "Usuario",
	treatment_id: "Tratamiento",
	client_id: "Cliente",
	clinic_id: "Clínica",
	billing_nif: "NIF facturación",
	billing_address: "Dirección fiscal",
	billing_city: "Ciudad",
	billing_phone: "Teléfono clínica",
	logo_url: "Logo",
	nombre: "Nombre",
	contenido: "Contenido",
};

export function auditFieldLabel(fieldKey) {
	if (!fieldKey) return "Campo";
	return AUDIT_FIELD_LABELS[fieldKey] || fieldKey.replace(/_/g, " ");
}

export function formatAuditScalar(value) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "boolean") return value ? "Sí" : "No";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") {
		const t = value.trim();
		return t.length > 120 ? `${t.slice(0, 117)}…` : t || "—";
	}
	try {
		const s = JSON.stringify(value);
		return s.length > 120 ? `${s.slice(0, 117)}…` : s;
	} catch {
		return String(value);
	}
}

/** Líneas legibles a partir de metadata.changes (UPDATE) */
export function auditChangesLines(metadata) {
	const raw = metadata?.changes;
	if (!raw || typeof raw !== "object") return [];
	return Object.entries(raw).map(([key, pair]) => {
		if (pair && typeof pair === "object" && ("before" in pair || "after" in pair)) {
			const before = formatAuditScalar(pair.before);
			const after = formatAuditScalar(pair.after);
			return `${auditFieldLabel(key)}: ${before} → ${after}`;
		}
		return `${auditFieldLabel(key)}: ${formatAuditScalar(pair)}`;
	});
}
