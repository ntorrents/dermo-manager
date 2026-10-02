import React from "react";
import { Lock } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

/**
 * Oculta hijos si el plan/módulo no incluye la feature (p. ej. presupuestos/bonos).
 * `minTier`: 'basic' = Gestión o 360; 'integral' = solo Clínica 360.
 */
export const RequirePlan = ({ minTier = "basic", children, fallback = null }) => {
	const { subscriptionTier, loading, allowsPresupuestosBonos } = useTenant();

	if (loading) return null;

	if (minTier === "integral") {
		const tier = subscriptionTier === "clinic" ? "integral" : subscriptionTier;
		if (tier !== "integral") {
			return fallback ?? <PlanLockedMessage />;
		}
		return children;
	}

	if (!allowsPresupuestosBonos) {
		return fallback ?? <PlanLockedMessage />;
	}

	return children;
};

function PlanLockedMessage() {
	return (
		<div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center text-amber-900">
			<Lock className="mx-auto mb-2 text-amber-600" size={28} />
			<p className="font-bold">Función no disponible en tu plan</p>
			<p className="mt-1 text-sm text-amber-800/90">
				Esta función no está incluida en tu plan o módulos activos. Contacta para ampliar a Clínica
				360.
			</p>
		</div>
	);
}
