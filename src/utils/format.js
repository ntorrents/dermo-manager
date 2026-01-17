// /Users/nilto/Documents/GitHub/DermoManager/src/utils/format.js
export const formatCurrency = (amount) =>
	new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(amount);
