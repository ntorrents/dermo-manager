export const NAV_LABELS = {
	home: "Inicio",
	dashboard: "Dashboard",
	clients: "Pacientes",
	catalog: "Catálogo",
	treatments: "Tratamientos",
	products: "Productos",
	products_ventas: "Ventas productos",
	bonos: "Bonos",
	consents: "Consentimientos",
	budgets: "Presupuestos",
	documents: "Documentos",
	inventory: "Inventario",
	inventory_trazabilidad: "Trazabilidad",
	inventory_compras: "Compras",
	calendar: "Agenda",
	finance: "Finanzas",
	invoices: "Facturas",
	suppliers: "Compras",
	taxes: "Fiscalidad",
	taxes_130: "Modelo 130",
	taxes_303: "Modelo 303",
	taxes_115: "Modelo 115",
	taxes_390: "Modelo 390",
	taxes_180: "Modelo 180",
	taxes_renta: "Preparación Renta",
	taxes_declaraciones: "Declaraciones",
	settings: "Configuración",

	finance_movements: "Movimientos",
	financial_analysis: "Análisis Financiero",
	assets: "Bienes de Inversión",
	superadmin: "Superadmin",
	marketing: "Marketing",
	marketing_campanas: "Campañas",
	marketing_automatizaciones: "Automatizaciones",
	marketing_seguimiento: "Automatizaciones",
	marketing_plantillas: "Automatizaciones",
};

export const PATH_MAP = {
	home: "/",
	dashboard: "/dashboard",
	clients: "/clientes",
	catalog: "/catalogo",
	treatments: "/catalogo/tratamientos",
	products: "/catalogo/productos",
	products_ventas: "/catalogo/productos/ventas",
	bonos: "/catalogo/bonos",
	documents: "/documentos",
	consents: "/documentos/consentimientos",
	budgets: "/documentos/presupuestos",
	inventory: "/inventario",
	inventory_trazabilidad: "/inventario/trazabilidad",
	inventory_compras: "/inventario/compras",
	suppliers: "/inventario/compras",
	calendar: "/agenda",
	finance: "/finanzas/movimientos",
	finance_movements: "/finanzas/movimientos",
	invoices: "/finanzas/facturas",
	financial_analysis: "/finanzas/analisis",
	taxes: "/finanzas/fiscalidad",
	taxes_130: "/finanzas/fiscalidad/trimestral/130",
	taxes_303: "/finanzas/fiscalidad/trimestral/303",
	taxes_115: "/finanzas/fiscalidad/trimestral/115",
	taxes_390: "/finanzas/fiscalidad/anual/390",
	taxes_180: "/finanzas/fiscalidad/anual/180",
	taxes_renta: "/finanzas/fiscalidad/renta",
	taxes_declaraciones: "/finanzas/fiscalidad/declaraciones",
	assets: "/finanzas/fiscalidad/bienes-inversion",
	settings: "/configuracion",
	superadmin: "/superadmin",
	marketing: "/marketing/campanas",
	marketing_campanas: "/marketing/campanas",
	marketing_automatizaciones: "/marketing/automatizaciones",
	marketing_seguimiento: "/marketing/automatizaciones",
	marketing_plantillas: "/marketing/automatizaciones",
};

/** Ítem con la ruta más específica. */
export const resolveNavIdFromPath = (pathname) => {
	if (!pathname || pathname === "/") return "home";
	let bestId = null;
	let bestLen = -1;
	for (const [id, path] of Object.entries(PATH_MAP)) {
		if (!path || path === "/") continue;
		const matches = pathname === path || pathname.startsWith(`${path}/`);
		if (matches && path.length > bestLen) {
			bestId = id;
			bestLen = path.length;
		}
	}
	return bestId || "home";
};
