import { filterByQuarter, round2, toBaseAmount } from "./quarters";

/**
 * Crédito a arrastrar al siguiente trimestre (= próxima Casilla 110):
 * Casilla 87 + |Casilla 71| si el resultado quedó a compensar.
 */
export const creditCarryFrom303 = ({ casilla71, casilla87 }) => {
	const pendiente = Number(casilla87) || 0;
	const resultado = Number(casilla71) || 0;
	const fromNeg = resultado < 0 ? Math.abs(resultado) : 0;
	return round2(pendiente + fromNeg);
};

/**
 * Casilla 110 del trimestre T:
 * 1) Si T-1 está completed en tax_declarations → credit_carry_amount inmutable.
 * 2) Si no → recálculo en cadena (estimado; avisar en UI).
 */
export const getCasilla110FromPrevious = (entries, year, quarter, declarations = []) => {
	if (quarter <= 1) {
		return {
			amount: 0,
			source: null,
			previousPeriod: null,
			estimated: false,
		};
	}

	const previousPeriod = `T${quarter - 1}`;
	const stored = (declarations || []).find(
		(d) =>
			d.model === "303" &&
			Number(d.year) === Number(year) &&
			d.period === previousPeriod &&
			d.status === "completed",
	);

	if (stored) {
		if (stored.credit_carry_amount != null && stored.credit_carry_amount !== "") {
			return {
				amount: round2(Number(stored.credit_carry_amount)),
				source: "presented",
				previousPeriod,
				estimated: false,
			};
		}
		// Presentaciones anteriores a credit_carry_amount: solo teníamos Casilla 71.
		const r = Number(stored.result_amount) || 0;
		return {
			amount: r < 0 ? round2(Math.abs(r)) : 0,
			source: "presented_legacy",
			previousPeriod,
			estimated: false,
		};
	}

	const prev = computeModelo303(entries, year, quarter - 1, declarations);
	return {
		amount: creditCarryFrom303({
			casilla71: prev.resultado,
			casilla87: prev.casilla87,
		}),
		source: "estimated",
		previousPeriod,
		estimated: true,
	};
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

	const {
		amount: casilla110,
		previousPeriod,
		source: casilla110Source,
		estimated: casilla110Estimated,
	} = getCasilla110FromPrevious(entries, year, quarter, declarations);

	const casilla78 =
		resultadoTrimestre > 0
			? round2(Math.min(resultadoTrimestre, casilla110))
			: 0;

	const casilla71 = round2(resultadoTrimestre - casilla78);
	const casilla87 = round2(casilla110 - casilla78);
	const creditCarryAmount = creditCarryFrom303({
		casilla71,
		casilla87,
	});

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
		casilla110Source,
		casilla110Estimated: Boolean(casilla110Estimated),
		casilla78,
		casilla71,
		casilla87,
		creditCarryAmount,
		previousPeriod,
		resultado: casilla71, // lo que se presenta / guarda en tax_declarations.result_amount
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
