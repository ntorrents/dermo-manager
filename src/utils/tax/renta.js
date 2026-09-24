import { computeModelo130 } from "./modelo130";
import {
	computeAmortizationInRange,
	filterByDateRange,
	getYearDateRange,
	isEffectiveInvestment,
	round2,
	toBaseAmount,
} from "./quarters";

/** Detecta gastos de cuota RETA / Seguridad Social / autónomos. */
export const isRetaExpense = (entry) => {
	if (!entry || entry.type !== "expense") return false;
	if (entry.is_deductible !== true) return false;
	const cat = `${entry.category || ""} ${entry.description || ""} ${entry.notes || ""}`.toLowerCase();
	return (
		cat.includes("autónom") ||
		cat.includes("autonom") ||
		cat.includes("reta") ||
		cat.includes("seguridad social") ||
		cat.includes("ss ") ||
		cat.includes(" cuota ss") ||
		cat.includes("cuota ss") ||
		/\bsss?\b/.test(cat)
	);
};

/**
 * Preparación Modelo 100 / Renta — checks informativos.
 */
export const computePreparacionRenta = (entries, year, declarations = []) => {
	const { startDate, endDate } = getYearDateRange(year);
	const yearEntries = filterByDateRange(entries, startDate, endDate);
	const incomes = yearEntries.filter((e) => e.type === "income" && !e.plan_amigo);
	const expenses = yearEntries.filter(
		(e) => e.type === "expense" && e.is_deductible === true && !isEffectiveInvestment(e),
	);
	const { total: amortizacion } = computeAmortizationInRange(entries, startDate, endDate);

	const ingresos = round2(incomes.reduce((a, e) => a + toBaseAmount(e), 0));
	const gastos = round2(
		expenses.reduce((a, e) => a + toBaseAmount(e), 0) + amortizacion,
	);
	const beneficioNeto = round2(ingresos - gastos);

	const pagosFraccionados = [1, 2, 3, 4].map((q) => {
		const period = `T${q}`;
		const stored = (declarations || []).find(
			(d) =>
				d.model === "130" &&
				Number(d.year) === Number(year) &&
				d.period === period &&
				d.status === "completed" &&
				d.result_amount != null,
		);
		if (stored) {
			return {
				quarter: q,
				period,
				amount: round2(stored.result_amount),
				source: "presented",
			};
		}
		const calc = computeModelo130(entries, year, q, declarations);
		return { quarter: q, period, amount: calc.casilla19, source: "estimated" };
	});

	const totalPagos130 = round2(pagosFraccionados.reduce((a, p) => a + p.amount, 0));

	const retencionesSoportadas = round2(
		incomes.reduce((a, e) => a + (Number(e.irpf_amount) || 0), 0),
	);

	const retaRows = yearEntries.filter(isRetaExpense);
	const cuotasReta = round2(retaRows.reduce((a, e) => a + toBaseAmount(e), 0));

	return {
		year,
		check1: {
			label: "Pagos fraccionados (suma Casillas 19 de los M130)",
			total: totalPagos130,
			detail: pagosFraccionados,
			hint: "Revisa que en tu borrador de la Renta, Hacienda te haya puesto exactamente esta cantidad en el apartado de pagos fraccionados previos.",
		},
		check2: {
			label: "Beneficio neto real (ingresos − gastos deducibles)",
			ingresos,
			gastos,
			beneficioNeto,
		},
		check3: {
			label: "Retenciones soportadas / aplicadas en ingresos",
			retencionesSoportadas,
		},
		check4: {
			label: "Cuotas RETA (Autónomos)",
			total: cuotasReta,
			rows: retaRows,
			hint: "Revisa que Hacienda haya incluido estas cuotas como gasto deducible en la actividad económica de tu borrador.",
		},
	};
};
