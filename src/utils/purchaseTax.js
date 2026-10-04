import { calculateTaxFromTotal } from "./format";

/**
 * Desglose de compra según si el importe introducido lleva IVA incluido o no.
 * @param {{ amountInput: number|string, taxRate?: number, priceMode?: 'included'|'excluded', isDeductible?: boolean }} opts
 */
export function resolvePurchaseAmounts({
	amountInput,
	taxRate = 21,
	priceMode = "included",
	isDeductible = true,
}) {
	const amount = Number(amountInput) || 0;
	const rate = isDeductible ? Number(taxRate) || 0 : 0;

	if (!isDeductible || rate <= 0) {
		const total = Math.round(amount * 100) / 100;
		return { baseAmount: total, taxAmount: 0, totalAmount: total, taxRate: 0 };
	}

	if (priceMode === "excluded") {
		const baseAmount = Math.round(amount * 100) / 100;
		const taxAmount = Math.round(((baseAmount * rate) / 100) * 100) / 100;
		const totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;
		return { baseAmount, taxAmount, totalAmount, taxRate: rate };
	}

	const { baseAmount, taxAmount } = calculateTaxFromTotal(amount, rate);
	const totalAmount = Math.round(amount * 100) / 100;
	return { baseAmount, taxAmount, totalAmount, taxRate: rate };
}
