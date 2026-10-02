export const NAV_LABELS = {
	home: "Inicio",
	dashboard: "Dashboard",
	clients: "Clientes",
	treatments: "Tratamientos",
	products: "Productos",
	products_ventas: "Ventas productos",
	bonos: "Bonos",
	consents: "Consentimientos",
	budgets: "Presupuestos",
	documents: "Documentos",
	inventory: "Stock",
	calendar: "Agenda",
	finance: "Finanzas",
	invoices: "Facturas",
	suppliers: "Proveedores",
	taxes: "Resumen fiscal",
	taxes_130: "Modelo 130",
	taxes_303: "Modelo 303",
	taxes_115: "Modelo 115",
	taxes_390: "Modelo 390",
	taxes_180: "Modelo 180",
	taxes_renta: "Preparación Renta",
	taxes_declaraciones: "Declaraciones",
	settings: "Ajustes",

	finance_movements: "Movimientos",
	financial_analysis: "Análisis Financiero",
	assets: "Bienes de Inversión",
	superadmin: "Superadmin",
	marketing: "Marketing",
	marketing_campanas: "Campañas",
	marketing_seguimiento: "Seguimiento",
	marketing_plantillas: "Plantillas",
};

export const PATH_MAP = {
	home: "/",
	dashboard: "/dashboard",
	clients: "/clientes",
	treatments: "/tratamientos",
	products: "/productos",
	products_ventas: "/productos/ventas",
	bonos: "/bonos",
	consents: "/consentimientos",
	inventory: "/inventario",
	calendar: "/agenda",
	finance_movements: "/finanzas/movimientos",
	invoices: "/finanzas/facturas",
	financial_analysis: "/finanzas/analisis",
	suppliers: "/proveedores",
	taxes: "/fiscalidad",
	taxes_130: "/fiscalidad/trimestral/130",
	taxes_303: "/fiscalidad/trimestral/303",
	taxes_115: "/fiscalidad/trimestral/115",
	taxes_390: "/fiscalidad/anual/390",
	taxes_180: "/fiscalidad/anual/180",
	taxes_renta: "/fiscalidad/renta",
	taxes_declaraciones: "/fiscalidad/declaraciones",
	assets: "/fiscalidad/bienes-inversion",
	settings: "/configuracion",
	budgets: "/presupuestos",
	superadmin: "/superadmin",
	marketing: "/marketing",
	marketing_campanas: "/marketing/campanas",
	marketing_seguimiento: "/marketing/seguimiento",
	marketing_plantillas: "/marketing/plantillas",
};

/** Ítem con la ruta más específica (evita que /fiscalidad capture /fiscalidad/trimestral/130). */
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
