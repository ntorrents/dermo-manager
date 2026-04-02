import React from "react";
import { Lock } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

/**
 * Oculta hijos si el plan de la clínica no incluye la feature (p. ej. presupuestos/bonos).
 * `minTier`: 'clinic' = solo clinic + integral; 'integral' = solo integral.
 */
export const RequirePlan = ({ minTier = "clinic", children, fallback = null }) => {
	const { subscriptionTier, loading, allowsPresupuestosBonos } = useTenant();

	if (loading) return null;

	if (minTier === "integral") {
		if (subscriptionTier !== "integral") {
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
				Presupuestos y bonos requieren plan Clínica o Integral. Contacta para ampliar tu suscripción.
			</p>
		</div>
	);
}
