import React from "react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiFacturacion = ({
	totalFacturacionMes,
	facturacionMesAnterior,
	currentStats,
	prevStats,
	incomeGrowth,
	reportingPreset,
}) => {
	const current = totalFacturacionMes ?? currentStats?.income ?? 0;
	const prev = facturacionMesAnterior ?? prevStats?.income ?? 0;
	let pctChange = incomeGrowth || 0;
	if (prev > 0) {
		pctChange = ((current - prev) / prev) * 100;
	}

	return (
		<div className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-center gap-1">
			<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
				Facturación
			</p>
			<p className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
				{formatCurrency(current)}
			</p>
			<p className="text-xs text-slate-400 flex items-center gap-1">
				{reportingPreset === "month" && pctChange !== 0 && (
					<span
						className={`font-medium tabular-nums ${
							pctChange > 0 ? "text-emerald-600" : "text-rose-600"
						}`}>
						{pctChange > 0 ? "+" : ""}
						{pctChange.toFixed(1)}%
					</span>
				)}
				vs. mes anterior
			</p>
		</div>
	);
};
