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
