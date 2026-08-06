export const SUPPLIER_RULES_STORAGE_KEY = "suppliersCanonicalRules.v1";

export function loadSupplierRules() {
	try {
		if (typeof localStorage === "undefined") return {};
		const raw = localStorage.getItem(SUPPLIER_RULES_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

export function saveSupplierRules(rules) {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(SUPPLIER_RULES_STORAGE_KEY, JSON.stringify(rules || {}));
	} catch {
		/* ignore */
	}
}

export function setSupplierRule(rules, nif, canonicalName) {
	const key = String(nif || "").trim().toUpperCase();
	if (!key) return rules;
	const next = { ...rules };
	if (canonicalName?.trim()) next[key] = canonicalName.trim();
	else delete next[key];
	return next;
}

/** NIFs con más de un nombre distinto en gastos. */
export function findDuplicateSupplierNifs(entries = []) {
	const expenses = (entries || []).filter((e) => e.type === "expense");
	const byNif = new Map();
	expenses.forEach((e) => {
		const nif = (e.supplier_nif || "").trim().toUpperCase();
		if (!nif) return;
		const name = (e.provider_name || "").trim();
		if (!byNif.has(nif)) byNif.set(nif, new Set());
		if (name) byNif.get(nif).add(name);
	});
	return Array.from(byNif.entries())
		.filter(([, names]) => names.size > 1)
		.map(([nif, names]) => ({
			nif,
			names: Array.from(names).sort((a, b) => a.localeCompare(b, "es")),
		}))
		.sort((a, b) => a.nif.localeCompare(b.nif, "es"));
}
