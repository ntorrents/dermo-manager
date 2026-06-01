/** Directorio de proveedores a partir de gastos (misma fuente que Finanzas). */
export const buildSupplierDirectory = (entries = []) => {
	const map = new Map();
	(entries || [])
		.filter((e) => e.type === "expense" && (e.provider_name || e.supplier_nif))
		.forEach((e) => {
			const nif = (e.supplier_nif || "").trim();
			const name = (e.provider_name || "").trim();
			const key = `${nif}__${name}`.toLowerCase();
			if (!map.has(key)) map.set(key, { nif, name });
		});
	return Array.from(map.values()).sort((a, b) =>
		(a.name || a.nif || "").localeCompare(b.name || b.nif || "", "es"),
	);
};

/** Autocompletar NIF si el nombre coincide con un único proveedor del directorio. */
export const matchProviderByName = (directory, providerName) => {
	const val = (providerName || "").trim().toLowerCase();
	if (!val) return null;
	const matches = directory.filter(
		(s) => (s.name || "").trim().toLowerCase() === val,
	);
	return matches.length === 1 ? matches[0] : null;
};
