import { NAV_LABELS, PATH_MAP, resolveNavIdFromPath } from "./navigationLabels";

const SECTION_ROOTS = [
	{
		match: (p) => p.startsWith("/finanzas"),
		root: { label: "Finanzas", to: "/finanzas/movimientos" },
	},
	{
		match: (p) =>
			p.startsWith("/catalogo") ||
			p.startsWith("/productos") ||
			p.startsWith("/tratamientos") ||
			p.startsWith("/bonos"),
		root: { label: "Catálogo", to: "/catalogo" },
	},
	{
		match: (p) =>
			p.startsWith("/documentos") ||
			p.startsWith("/presupuestos") ||
			p.startsWith("/consentimientos"),
		root: { label: "Documentos", to: "/documentos" },
	},
	{
		match: (p) => p.startsWith("/inventario") || p.startsWith("/proveedores"),
		root: { label: "Inventario", to: "/inventario" },
	},
	{
		match: (p) => p.startsWith("/marketing"),
		root: { label: "Marketing", to: "/marketing" },
	},
	{
		match: (p) => p.startsWith("/clientes"),
		root: { label: "Pacientes", to: "/clientes" },
	},
];

/**
 * @returns {{ label: string, to?: string }[]}
 */
export function buildBreadcrumbs(pathname, { clients = [] } = {}) {
	if (!pathname || pathname === "/") {
		return [{ label: "Inicio" }];
	}

	const crumbs = [];
	const section = SECTION_ROOTS.find((s) => s.match(pathname));

	if (section) {
		crumbs.push(section.root);
	}

	const clientMatch = pathname.match(/^\/clientes\/([^/]+)/);
	if (clientMatch) {
		const client = clients.find((c) => c.id === clientMatch[1]);
		const name = client
			? [client.name, client.surname].filter(Boolean).join(" ").trim()
			: "Paciente";
		crumbs.push({ label: name || "Paciente" });
		return crumbs;
	}

	const navId = resolveNavIdFromPath(pathname);
	const label = NAV_LABELS[navId];
	const path = PATH_MAP[navId];

	if (!label) {
		return crumbs.length ? crumbs : [{ label: "Inicio" }];
	}

	const last = crumbs[crumbs.length - 1];
	if (last && last.label === label) {
		return crumbs;
	}

	if (section && (path === section.root.to || navId === "catalog" || navId === "documents" || navId === "finance")) {
		return crumbs;
	}

	if (!section) {
		return [{ label }];
	}

	crumbs.push({ label });
	return crumbs;
}
