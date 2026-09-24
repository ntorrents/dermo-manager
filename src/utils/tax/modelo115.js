import { filterByQuarter, round2, toBaseAmount } from "./quarters";
import { countUniquePerceptors } from "./perceptors";

/**
 * Modelo 115 — Retenciones alquiler, trimestre AISLADO.
 * Solo gastos con withholding_kind = '115' (o legacy: irpf > 0 y category contiene alquiler).
 */
export const isAlquilerWithholding = (entry) => {
	if (!entry || entry.type !== "expense") return false;
	const amount = Number(entry.irpf_amount) || 0;
	if (amount <= 0) return false;
	if (entry.withholding_kind === "115") return true;
	if (entry.withholding_kind === "111") return false;
	const cat = `${entry.category || ""} ${entry.description || ""}`.toLowerCase();
	return cat.includes("alquiler") || cat.includes("renta local") || cat.includes("arrend");
};

export const computeModelo115 = (entries, year, quarter) => {
	const quarterEntries = filterByQuarter(entries, year, quarter);
	const rows = quarterEntries.filter(isAlquilerWithholding);

	const baseRetenciones = round2(rows.reduce((acc, e) => acc + toBaseAmount(e), 0));
	const retenciones = round2(
		rows.reduce((acc, e) => acc + (Number(e.irpf_amount) || 0), 0),
	);
	const perceptores = countUniquePerceptors(rows);

	return {
		mode: "isolated",
		year,
		quarter,
		baseRetenciones,
		retenciones,
		perceptores,
		audit: { expenses: rows },
		boxes: [
			{
				id: "01",
				label: "Nº de perceptores (NIF/proveedor únicos)",
				value: perceptores,
			},
			{ id: "02", label: "Base de las retenciones", value: baseRetenciones },
			{ id: "03", label: "Retenciones e ingresos a cuenta", value: retenciones },
		],
		resultAmount: retenciones,
	};
};

/** Modelo 111 (informativo): retenciones profesionales del trimestre. */
export const computeModelo111Legacy = (entries, year, quarter) => {
	const quarterEntries = filterByQuarter(entries, year, quarter);
	const rows = quarterEntries.filter((e) => {
		if (e.type !== "expense") return false;
		const amount = Number(e.irpf_amount) || 0;
		if (amount <= 0) return false;
		return !isAlquilerWithholding(e);
	});
	const total = round2(rows.reduce((acc, e) => acc + (Number(e.irpf_amount) || 0), 0));
	return { total, rows };
};
