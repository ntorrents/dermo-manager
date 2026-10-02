import React from "react";
import { Lock } from "lucide-react";
import { useTenantModules } from "../../hooks/useTenantModules";
import { MODULE_META } from "../../constants/saasModules";

/**
 * Bloquea UI/rutas si el módulo no está en active_modules de la clínica.
 */
export const RequireModule = ({
	module: moduleId,
	children,
	fallback = null,
	silent = false,
}) => {
	const { loading, hasModule } = useTenantModules();

	if (loading) return null;
	if (!moduleId || hasModule(moduleId)) return children;

	if (silent) return null;
	if (fallback) return fallback;

	const label = MODULE_META[moduleId]?.label || moduleId;
	return (
		<div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center text-amber-900">
			<Lock className="mx-auto mb-2 text-amber-600" size={28} />
			<p className="font-bold">Módulo no incluido</p>
			<p className="mt-1 text-sm text-amber-800/90">
				«{label}» no está activo en el plan de esta clínica.
			</p>
		</div>
	);
};
