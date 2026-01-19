// /Users/nilto/Documents/GitHub/DermoManager/src/utils/format.js

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
