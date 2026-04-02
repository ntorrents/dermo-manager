import React from "react";
import { BarChart3 } from "lucide-react";
import { DailyBarChart } from "../DailyBarChart";

export const WidgetChartActividad = ({ currentData, chartMonthYm, reportingPreset }) => (
	<div className="h-full min-h-[320px] w-full bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
		<h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
			<BarChart3 className="text-rose-500" size={20} /> Actividad{" "}
			{reportingPreset === "month" ? "diaria" : "del periodo"}
		</h3>
		<div className="h-64">
			{reportingPreset === "month" && chartMonthYm ? (
				<DailyBarChart data={currentData} currentMonth={chartMonthYm} />
			) : (
				<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-4">
					<p className="text-center text-sm text-gray-500">
						La vista por días del mes está disponible con el preset <strong>Mensual</strong>. En otros
						rangos, revisa los totales en las tarjetas y en Finanzas.
					</p>
				</div>
			)}
		</div>
	</div>
);
