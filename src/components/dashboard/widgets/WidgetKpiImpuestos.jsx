import React from "react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiImpuestos = ({ taxHucha }) => (
	<div className="h-full min-h-[180px] bg-amber-50 border border-amber-100 p-6 rounded-3xl shadow-sm flex flex-col justify-center">
		<div className="flex justify-between items-center mb-1">
			<p className="text-amber-800 text-sm font-bold">Impuestos a pagar (est.)</p>
		</div>
		<p className="text-2xl font-bold text-amber-900">{formatCurrency(taxHucha)}</p>
		<p className="text-xs text-amber-700 mt-2">IVA ventas − IVA compras</p>
	</div>
);
