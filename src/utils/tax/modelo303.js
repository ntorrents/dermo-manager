import { filterByQuarter, round2, toBaseAmount } from "./quarters";

/**
 * Casilla 110: cuotas a compensar del trimestre anterior (result_amount negativo + completed).
 */
export const getCasilla110FromPrevious = (year, quarter, declarations = []) => {
	if (quarter <= 1) {
		return { amount: 0, source: null, previousPeriod: null };
	}
	const previousPeriod = `T${quarter - 1}`;
	const prev = (declarations || []).find(
		(d) =>
			d.model === "303" &&
			Number(d.year) === Number(year) &&
			d.period === previousPeriod &&
			d.status === "completed" &&
			d.result_amount != null,
	);
	if (!prev) {
		return { amount: 0, source: null, previousPeriod };
	}
	const raw = Number(prev.result_amount) || 0;
	// Solo se compensa si el resultado anterior fue a favor (negativo = a compensar)
	const amount = raw < 0 ? round2(Math.abs(raw)) : 0;
	return { amount, source: prev, previousPeriod };
};

/**
 * Modelo 303 — IVA trimestral AISLADO.
 * Casilla 71 = (repercutido − soportado) − Casilla 110.
 */
export const computeModelo303 = (entries, year, quarter, declarations = []) => {
	const quarterEntries = filterByQuarter(entries, year, quarter);
	const incomes = quarterEntries.filter((e) => e.type === "income" && !e.plan_amigo);
	const expenses = quarterEntries.filter(
		(e) => e.type === "expense" && e.is_deductible === true,
	);

	const ivaRepercutido = round2(
		incomes.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
	);
	const ivaSoportado = round2(
		expenses.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
	);
	const diferencia = round2(ivaRepercutido - ivaSoportado);

	const { amount: casilla110, previousPeriod } = getCasilla110FromPrevious(
		year,
		quarter,
		declarations,
	);
	const resultado = round2(diferencia - casilla110);

	const baseRepercutida = round2(incomes.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const baseSoportada = round2(expenses.reduce((acc, e) => acc + toBaseAmount(e), 0));

	return {
		mode: "isolated",
		year,
		quarter,
		baseRepercutida,
		ivaRepercutido,
		baseSoportada,
		ivaSoportado,
		diferencia,
		casilla110,
		previousPeriod,
		resultado,
		audit: { incomes, expenses },
		boxes: [
			{ id: "07", label: "Base imponible IVA repercutido", value: baseRepercutida },
			{ id: "08", label: "Cuota IVA repercutido", value: ivaRepercutido },
			{ id: "28", label: "Base IVA soportado", value: baseSoportada },
			{ id: "29", label: "Cuota IVA soportado", value: ivaSoportado },
			{
				id: "110",
				label: "Cuotas a compensar de periodos anteriores",
				value: casilla110,
			},
			{ id: "71", label: "Resultado liquidación (a ingresar / a compensar)", value: resultado },
		],
	};
};
