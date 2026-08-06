import React from "react";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiBeneficioTotal = ({ beneficioTotal }) => (
	<div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center gap-1.5 h-full">
		<div className="flex items-center gap-2 text-slate-500 font-semibold text-sm mb-1">
			<TrendingUp size={16} className="text-emerald-600" /> Beneficio total (caja)
		</div>
		<p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(beneficioTotal)}</p>
		<p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Ingresos − Gastos</p>
	</div>
);
