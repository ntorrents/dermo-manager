import { validateSpanishTaxId } from "./validations";

export const classifyFinanceIssue = (entry) => {
	if (!entry || entry.type !== "expense" || entry.is_deductible !== true) return null;
	if (!(entry.invoice_number || "").trim()) return "missing_invoice";
	if (!(entry.supplier_nif || "").trim()) return "missing_nif";
	const nif = (entry.supplier_nif || "").trim();
	if (nif && !validateSpanishTaxId(nif).valid) return "invalid_nif";
	if (!(entry.file_url || "").trim()) return "missing_attachment";
	return null;
};

export const financeIssueLabel = (issue) => {
	switch (issue) {
		case "missing_invoice":
			return "Sin nº factura";
		case "missing_nif":
			return "Sin NIF proveedor";
		case "invalid_nif":
			return "NIF inválido";
		case "missing_attachment":
			return "Sin justificante";
		default:
			return "Incidencia";
	}
};
