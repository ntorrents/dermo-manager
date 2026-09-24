import {
	computeAmortizationInRange,
	filterYtd,
	getYtdDateRange,
	isEffectiveInvestment,
	round2,
	toBaseAmount,
} from "./quarters";

const incomeFilter = (e) => e.type === "income" && !e.plan_amigo;
const deductibleExpenseFilter = (e) =>
	e.type === "expense" && e.is_deductible === true && !isEffectiveInvestment(e);

/**
 * Modelo 130 — Estimación Directa, acumulativo YTD.
 * Casillas aproximadas: 01 ingresos, 02 gastos, 03 neto, 07 pagos previos, 19 resultado.
 *
 * @param {object[]} entries finance_entries
 * @param {number} year
 * @param {number} quarter 1-4
 * @param {object[]} declarations filas tax_declarations del clinic (model 130)
 */
export const computeModelo130 = (entries, year, quarter, declarations = []) => {
	const { startDate, endDate } = getYtdDateRange(year, quarter);
	const ytdEntries = filterYtd(entries, year, quarter);
	const incomes = ytdEntries.filter(incomeFilter);
	const expenses = ytdEntries.filter(deductibleExpenseFilter);
	const { total: amortizacion, assets: amortAssets } = computeAmortizationInRange(
		entries,
		startDate,
		endDate,
	);

	const casilla01 = round2(incomes.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const gastosBase = round2(expenses.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const casilla02 = round2(gastosBase + amortizacion);
	const casilla03 = round2(casilla01 - casilla02);

	const retencionesSoportadas = round2(
		incomes.reduce((acc, e) => acc + (Number(e.irpf_amount) || 0), 0),
	);

	const cuotaIntegra = casilla03 > 0 ? round2(casilla03 * 0.2) : 0;
	const cuotaTrasRetenciones = Math.max(0, round2(cuotaIntegra - retencionesSoportadas));

	// Pagos trimestres anteriores (T1..T-1)
	const previousPayments = [];
	let casilla07 = 0;
	for (let q = 1; q < quarter; q++) {
		const period = `T${q}`;
		const stored = (declarations || []).find(
			(d) =>
				d.model === "130" &&
				Number(d.year) === Number(year) &&
				d.period === period &&
				d.status === "completed" &&
				d.result_amount != null,
		);
		let amount;
		let source;
		if (stored) {
			amount = round2(stored.result_amount);
			source = "presented";
		} else {
			const prev = computeModelo130(entries, year, q, declarations);
			amount = prev.casilla19;
			source = "estimated";
		}
		previousPayments.push({ quarter: q, period, amount, source });
		casilla07 = round2(casilla07 + amount);
	}

	const casilla19 = Math.max(0, round2(cuotaTrasRetenciones - casilla07));

	return {
		mode: "ytd",
		year,
		quarter,
		startDate,
		endDate,
		casilla01,
		casilla02,
		casilla03,
		cuotaIntegra,
		retencionesSoportadas,
		casilla07,
		casilla19,
		previousPayments,
		audit: {
			incomes,
			expenses,
			amortAssets,
			amortizacion: round2(amortizacion),
		},
		boxes: [
			{ id: "01", label: "Ingresos computables", value: casilla01 },
			{ id: "02", label: "Gastos deducibles (incl. amortización)", value: casilla02 },
			{ id: "03", label: "Rendimiento neto", value: casilla03 },
			{ id: "04", label: "Cuota íntegra (20%)", value: cuotaIntegra },
			{
				id: "06",
				label: "Retenciones soportadas (ingresos B2B)",
				value: retencionesSoportadas,
			},
			{ id: "07", label: "A deducir trimestres anteriores", value: casilla07 },
			{ id: "19", label: "Resultado a ingresar", value: casilla19 },
		],
	};
};
