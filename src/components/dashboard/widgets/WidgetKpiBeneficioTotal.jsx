import React from "react";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiBeneficioTotal = ({ beneficioTotal }) => (
	<div className="h-full min-h-[180px] bg-emerald-600 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-center gap-4">
		<p className="text-emerald-100 font-medium flex items-center gap-2">
			<TrendingUp size={16} /> Beneficio total (caja)
		</p>
		<p className="text-3xl font-bold">{formatCurrency(beneficioTotal)}</p>
		<p className="text-xs text-emerald-200">Ingresos − Gastos (todo el periodo)</p>
	</div>
);
