/** Totales de caja para un día (YYYY-MM-DD). */
export function computeDailyCashClose(entries = [], dateYmd) {
	if (!dateYmd) {
		return {
			date: "",
			incomeTotal: 0,
			expenseTotal: 0,
			netCash: 0,
			incomeCount: 0,
			expenseCount: 0,
		};
	}
	const dayEntries = (entries || []).filter((e) => e.date === dateYmd);
	const incomes = dayEntries.filter((e) => e.type === "income");
	const expenses = dayEntries.filter((e) => e.type === "expense");
	const incomeTotal = incomes.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
	const expenseTotal = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
	return {
		date: dateYmd,
		incomeTotal,
		expenseTotal,
		netCash: incomeTotal - expenseTotal,
		incomeCount: incomes.length,
		expenseCount: expenses.length,
	};
}

export const FINANCE_CASH_COUNT_PREFIX = "financeCashCount.";

export function loadCashCountForDate(dateYmd) {
	if (!dateYmd || typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(`${FINANCE_CASH_COUNT_PREFIX}${dateYmd}`);
		if (raw == null || raw === "") return null;
		const n = Number(raw);
		return Number.isFinite(n) ? n : null;
	} catch {
		return null;
	}
}

export function saveCashCountForDate(dateYmd, value) {
	if (!dateYmd || typeof localStorage === "undefined") return;
	try {
		if (value == null || value === "") {
			localStorage.removeItem(`${FINANCE_CASH_COUNT_PREFIX}${dateYmd}`);
		} else {
			localStorage.setItem(`${FINANCE_CASH_COUNT_PREFIX}${dateYmd}`, String(value));
		}
	} catch {
		/* ignore */
	}
}
