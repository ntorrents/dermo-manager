import React from "react";
import { BarChart3 } from "lucide-react";
import { DailyBarChart } from "../DailyBarChart";

export const WidgetChartActividad = ({
	currentData,
	currentDate,
	viewMode,
}) => (
	<div className="h-full min-h-[320px] w-full bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
		<h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
			<BarChart3 className="text-rose-500" size={20} /> Actividad{" "}
			{viewMode === "month" ? "Diaria" : "Periodo"}
		</h3>
		<div className="h-64">
			<DailyBarChart data={currentData} currentMonth={currentDate} />
		</div>
	</div>
);
