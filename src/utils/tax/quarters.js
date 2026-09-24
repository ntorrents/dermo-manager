/** Helpers de fechas fiscales (trimestres AEAT España). */

export const QUARTER_LABELS = {
	1: "T1",
	2: "T2",
	3: "T3",
	4: "T4",
};

export const getQuarterDateRange = (year, quarter) => {
	const startMonth = (quarter - 1) * 3;
	const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
	const endMonth = quarter * 3;
	const endDay = new Date(year, endMonth, 0).getDate();
	const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
	return { startDate, endDate };
};

/** YTD: 1 ene del año → último día del trimestre. */
export const getYtdDateRange = (year, quarter) => {
	const { endDate } = getQuarterDateRange(year, quarter);
	return { startDate: `${year}-01-01`, endDate };
};

export const getYearDateRange = (year) => ({
	startDate: `${year}-01-01`,
	endDate: `${year}-12-31`,
});

export const filterByDateRange = (entries, startDate, endDate) => {
	if (!entries?.length) return [];
	return entries.filter((e) => e.date >= startDate && e.date <= endDate);
};

export const filterByQuarter = (entries, year, quarter) => {
	const { startDate, endDate } = getQuarterDateRange(year, quarter);
	return filterByDateRange(entries, startDate, endDate);
};

export const filterYtd = (entries, year, quarter) => {
	const { startDate, endDate } = getYtdDateRange(year, quarter);
	return filterByDateRange(entries, startDate, endDate);
};

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const toBaseAmount = (entry) => {
	const base = Number(entry?.tax_base);
	if (Number.isFinite(base)) return base;
	const fallback = Number(entry?.base_amount ?? entry?.amount);
	return Number.isFinite(fallback) ? fallback : 0;
};

export const parseISODate = (value) => {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
};

export const clampRate = (value) => {
	const rate = Number(value);
	if (!Number.isFinite(rate) || rate <= 0) return 26;
	return rate;
};

export const diffDaysInclusive = (start, end) => {
	const MS_PER_DAY = 24 * 60 * 60 * 1000;
	return Math.max(0, Math.floor((end - start) / MS_PER_DAY) + 1);
};

export const INVESTMENT_MIN_BASE = 300;

export const isEffectiveInvestment = (entry) => {
	if (!entry || entry.type !== "expense" || entry.is_deductible !== true) return false;
	if (entry.is_investment !== true) return false;
	return toBaseAmount(entry) > INVESTMENT_MIN_BASE;
};

/** Amortización deducible entre startDate y endDate (ambos inclusive, YYYY-MM-DD). */
export const computeAmortizationInRange = (entries, startDate, endDate) => {
	const rangeStart = parseISODate(startDate);
	const rangeEnd = parseISODate(endDate);
	if (!rangeStart || !rangeEnd) return { total: 0, assets: [] };

	const assets = (entries || [])
		.filter((e) => isEffectiveInvestment(e))
		.map((asset) => {
			const purchaseDate = parseISODate(asset.date);
			if (!purchaseDate) return null;

			const base = toBaseAmount(asset);
			const rate = clampRate(asset.amortization_rate);
			const totalLifeDays = Math.max(1, Math.ceil((100 / rate) * 365));
			const amortEndDate = new Date(purchaseDate);
			amortEndDate.setDate(amortEndDate.getDate() + totalLifeDays - 1);

			const activeStart = purchaseDate > rangeStart ? purchaseDate : new Date(rangeStart);
			const activeEnd = amortEndDate < rangeEnd ? amortEndDate : new Date(rangeEnd);
			const activeDays =
				activeStart <= activeEnd ? diffDaysInclusive(activeStart, activeEnd) : 0;

			const dailyQuota = (base * rate) / 100 / 365;
			const deduced = dailyQuota * activeDays;

			return {
				id: asset.id,
				description: asset.description || "Bien sin descripción",
				date: asset.date,
				base,
				rate,
				deduced,
				entry: asset,
			};
		})
		.filter(Boolean)
		.filter((a) => a.deduced > 0);

	const total = assets.reduce((acc, a) => acc + a.deduced, 0);
	return { total, assets };
};
