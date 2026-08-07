import React from "react";
import { Landmark } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiBeneficioFiscal = ({ beneficioFiscal }) => (
	<div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col justify-center gap-1 h-full">
		<div className="flex items-center gap-2 text-slate-500 font-semibold text-sm mb-1">
			<Landmark size={16} className="text-blue-600" /> Beneficio Fiscal
		</div>
		<p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(beneficioFiscal)}</p>
		<p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Base imponible</p>
	</div>
);
