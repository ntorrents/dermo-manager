import { ALL_MODULES as CATALOG, normalizeSubscriptionTier } from "../constants/saasModules";

export const ALL_MODULES = CATALOG;

/** Ambos planes comerciales incluyen presupuestos/bonos esenciales (gate fino vía módulos). */
export const MID_TIER_PLANS = new Set(["basic", "integral"]);

export const planAllowsPresupuestosBonos = (tier) =>
	MID_TIER_PLANS.has(normalizeSubscriptionTier(tier));

export { hasModule, normalizeSubscriptionTier } from "../constants/saasModules";
