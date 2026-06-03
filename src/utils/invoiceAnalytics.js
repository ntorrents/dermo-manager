/** Facturas emitidas a clientes (ingresos con número, sin plan amigo). */
export const isSalesInvoice = (entry) =>
	entry?.type === "income" &&
	entry?.activo !== false &&
	!entry?.plan_amigo &&
	Boolean(String(entry?.invoice_number || "").trim());

export const isAbonoEntry = (entry) =>
	Number(entry?.amount) < 0 ||
	String(entry?.invoice_number || "")
		.toUpperCase()
		.startsWith("R");

/** "Tratamiento X (Nombre Apellido)" → { treatmentName, clientHint } */
export const parseInvoiceDescription = (description) => {
	const raw = String(description || "").trim();
	if (!raw) return { treatmentName: "—", clientHint: "" };
	if (raw.startsWith("Abono:")) {
		const rest = raw.slice(6).trim();
		const m = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
		if (m) return { treatmentName: `Abono · ${m[1].trim()}`, clientHint: m[2].trim() };
		return { treatmentName: `Abono · ${rest}`, clientHint: "" };
	}
	const m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
	if (m) return { treatmentName: m[1].trim(), clientHint: m[2].trim() };
	return { treatmentName: raw.split("(")[0].trim() || raw, clientHint: "" };
};

export const resolveInvoiceClient = (entry, clients = []) => {
	if (entry?.client_id) {
		const c = clients.find((x) => x.id === entry.client_id);
		if (c) return c;
	}
	const { clientHint } = parseInvoiceDescription(entry?.description);
	if (!clientHint) return null;
	const hint = clientHint.toLowerCase();
	return (
		clients.find((c) => {
			const full = `${c.name || ""} ${c.surname || ""}`.trim().toLowerCase();
			return full === hint || (c.name || "").toLowerCase() === hint;
		}) || null
	);
};

export const clientDisplayName = (client, entry) => {
	if (client) {
		return `${client.name || ""} ${client.surname || ""}`.trim() || "—";
	}
	const { clientHint } = parseInvoiceDescription(entry?.description);
	return clientHint || "—";
};

export const aggregateByKey = (items, keyFn, valueFn) => {
	const map = new Map();
	items.forEach((item) => {
		const key = keyFn(item);
		if (!key) return;
		const prev = map.get(key) || { key, total: 0, count: 0 };
		prev.total += valueFn(item);
		prev.count += 1;
		map.set(key, prev);
	});
	return Array.from(map.values()).sort((a, b) => b.total - a.total);
};
