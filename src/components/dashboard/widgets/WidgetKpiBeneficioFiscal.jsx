import React from "react";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiBeneficioFiscal = ({ beneficioFiscal }) => (
	<div className="h-full min-h-[180px] bg-gray-900 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-center gap-4">
		<p className="text-gray-400 font-medium flex items-center gap-2">
			<TrendingUp size={16} /> Beneficio fiscal (bases)
		</p>
		<p className="text-3xl font-bold">{formatCurrency(beneficioFiscal)}</p>
		<p className="text-xs text-gray-500">
			Bases facturables − Gastos deducibles (Hacienda)
		</p>
	</div>
);
