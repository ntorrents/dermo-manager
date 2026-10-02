import { NAV_ITEM_MODULE, hasModule } from "../../constants/saasModules";

/**
 * Filtra ítems de nav según módulos SaaS + plan (bonos).
 */
export const filterNavItem = (item, { tenantLoading, allowsPresupuestosBonos, hasModuleFn }) => {
	if (tenantLoading) return true;
	if (item.requireBonos && !allowsPresupuestosBonos) return false;
	const mod = item.module || NAV_ITEM_MODULE[item.id];
	if (mod && typeof hasModuleFn === "function" && !hasModuleFn(mod)) return false;
	if (mod && !hasModuleFn && !hasModule([], mod)) return false;
	return true;
};
