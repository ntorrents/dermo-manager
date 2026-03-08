/* eslint-disable react-refresh/only-export-components -- Este archivo exporta config y constantes, no solo componentes */
import { WidgetAlerts } from "./WidgetAlerts";
import { WidgetKpiFacturacion } from "./WidgetKpiFacturacion";
import { WidgetKpiImpuestos } from "./WidgetKpiImpuestos";
import { WidgetProximosEventos } from "./WidgetProximosEventos";
import { WidgetKpiBeneficioTotal } from "./WidgetKpiBeneficioTotal";
import { WidgetKpiBeneficioFiscal } from "./WidgetKpiBeneficioFiscal";
import { WidgetKpiIngresosGastos } from "./WidgetKpiIngresosGastos";
import { WidgetChartActividad } from "./WidgetChartActividad";
import { WidgetTopTratamientos } from "./WidgetTopTratamientos";
import { WidgetTopClientes } from "./WidgetTopClientes";

/** Orden por defecto (objetos con id, colSpan, rowSpan). Máximo MAX_WIDGETS. */
export const DEFAULT_WIDGETS = [
	{ id: "alerts", colSpan: 3, rowSpan: 1 },
	{ id: "kpi-facturacion", colSpan: 1, rowSpan: 1 },
	{ id: "kpi-impuestos", colSpan: 1, rowSpan: 1 },
	{ id: "kpi-proximos-eventos", colSpan: 1, rowSpan: 1 },
	{ id: "kpi-beneficio-total", colSpan: 1, rowSpan: 1 },
	{ id: "kpi-beneficio-fiscal", colSpan: 1, rowSpan: 1 },
	{ id: "kpi-ingresos-gastos", colSpan: 1, rowSpan: 1 },
	{ id: "chart-actividad", colSpan: 2, rowSpan: 1 },
];

/** Compatibilidad: lista de IDs como antes (solo orden) */
export const DEFAULT_WIDGET_IDS = DEFAULT_WIDGETS.map((w) => w.id);

export const MAX_WIDGETS = 12;

/** Valores permitidos para ancho/alto (bloques) */
export const SPAN_MIN = 1;
export const SPAN_MAX = 3;

/** En móvil siempre 1 columna; desde md aplicamos el span elegido (evita 2 cols en móvil) */
const COL_SPAN_RESPONSIVE = {
	1: "col-span-1 md:col-span-1",
	2: "col-span-1 md:col-span-2",
	3: "col-span-1 md:col-span-3",
};
const ROW_SPAN_RESPONSIVE = {
	1: "row-span-1 md:row-span-1",
	2: "row-span-1 md:row-span-2",
	3: "row-span-1 md:row-span-3",
};

export function getGridSpanClasses(colSpan, rowSpan) {
	const c = Math.max(SPAN_MIN, Math.min(SPAN_MAX, colSpan ?? 1));
	const r = Math.max(SPAN_MIN, Math.min(SPAN_MAX, rowSpan ?? 1));
	return `${COL_SPAN_RESPONSIVE[c]} ${ROW_SPAN_RESPONSIVE[r]}`.trim();
}

/**
 * Registro de todos los widgets disponibles.
 * id, title (nombre en desplegable), defaultColSpan, defaultRowSpan, component.
 */
export const WIDGET_CONFIG = [
	{
		id: "alerts",
		title: "Alertas de stock",
		defaultColSpan: 3,
		defaultRowSpan: 1,
		component: WidgetAlerts,
	},
	{
		id: "kpi-facturacion",
		title: "Facturación",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetKpiFacturacion,
	},
	{
		id: "kpi-impuestos",
		title: "Impuestos a pagar",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetKpiImpuestos,
	},
	{
		id: "kpi-proximos-eventos",
		title: "Próximos eventos",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetProximosEventos,
	},
	{
		id: "kpi-beneficio-total",
		title: "Beneficio total (caja)",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetKpiBeneficioTotal,
	},
	{
		id: "kpi-beneficio-fiscal",
		title: "Beneficio fiscal",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetKpiBeneficioFiscal,
	},
	{
		id: "kpi-ingresos-gastos",
		title: "Ingresos y gastos",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetKpiIngresosGastos,
	},
	{
		id: "chart-actividad",
		title: "Actividad (gráfica)",
		defaultColSpan: 2,
		defaultRowSpan: 1,
		component: WidgetChartActividad,
	},
	{
		id: "chart-top-tratamientos",
		title: "Top tratamientos",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetTopTratamientos,
	},
	{
		id: "top-clientes",
		title: "Top clientes",
		defaultColSpan: 1,
		defaultRowSpan: 1,
		component: WidgetTopClientes,
	},
];

export const getWidgetById = (id) => WIDGET_CONFIG.find((w) => w.id === id);

export const getAvailableToAdd = (activeIds) =>
	WIDGET_CONFIG.filter((w) => !activeIds.includes(w.id));
