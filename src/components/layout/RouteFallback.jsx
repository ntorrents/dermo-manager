import React from "react";
import { Loader2 } from "lucide-react";

/** Fallback de Suspense para rutas lazy (móvil / desktop). */
export const RouteFallback = () => (
	<div
		className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-4"
		role="status"
		aria-live="polite"
		aria-label="Cargando sección">
		<Loader2 className="animate-spin text-rose-700" size={28} />
		<div className="w-full max-w-sm space-y-2">
			<div className="h-3 rounded-full bg-gray-200/80 animate-pulse" />
			<div className="h-3 w-[80%] rounded-full bg-gray-100 animate-pulse" />
			<div className="h-24 rounded-2xl bg-gray-100/80 animate-pulse" />
		</div>
	</div>
);
