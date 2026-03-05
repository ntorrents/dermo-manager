import React from "react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiIngresosGastos = ({ currentStats }) => (
	<div className="h-full min-h-[180px] bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center gap-4">
		<div className="flex justify-between items-center">
			<span className="text-gray-500 text-sm font-medium">Ingresos</span>
			<span className="font-bold text-emerald-600">
				{formatCurrency(currentStats.income)}
			</span>
		</div>
		<div className="flex justify-between items-center">
			<span className="text-gray-500 text-sm font-medium">Gastos</span>
			<span className="font-bold text-rose-600">
				{formatCurrency(currentStats.expense)}
			</span>
		</div>
	</div>
);
