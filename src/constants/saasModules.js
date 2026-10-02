/** Catálogo SaaS de módulos granulares (Gestión / Clínica 360 + extras). */

export const ALL_MODULES = [
	"agenda_core",
	"google_calendar",
	"clients_crm",
	"clients_history",
	"clients_docs",
	"photo_vault",
	"bonos_manager",
	"legal_signatures",
	"products_catalog",
	"finance_basic",
	"finance_invoices",
	"daily_cash",
	"finance_analytics",
	"finance_plan_amigo",
	"inventory_core",
	"inventory_traceability",
	"suppliers_manager",
	"taxes_aeat",
	"marketing_campaigns",
	"client_followup",
	"custom_email_domain",
];

/** Add-ons de pago / especiales: no entran al aplicar preset Gestión/360. */
export const EXTRA_MODULES = [
	"google_calendar",
	"finance_plan_amigo",
	"inventory_traceability",
	"custom_email_domain",
];

export const CORE_MODULES = ALL_MODULES.filter((m) => !EXTRA_MODULES.includes(m));

/** Orden de secciones en la UI de superadmin. */
export const MODULE_GROUP_ORDER = [
	"Clínica",
	"Clientes",
	"Ventas",
	"Finanzas",
	"Stock",
	"Fiscal",
	"Marketing",
	"Extras",
];

export const MODULE_META = {
	agenda_core: {
		label: "Agenda",
		hint: "Citas y calendario de la clínica",
		group: "Clínica",
	},
	google_calendar: {
		label: "Google Calendar",
		hint: "Sincronización con Google",
		group: "Extras",
		extra: true,
	},
	clients_crm: {
		label: "Ficha de clientes",
		hint: "Listado y datos del paciente",
		group: "Clientes",
	},
	clients_history: {
		label: "Historial de sesiones",
		hint: "Pestaña Visitas / línea de tiempo",
		group: "Clientes",
		requires: ["clients_crm"],
	},
	clients_docs: {
		label: "Documentación",
		hint: "Consentimientos y archivos en la ficha",
		group: "Clientes",
		requires: ["clients_crm"],
	},
	photo_vault: {
		label: "Fotos antes / después",
		hint: "Galería de sesión en la ficha",
		group: "Clientes",
		requires: ["clients_crm"],
	},
	bonos_manager: {
		label: "Bonos & presupuestos",
		hint: "Plantillas, venta y consumo de bonos",
		group: "Ventas",
	},
	legal_signatures: {
		label: "Consentimientos",
		hint: "Plantillas y firma legal",
		group: "Ventas",
	},
	products_catalog: {
		label: "Catálogo de productos",
		hint: "Productos a la venta con stock propio",
		group: "Ventas",
	},
	finance_basic: {
		label: "Movimientos",
		hint: "Ingresos, gastos y caja operativa",
		group: "Finanzas",
	},
	finance_invoices: {
		label: "Facturas",
		hint: "Listado y estadísticas de facturas emitidas",
		group: "Finanzas",
	},
	daily_cash: {
		label: "Cierre de caja",
		hint: "Cierre diario de caja",
		group: "Finanzas",
	},
	finance_analytics: {
		label: "Análisis financiero",
		hint: "Informes y KPIs avanzados",
		group: "Finanzas",
	},
	finance_plan_amigo: {
		label: "Plan Amigo",
		hint: "Sesiones sin factura (familia). Cuenta en finanzas, no en Hacienda",
		group: "Extras",
		extra: true,
	},
	inventory_core: {
		label: "Inventario",
		hint: "Stock de materiales",
		group: "Stock",
	},
	inventory_traceability: {
		label: "Trazabilidad de lotes",
		hint: "Lotes, caducidades y trazabilidad",
		group: "Extras",
		extra: true,
	},
	suppliers_manager: {
		label: "Proveedores",
		hint: "Gestión de proveedores",
		group: "Stock",
	},
	taxes_aeat: {
		label: "Fiscalidad AEAT",
		hint: "Modelos 130/303/115 y declaraciones",
		group: "Fiscal",
	},
	marketing_campaigns: {
		label: "Campañas email",
		hint: "Envíos masivos a destinatarios elegidos",
		group: "Marketing",
	},
	client_followup: {
		label: "Seguimiento 1:1",
		hint: "Correo individual a un paciente",
		group: "Marketing",
	},
	custom_email_domain: {
		label: "Dominio de correo propio",
		hint: "Remitente @tuclinica vía Resend",
		group: "Extras",
		extra: true,
	},
};

/** Planes comerciales oficiales (solo estos dos). */
export const SAAS_PLAN_TIERS = ["basic", "integral"];

/** Precio mensual por plan (€). custom_fee_eur en clínica sobrescribe. */
export const PLAN_DEFAULT_FEE_EUR = {
	basic: 49,
	integral: 89,
};

export const PLAN_LABELS = {
	basic: "Plan Gestión",
	integral: "Plan Clínica 360",
};

/**
 * Módulos core por plan (sin extras).
 * Al aplicar preset se conservan los extras ya activos.
 */
