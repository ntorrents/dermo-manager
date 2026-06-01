import { calculateTaxReverse } from "./calculations";
import { validateSpanishTaxId } from "./validations";

export const DEFAULT_ESTETIC_TAX_RATE = 21;
export const DEFAULT_COMPANY_IRPF_RATE = 7;

/** IVA % del tratamiento (21 estética, 0 sanitario exento). */
export const getTreatmentTaxRate = (treatment) => {
	const rate = Number(treatment?.tax_rate);
	if (Number.isFinite(rate) && rate >= 0) return rate;
	return DEFAULT_ESTETIC_TAX_RATE;
};

/** Retención IRPF en facturas emitidas (0 si no es empresa). */
export const resolveClientIrpfRate = (client) => {
	if (!client?.is_company) return 0;
	const custom = client.irpf_withholding_rate;
	if (custom != null && custom !== "" && Number.isFinite(Number(custom))) {
		return Number(custom);
	}
	return DEFAULT_COMPANY_IRPF_RATE;
};

/**
 * Precio del tratamiento = PVP (lo que cobras al particular, IVA incluido).
 * 1) Base y cuota IVA se extraen del PVP (igual que siempre en el ERP).
 * 2) Si es empresa, retención IRPF sobre la base y se resta del total a cobrar.
 *
 * Ej. PVP 100 €, IVA 21 % → base ~82,64 €, particular paga 100 €.
 * Ej. PVP 50 €, IVA 0 %, empresa 7 % → base 50 €, ret. 3,50 €, cobras 46,50 €.
 */
export const calculateIncomeFromPvp = (pvp, taxRate = 21, irpfRate = 0) => {
	const totalPvp = Math.round((Number(pvp) || 0) * 100) / 100;
	if (totalPvp <= 0) {
		return { baseAmount: 0, taxAmount: 0, irpfAmount: 0, totalAmount: 0, pvp: 0 };
	}
	const iva = Number(taxRate) || 0;
	const irpf = Number(irpfRate) || 0;
	const { baseAmount, taxAmount } = calculateTaxReverse(totalPvp, iva);
	const irpfAmount =
		irpf > 0 ? Math.round(baseAmount * (irpf / 100) * 100) / 100 : 0;
	const totalAmount = Math.round((totalPvp - irpfAmount) * 100) / 100;
	return {
		baseAmount,
		taxAmount,
		irpfAmount,
		totalAmount,
		pvp: totalPvp,
	};
};

/** Alias histórico: el importe es el PVP, no la base. */
export const calculateIncomeFromTotal = calculateIncomeFromPvp;
export const calculateIncomeFromBase = calculateIncomeFromPvp;

/** Sugerencia: CIF suele ser empresa. */
export const inferIsCompanyFromNif = (nif) => {
	const v = validateSpanishTaxId(nif);
	return v.valid && v.type === "CIF";
};

export const taxRateLabel = (rate) => {
	const r = Number(rate);
	if (r === 0) return "Exento (sanitario)";
	if (r === 21) return "Estético (21 %)";
	return `${r} % IVA`;
};
