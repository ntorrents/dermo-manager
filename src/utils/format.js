// /Users/nilto/Documents/GitHub/DermoManager/src/utils/format.js

export const IVA_OPTIONS = [0, 4, 10, 21];
export const IRPF_OPTIONS = [0, 7, 15, 19];

export const calculateTaxFromTotal = (totalAmount, taxRate = 0) => {
	const amount = Number(totalAmount) || 0;
	const rate = Number(taxRate) || 0;
	if (amount <= 0) return { baseAmount: 0, taxAmount: 0 };
	const baseAmount = Math.round((amount / (1 + rate / 100)) * 100) / 100;
	const taxAmount = Math.round((amount - baseAmount) * 100) / 100;
	return { baseAmount, taxAmount };
};

export const formatCurrency = (amount) =>
	new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);

// ESTA ES LA FUNCIÓN QUE FALTABA
export const formatDate = (dateString) => {
	if (!dateString) return "-";
	const date = new Date(dateString);
	// Devuelve formato tipo "18 ene 2024"
	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
};
