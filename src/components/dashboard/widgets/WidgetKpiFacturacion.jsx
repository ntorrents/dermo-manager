import React from "react";
import { DollarSign } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiFacturacion = ({
	totalFacturacionMes,
	facturacionMesAnterior,
}) => {
	const current = totalFacturacionMes || 0;
	const prev = facturacionMesAnterior || 0;
	let pctChange = 0;
	if (prev > 0) {
		pctChange = ((current - prev) / prev) * 100;
	}

	return (
		<div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col justify-center gap-1 h-full relative overflow-hidden">
			<div className="flex items-center gap-2 text-slate-500 font-semibold text-sm mb-1">
				<DollarSign size={16} className="text-emerald-600" /> Facturación mes
			</div>
			<p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(current)}</p>
			<p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
				{pctChange !== 0 && (
					<span className={pctChange > 0 ? "text-emerald-600 font-bold" : "text-rose-700 font-bold"}>
						{pctChange > 0 ? "+" : ""}
						{pctChange.toFixed(1)}%
					</span>
				)}
				vs. mes anterior
			</p>
		</div>
	);
};
