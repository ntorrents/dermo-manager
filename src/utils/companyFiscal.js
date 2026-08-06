/** Empresa sin dirección fiscal obligatoria para PDF / cobro. */
export function companyMissingFiscalAddress(client) {
	return !!client?.is_company && !String(client?.address || "").trim();
}

export const COMPANY_FISCAL_ADDRESS_MSG =
	"Las empresas deben tener dirección fiscal antes de cobrar o emitir factura.";
