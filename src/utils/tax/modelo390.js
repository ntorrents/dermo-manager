import { computeModelo303 } from "./modelo303";
import { isAlquilerWithholding } from "./modelo115";
import { filterByDateRange, getYearDateRange, round2, toBaseAmount } from "./quarters";

/** Modelo 390 — resumen anual IVA (suma de los 4 trimestres). */
export const computeModelo390 = (entries, year, declarations = []) => {
	const quarters = [1, 2, 3, 4].map((q) =>
		computeModelo303(entries, year, q, declarations),
	);
	const ivaRepercutido = round2(quarters.reduce((a, q) => a + q.ivaRepercutido, 0));
	const ivaSoportado = round2(quarters.reduce((a, q) => a + q.ivaSoportado, 0));
	const casilla110Total = round2(quarters.reduce((a, q) => a + (q.casilla110 || 0), 0));
	const resultado = round2(quarters.reduce((a, q) => a + q.resultado, 0));

	return {
		mode: "annual",
		year,
		quarters,
		ivaRepercutido,
		ivaSoportado,
		casilla110Total,
		resultado,
		boxes: [
			{ id: "99", label: "Total cuotas IVA repercutido (año)", value: ivaRepercutido },
			{ id: "103", label: "Total cuotas IVA soportado (año)", value: ivaSoportado },
			{
				id: "110",
				label: "Total cuotas compensadas (suma casillas 110)",
				value: casilla110Total,
			},
			{ id: "resultado", label: "Resultado neto anual liquidado", value: resultado },
		],
	};
};

/** Modelo 180 — resumen anual retenciones alquiler (115). */
export const computeModelo180 = (entries, year) => {
	const { startDate, endDate } = getYearDateRange(year);
	const yearEntries = filterByDateRange(entries, startDate, endDate);
	const rows = yearEntries.filter(isAlquilerWithholding);
	const base = round2(rows.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const retenciones = round2(
		rows.reduce((acc, e) => acc + (Number(e.irpf_amount) || 0), 0),
	);

	return {
		mode: "annual",
		year,
		base,
		retenciones,
		audit: { expenses: rows },
		boxes: [
			{ id: "01", label: "Nº de perceptores (líneas)", value: rows.length },
			{ id: "02", label: "Base retenciones anuales", value: base },
			{ id: "03", label: "Retenciones anuales a declarar", value: retenciones },
		],
		resultAmount: retenciones,
	};
};
