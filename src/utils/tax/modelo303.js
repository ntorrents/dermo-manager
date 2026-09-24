import { filterByQuarter, round2, toBaseAmount } from "./quarters";

/**
 * Casilla 110 del trimestre T = crédito pendiente del T-1:
 * casilla 87 anterior + |casilla 71| si el T-1 quedó a compensar.
 */
export const getCasilla110FromPrevious = (entries, year, quarter, declarations = []) => {
	if (quarter <= 1) {
		return { amount: 0, source: null, previousPeriod: null };
	}
	const previousPeriod = `T${quarter - 1}`;
	const prev = computeModelo303(entries, year, quarter - 1, declarations);
	const fromPendiente = Number(prev.casilla87) || 0;
	const fromResultadoNeg =
		Number(prev.resultado) < 0 ? Math.abs(Number(prev.resultado)) : 0;
	const amount = round2(fromPendiente + fromResultadoNeg);
	return { amount, source: prev, previousPeriod };
};

/**
 * Modelo 303 — IVA trimestral AISLADO (flujo AEAT de compensación).
 *
 * 66 = 27 − 45
 * 78 = min(66, 110) si 66 > 0; si no 0
 * 71 = 66 − 78
 * 87 = 110 − 78
 */
export const computeModelo303 = (entries, year, quarter, declarations = []) => {
	const quarterEntries = filterByQuarter(entries, year, quarter);
	const incomes = quarterEntries.filter((e) => e.type === "income" && !e.plan_amigo);
	const expenses = quarterEntries.filter(
		(e) => e.type === "expense" && e.is_deductible === true,
	);

	const casilla27 = round2(
		incomes.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
	);
	const casilla45 = round2(
		expenses.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
	);
	const resultadoTrimestre = round2(casilla27 - casilla45); // Casilla 66

	const { amount: casilla110, previousPeriod } = getCasilla110FromPrevious(
		entries,
		year,
		quarter,
		declarations,
	);

	const casilla78 =
		resultadoTrimestre > 0
			? round2(Math.min(resultadoTrimestre, casilla110))
			: 0;

	const casilla71 = round2(resultadoTrimestre - casilla78);
	const casilla87 = round2(casilla110 - casilla78);

	const baseRepercutida = round2(incomes.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const baseSoportada = round2(expenses.reduce((acc, e) => acc + toBaseAmount(e), 0));

	return {
		mode: "isolated",
		year,
		quarter,
		baseRepercutida,
		baseSoportada,
		// aliases / AEAT
		ivaRepercutido: casilla27,
		ivaSoportado: casilla45,
		casilla27,
		casilla45,
		casilla66: resultadoTrimestre,
		resultadoTrimestre,
		diferencia: resultadoTrimestre,
		casilla110,
		casilla78,
		casilla71,
		casilla87,
		previousPeriod,
		resultado: casilla71, // lo que se presenta / guarda en tax_declarations
		audit: { incomes, expenses },
		boxes: [
			{ id: "07", label: "Base imponible IVA repercutido", value: baseRepercutida },
			{ id: "27", label: "Cuota devengada (IVA repercutido)", value: casilla27 },
			{ id: "28", label: "Base IVA soportado", value: baseSoportada },
			{ id: "45", label: "Total a deducir (IVA soportado)", value: casilla45 },
			{ id: "66", label: "Resultado del periodo (27 − 45)", value: resultadoTrimestre },
			{
				id: "110",
				label: "Cuotas a compensar de periodos anteriores",
				value: casilla110,
			},
			{
				id: "78",
				label: "Cuotas a compensar aplicadas en este periodo",
				value: casilla78,
			},
			{ id: "71", label: "Resultado liquidación (a ingresar / a compensar)", value: casilla71 },
			{
				id: "87",
				label: "Cuotas pendientes para periodos posteriores",
				value: casilla87,
			},
		],
	};
};
