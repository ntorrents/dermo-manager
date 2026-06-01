/** Proveedor por defecto en compras sin factura deducible (farmacia, etc.). */
export const GENERIC_PURCHASE_PROVIDER = "Farmacia";

export const isDeductiblePurchase = (data) => Boolean(data?.is_deductible);
