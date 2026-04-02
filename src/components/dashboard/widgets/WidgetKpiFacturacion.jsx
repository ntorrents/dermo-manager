import React from "react";
import { DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

export const WidgetKpiFacturacion = ({
	reportingPreset,
	currentStats,
	prevStats,
	incomeGrowth,
}) => {
	return (
		<div className="h-full min-h-[180px] bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
			<div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-10 -mr-10 -mt-10 pointer-events-none"></div>
			<div>
				<p className="text-emerald-100 font-medium mb-1 flex items-center gap-2">
					<DollarSign size={16} /> Facturación {reportingPreset === "month" ? "mes" : "periodo"}
				</p>
				<h3 className="text-4xl font-bold tracking-tight">
					{formatCurrency(currentStats.income)}
				</h3>
			</div>
			<div className="mt-8">
				{reportingPreset === "month" && prevStats.income !== 0 && (
					<div
						className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${
							incomeGrowth >= 0 ? "bg-white/20 text-white" : "bg-red-500/30 text-red-100"
						}`}>
						{incomeGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
						<span>{Math.abs(incomeGrowth).toFixed(1)}%</span>
						<span className="opacity-90 ml-1">vs mes anterior</span>
					</div>
				)}
			</div>
		</div>
	);
};
