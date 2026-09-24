/**
 * Plazos AEAT España — ventanas de presentación.
 * Alertas activas desde el primer día de la ventana hasta que status=completed.
 */

export const TAX_DEADLINE_WINDOWS = [
	{
		id: "T1",
		label: "1º Trimestre (T1)",
		models: ["130", "303", "115"],
		/** Mes 0-index del inicio del aviso; day = día inicio */
		getRange: (fiscalYear) => ({
			start: new Date(fiscalYear, 3, 1), // 1 abr
			end: new Date(fiscalYear, 3, 20), // 20 abr
			title: `Ventana Impuestos T1 ${fiscalYear}`,
		}),
	},
	{
		id: "T2",
		label: "2º Trimestre (T2)",
		models: ["130", "303", "115"],
		getRange: (fiscalYear) => ({
			start: new Date(fiscalYear, 6, 1),
			end: new Date(fiscalYear, 6, 20),
			title: `Ventana Impuestos T2 ${fiscalYear}`,
		}),
	},
	{
		id: "T3",
		label: "3º Trimestre (T3)",
		models: ["130", "303", "115"],
		getRange: (fiscalYear) => ({
			start: new Date(fiscalYear, 9, 1),
			end: new Date(fiscalYear, 9, 20),
			title: `Ventana Impuestos T3 ${fiscalYear}`,
		}),
	},
	{
		id: "T4",
		label: "4º Trimestre (T4)",
		models: ["130", "303", "115"],
		/** Se presenta en enero del año siguiente */
		getRange: (fiscalYear) => ({
			start: new Date(fiscalYear + 1, 0, 1),
			end: new Date(fiscalYear + 1, 0, 30),
			title: `Ventana Impuestos T4 ${fiscalYear}`,
		}),
	},
	{
		id: "ANUAL",
		label: "Resúmenes anuales (390 / 180)",
		models: ["390", "180"],
		getRange: (fiscalYear) => ({
			start: new Date(fiscalYear + 1, 0, 1),
			end: new Date(fiscalYear + 1, 0, 30),
			title: `Ventana Impuestos Anuales ${fiscalYear}`,
		}),
	},
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Ventana AEAT para un modelo + periodo + ejercicio fiscal. */
export const getDeadlineWindowFor = (model, fiscalYear, period) => {
	const window = TAX_DEADLINE_WINDOWS.find(
		(w) => w.id === period && w.models.includes(String(model)),
	);
	if (!window) return null;
	return window.getRange(fiscalYear);
};

/**
 * Estado UX de una declaración:
 * - presented: marcada completed
 * - upcoming: aún no abre la ventana de presentación
 * - pending: dentro de la ventana y no presentada
 * - overdue: ventana cerrada y no presentada
 */
export const getDeclarationUiStatus = (
	model,
	fiscalYear,
	period,
	declaration,
	now = new Date(),
) => {
	if (declaration?.status === "completed") {
		return {
			id: "presented",
			label: "Presentado",
			tone: "success",
		};
	}

	const range = getDeadlineWindowFor(model, fiscalYear, period);
	if (!range) {
		return { id: "upcoming", label: "Próximamente", tone: "muted" };
	}

	const today = startOfDay(now);
	const start = startOfDay(range.start);
	const end = startOfDay(range.end);

	if (today < start) {
		return {
			id: "upcoming",
			label: "Próximamente",
			tone: "muted",
			windowStart: range.start,
			windowEnd: range.end,
		};
	}

	if (today > end) {
		const daysLate = Math.ceil((today - end) / 86400000);
		return {
			id: "overdue",
			label: "Retrasado",
			tone: "danger",
			windowStart: range.start,
			windowEnd: range.end,
			daysLate,
		};
	}

	const daysLeft = Math.ceil((end - today) / 86400000);
	return {
		id: "pending",
		label: "Pendiente",
		tone: "warning",
		windowStart: range.start,
		windowEnd: range.end,
		daysLeft,
	};
};

/**
 * Alertas activas a fecha `now` que aún no están completed en declarations.
 */
export const getActiveTaxAlerts = (declarations = [], now = new Date()) => {
	const today = startOfDay(now);
	const alerts = [];

	// Revisar año actual y año anterior (T4 / anuales se presentan en ene)
	const years = [today.getFullYear() - 1, today.getFullYear()];

	for (const fiscalYear of years) {
		for (const window of TAX_DEADLINE_WINDOWS) {
			const { start, end, title } = window.getRange(fiscalYear);
			if (today < startOfDay(start) || today > startOfDay(end)) continue;

			for (const model of window.models) {
				const period = window.id;
				const row = (declarations || []).find(
					(d) =>
						d.model === model &&
						Number(d.year) === fiscalYear &&
						d.period === period,
				);
				if (row?.status === "completed") continue;

				alerts.push({
					id: `${model}-${fiscalYear}-${period}`,
					model,
					year: fiscalYear,
					period,
					title: `Modelo ${model} · ${period} ${fiscalYear}`,
					windowTitle: title,
					deadlineEnd: end,
					daysLeft: Math.ceil((startOfDay(end) - today) / 86400000),
				});
			}
		}
	}

	return alerts;
};

/** Eventos all-day para inyectar en appointments (type=tax_deadline). */
export const buildTaxCalendarEvents = (fiscalYear, clinicId, userId) => {
	return TAX_DEADLINE_WINDOWS.map((window) => {
		const { start, end, title } = window.getRange(fiscalYear);
		const endExclusive = new Date(end);
		endExclusive.setDate(endExclusive.getDate() + 1);
		return {
			user_id: userId,
			clinic_id: clinicId,
			title,
			start_at: start.toISOString(),
			end_at: endExclusive.toISOString(),
			all_day: true,
			type: "tax_deadline",
			status: "scheduled",
			notes: `Plazo AEAT ${window.id} · modelos ${window.models.join(", ")} · ejercicio ${fiscalYear}`,
			activo: true,
		};
	});
};
