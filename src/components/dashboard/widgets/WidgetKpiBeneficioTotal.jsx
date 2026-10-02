import React from "react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiBeneficioTotal = ({ beneficioTotal }) => (
	<div className="h-full rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-sm flex flex-col justify-center gap-1">
		<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
			Beneficio caja
		</p>
		<p className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
			{formatCurrency(beneficioTotal)}
		</p>
		<p className="text-xs text-slate-400">Ingresos − gastos</p>
	</div>
);
