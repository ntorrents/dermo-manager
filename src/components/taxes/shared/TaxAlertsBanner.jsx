import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { getActiveTaxAlerts } from "../../../utils/tax/deadlines";

/**
 * Banner persistente de plazos AEAT (desaparece al marcar presented).
 */
export const TaxAlertsBanner = ({ declarations = [], onDismissLocal }) => {
	const [hidden, setHidden] = React.useState(false);
	const alerts = React.useMemo(() => getActiveTaxAlerts(declarations), [declarations]);

	if (hidden || !alerts.length) return null;

	const top = alerts[0];
	const more = alerts.length - 1;

	return (
		<div className="mx-4 mt-3 mb-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
			<AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
			<div className="flex-1 min-w-0">
				<p className="text-sm font-bold text-amber-950">
					Plazo AEAT: {top.title}
					{more > 0 ? ` (+${more} más)` : ""}
				</p>
				<p className="text-xs text-amber-800 mt-0.5">
					Quedan {top.daysLeft} día(s). La alerta se oculta al marcar la declaración como
					presentada.
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					{alerts.slice(0, 4).map((a) => (
						<Link
							key={a.id}
							to={
								a.period === "ANUAL"
									? `/fiscalidad/anual/${a.model}`
									: `/fiscalidad/trimestral/${a.model}`
							}
							className="text-xs font-bold text-rose-700 underline">
							Modelo {a.model} {a.period}
						</Link>
					))}
				</div>
			</div>
			<button
				type="button"
				aria-label="Ocultar temporalmente"
				className="text-amber-700/60 hover:text-amber-900"
				onClick={() => {
					setHidden(true);
					onDismissLocal?.();
				}}>
				<X size={16} />
			</button>
		</div>
	);
};
