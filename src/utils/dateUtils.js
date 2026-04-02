export const getQuarter = (date) => {
	const d = new Date(date);
	return Math.floor((d.getMonth() + 3) / 3);
};

export const filterByDate = (items, dateField, viewMode, currentDateStr) => {
	if (!items || items.length === 0) return [];

	const targetDate = new Date(currentDateStr); // "2026-02"
	const targetYear = targetDate.getFullYear();
	const targetMonth = targetDate.getMonth(); // 0-11
	const targetQuarter = Math.floor((targetMonth + 3) / 3);

	return items.filter((item) => {
		const itemDate = new Date(item[dateField]);
		const itemYear = itemDate.getFullYear();
		const itemMonth = itemDate.getMonth();
		const itemQuarter = Math.floor((itemMonth + 3) / 3);

		if (viewMode === "year") {
			return itemYear === targetYear;
		}

		if (viewMode === "quarter") {
			return itemYear === targetYear && itemQuarter === targetQuarter;
		}

		// Default: Month
		return itemYear === targetYear && itemMonth === targetMonth;
	});
};

export const getDateLabel = (currentDateStr, viewMode) => {
	const date = new Date(currentDateStr);
	const year = date.getFullYear();

	// Nombres de meses en español
	const monthNames = [
		"Enero",
		"Febrero",
		"Marzo",
		"Abril",
		"Mayo",
		"Junio",
		"Julio",
		"Agosto",
		"Septiembre",
		"Octubre",
		"Noviembre",
		"Diciembre",
	];

	if (viewMode === "year") return `Año ${year}`;
	if (viewMode === "quarter") {
		const q = Math.floor((date.getMonth() + 3) / 3);
		return `Trimestre ${q} • ${year}`;
	}
	// Month
	return `${monthNames[date.getMonth()]} ${year}`;
};

const toYmd = (d) => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
};

const monthNamesShort = [
	"ene",
	"feb",
	"mar",
	"abr",
	"may",
	"jun",
	"jul",
	"ago",
	"sep",
	"oct",
	"nov",
	"dic",
];

/**
 * Rango de fechas para informes + mes de referencia (YYYY-MM) para gastos fijos.
 * preset: month | quarter | calendar_year | rolling_12 | custom
 * anchorYm: "YYYY-MM" para presets no personalizados
 */
export function getReportingRange(preset, anchorYm, customFrom, customTo) {
	const parts = (anchorYm || "").split("-").map(Number);
	const y = parts[0] || new Date().getFullYear();
	const m = parts[1] || new Date().getMonth() + 1;

	if (preset === "custom" && customFrom && customTo) {
		const df = new Date(customFrom + "T12:00:00");
		const dt = new Date(customTo + "T12:00:00");
		const label = `${df.getDate()} ${monthNamesShort[df.getMonth()]} ${df.getFullYear()} – ${dt.getDate()} ${monthNamesShort[dt.getMonth()]} ${dt.getFullYear()}`;
		return {
			start: customFrom,
			end: customTo,
			label,
			preset,
			refMonthYm: customTo.slice(0, 7),
			anchorMonthYm: anchorYm || customTo.slice(0, 7),
		};
	}

	if (preset === "month") {
		const start = new Date(y, m - 1, 1);
		const end = new Date(y, m, 0);
		const label = `${getDateLabel(`${y}-${String(m).padStart(2, "0")}-01`, "month")}`;
		return {
			start: toYmd(start),
			end: toYmd(end),
			label,
			preset,
			refMonthYm: `${y}-${String(m).padStart(2, "0")}`,
			anchorMonthYm: `${y}-${String(m).padStart(2, "0")}`,
		};
	}

	if (preset === "quarter") {
		const q0 = Math.floor((m - 1) / 3);
		const start = new Date(y, q0 * 3, 1);
		const end = new Date(y, q0 * 3 + 3, 0);
		const label = `Trimestre ${q0 + 1} · ${y}`;
		return {
			start: toYmd(start),
			end: toYmd(end),
			label,
			preset,
			refMonthYm: toYmd(end).slice(0, 7),
			anchorMonthYm: anchorYm,
		};
	}

	if (preset === "calendar_year") {
		const start = new Date(y, 0, 1);
		const end = new Date(y, 11, 31);
		return {
			start: toYmd(start),
			end: toYmd(end),
			label: String(y),
			preset,
			refMonthYm: `${y}-12`,
			anchorMonthYm: anchorYm,
		};
	}

	// rolling_12
	const end = new Date();
	const start = new Date();
	start.setFullYear(start.getFullYear() - 1);
	start.setDate(start.getDate() + 1);
	return {
		start: toYmd(start),
		end: toYmd(end),
		label: "Últimos 12 meses",
		preset,
		refMonthYm: toYmd(end).slice(0, 7),
		anchorMonthYm: toYmd(end).slice(0, 7),
	};
}

export function filterByReportingRange(items, dateField, startStr, endStr) {
	if (!items?.length || !startStr || !endStr) return [];
	const start = new Date(startStr + "T00:00:00");
	const end = new Date(endStr + "T23:59:59");
	return items.filter((item) => {
		const raw = item[dateField];
		if (!raw) return false;
		const d = new Date(typeof raw === "string" ? raw : raw);
		return !Number.isNaN(d.getTime()) && d >= start && d <= end;
	});
}

/**
 * Calcula la edad en años a partir de la fecha de nacimiento (string YYYY-MM-DD o Date).
 * Devuelve null si no hay fecha o no es válida.
 */
export const getAge = (fechaNacimiento) => {
	if (!fechaNacimiento) return null;
	const birth = new Date(fechaNacimiento);
	if (Number.isNaN(birth.getTime())) return null;
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age -= 1;
	}
	return age >= 0 ? age : null;
};