export const PLAN_DEFAULT_MODULES = {
	basic: [
		"agenda_core",
		"clients_crm",
		"clients_history",
		"bonos_manager",
		"legal_signatures",
		"products_catalog",
		"finance_basic",
		"finance_invoices",
		"daily_cash",
		"inventory_core",
		"client_followup",
	],
	integral: [...CORE_MODULES],
};

/**
 * Aplica un preset de plan conservando extras ya marcados.
 */
export const applyPlanPreset = (tier, currentModules = []) => {
	const base =
		PLAN_DEFAULT_MODULES[normalizeSubscriptionTier(tier)] ||
		PLAN_DEFAULT_MODULES.basic;
	const keptExtras = (currentModules || []).filter((m) =>
		EXTRA_MODULES.includes(m),
	);
	return [...new Set([...base, ...keptExtras])];
};

/**
 * Activa dependencias (p. ej. clients_crm si activas historial).
 */
export const withModuleDependencies = (modules) => {
	const set = new Set(modules || []);
	let changed = true;
	while (changed) {
		changed = false;
		for (const id of [...set]) {
			const reqs = MODULE_META[id]?.requires || [];
			for (const r of reqs) {
				if (!set.has(r)) {
					set.add(r);
					changed = true;
				}
			}
		}
	}
	return ALL_MODULES.filter((m) => set.has(m));
};

/** Agrupa módulos para la UI (Extras al final). */
export const groupModulesForUi = () => {
	const map = {};
	for (const id of ALL_MODULES) {
		const g = MODULE_META[id]?.group || "Otros";
		if (!map[g]) map[g] = [];
		map[g].push(id);
	}
	const ordered = [];
	for (const g of MODULE_GROUP_ORDER) {
		if (map[g]?.length) ordered.push({ group: g, ids: map[g], isExtra: g === "Extras" });
	}
	for (const g of Object.keys(map)) {
		if (!MODULE_GROUP_ORDER.includes(g)) {
			ordered.push({ group: g, ids: map[g], isExtra: false });
		}
	}
	return ordered;
};

/**
 * Normaliza tiers legacy (`clinic`) al plan oficial equivalente.
 */
export const normalizeSubscriptionTier = (tier) => {
	if (tier === "integral" || tier === "clinic") return "integral";
	return "basic";
};

export const effectiveClinicFeeEur = (clinic) => {
	if (!clinic) return 0;
	if (clinic.custom_fee_eur != null && clinic.custom_fee_eur !== "") {
		return Number(clinic.custom_fee_eur) || 0;
	}
	const tier = normalizeSubscriptionTier(clinic.subscription_tier);
	return Number(PLAN_DEFAULT_FEE_EUR[tier] ?? PLAN_DEFAULT_FEE_EUR.basic) || 0;
};

/** Módulo requerido por ítem de navegación (ids de PATH_MAP / NAV). */
export const NAV_ITEM_MODULE = {
	calendar: "agenda_core",
	clients: "clients_crm",
	bonos: "bonos_manager",
	budgets: "bonos_manager",
	consents: "legal_signatures",
	products: "products_catalog",
	products_ventas: "products_catalog",
	inventory: "inventory_core",
	suppliers: "suppliers_manager",
	finance_movements: "finance_basic",
	invoices: "finance_invoices",
	financial_analysis: "finance_analytics",
	taxes: "taxes_aeat",
	taxes_130: "taxes_aeat",
	taxes_303: "taxes_aeat",
	taxes_115: "taxes_aeat",
	taxes_390: "taxes_aeat",
	taxes_180: "taxes_aeat",
	taxes_renta: "taxes_aeat",
	taxes_declaraciones: "taxes_aeat",
	assets: "taxes_aeat",
	marketing: "marketing_campaigns",
	marketing_campanas: "marketing_campaigns",
	marketing_seguimiento: "client_followup",
	marketing_plantillas: "marketing_campaigns",
};

export const hasModule = (activeModules, moduleId) => {
	if (!moduleId) return true;
	const list = Array.isArray(activeModules) ? activeModules : [];
	return list.includes(moduleId);
};

/** Roles de clínica (RBAC tenant). */
export const CLINIC_ROLES = ["admin", "staff_medico", "recepcion"];

export const ROLE_LABELS = {
	admin: "Admin",
	staff_medico: "Staff médico",
	recepcion: "Recepción",
};

/** Defaults de visibilidad UI por rol (semilla / plantilla). */
export const DEFAULT_ROLE_MODULES = {
	admin: [...ALL_MODULES],
	staff_medico: [
		"agenda_core",
		"clients_crm",
		"clients_history",
		"clients_docs",
		"bonos_manager",
		"legal_signatures",
		"photo_vault",
		"inventory_core",
		"inventory_traceability",
	],
	recepcion: [
		"agenda_core",
		"clients_crm",
		"clients_history",
		"bonos_manager",
		"products_catalog",
		"finance_basic",
		"finance_invoices",
		"daily_cash",
		"client_followup",
	],
};
