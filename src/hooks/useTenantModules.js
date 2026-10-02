import { useMemo } from "react";
import { useTenant } from "../context/TenantContext";
import { ALL_MODULES, MODULE_META, hasModule } from "../constants/saasModules";

/**
 * Acceso tipado a módulos SaaS de la clínica activa.
 */
export const useTenantModules = () => {
	const { activeModules, hasModule: tenantHas, loading, clinicActive } = useTenant();

	const modules = useMemo(
		() => (Array.isArray(activeModules) && activeModules.length ? activeModules : ALL_MODULES),
		[activeModules],
	);

	const enabledSet = useMemo(() => new Set(modules), [modules]);

	return {
		loading,
		clinicActive,
		activeModules: modules,
		allModules: ALL_MODULES,
		moduleMeta: MODULE_META,
		hasModule: (id) => (typeof tenantHas === "function" ? tenantHas(id) : hasModule(modules, id)),
		isEnabled: (id) => enabledSet.has(id),
	};
};
