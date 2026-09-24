/**
 * Clave de perceptor AEAT (Modelos 115 / 180 Casilla 01).
 * Prioridad: NIF normalizado → nombre de proveedor → id de línea (sin colapsar desconocidos).
 */
export const perceptorKey = (entry) => {
	const nif = String(entry?.supplier_nif || "")
		.trim()
		.toUpperCase()
		.replace(/[\s.\-]/g, "");
	if (nif) return `nif:${nif}`;

	const name = String(entry?.provider_name || "")
		.trim()
		.toLowerCase();
	if (name) return `name:${name}`;

	return `id:${entry?.id ?? "unknown"}`;
};

/** Nº de personas/empresas únicas a las que se retuvo (no nº de movimientos). */
export const countUniquePerceptors = (rows = []) => {
	const keys = new Set();
	for (const row of rows) {
		keys.add(perceptorKey(row));
	}
	return keys.size;
};
