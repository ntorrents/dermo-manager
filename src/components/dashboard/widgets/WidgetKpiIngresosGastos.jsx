import React from "react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiIngresosGastos = ({ currentStats }) => (
	<div className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-center gap-3">
		<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
			Ingresos / Gastos
		</p>
		<div className="flex justify-between items-baseline gap-3">
			<span className="text-xs text-slate-500">Ingresos</span>
			<span className="text-sm font-medium text-emerald-700 tabular-nums">
				{formatCurrency(currentStats?.income || 0)}
			</span>
		</div>
		<div className="flex justify-between items-baseline gap-3">
			<span className="text-xs text-slate-500">Gastos</span>
			<span className="text-sm font-medium text-rose-700 tabular-nums">
				{formatCurrency(currentStats?.expense || 0)}
			</span>
		</div>
	</div>
);
