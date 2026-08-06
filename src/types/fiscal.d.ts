/** Tipos fiscales (Fase 0.7 — base para migración gradual a TypeScript). */

export interface IncomeTaxBreakdown {
	baseAmount: number;
	taxAmount: number;
	irpfAmount: number;
	totalAmount: number;
	pvp: number;
}

export type FinanceIssueCode =
	| "missing_invoice"
	| "missing_nif"
	| "invalid_nif"
	| "missing_attachment";

export interface FinanceEntryFiscal {
	type?: string;
	is_deductible?: boolean;
	invoice_number?: string | null;
	supplier_nif?: string | null;
	file_url?: string | null;
	amount?: number;
	plan_amigo?: boolean;
	activo?: boolean;
}
