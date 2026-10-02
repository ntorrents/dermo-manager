import React from "react";
import { formatCurrency } from "../../../utils/format";

/**
 * Franja financiera asimétrica: facturación + I/G + beneficio en una sola tarjeta.
 */
export const WidgetFinanceStrip = ({
	currentStats = { income: 0, expense: 0 },
	prevStats = { income: 0 },
	beneficioTotal = 0,
	incomeGrowth = 0,
	reportingPreset,
}) => {
	const income = Number(currentStats.income) || 0;
	const expense = Number(currentStats.expense) || 0;
	const prevIncome = Number(prevStats.income) || 0;
	const pct =
		prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : incomeGrowth || 0;
	const showPct = reportingPreset === "month" && Number.isFinite(pct);

	return (
		<div className="h-full min-h-[7.5rem] rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
			<div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 h-full">
				<div className="px-5 py-4 flex flex-col justify-center gap-1 min-w-0">
					<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
						Facturación
					</p>
					<p className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight truncate">
						{formatCurrency(income)}
					</p>
					{showPct ? (
						<p
							className={`text-xs font-medium tabular-nums ${
								pct >= 0 ? "text-emerald-600" : "text-rose-600"
							}`}>
							{pct >= 0 ? "+" : ""}
							{pct.toFixed(1)}% vs mes ant.
						</p>
					) : (
						<p className="text-xs text-slate-400">Periodo seleccionado</p>
					)}
				</div>

				<div className="px-5 py-4 flex flex-col justify-center gap-2.5 min-w-0">
					<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
						Ingresos / Gastos
					</p>
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-xs text-slate-500">Ingresos</span>
						<span className="text-sm font-medium text-emerald-700 tabular-nums">
							{formatCurrency(income)}
						</span>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-xs text-slate-500">Gastos</span>
						<span className="text-sm font-medium text-rose-700 tabular-nums">
							{formatCurrency(expense)}
						</span>
					</div>
				</div>

				<div className="px-5 py-4 flex flex-col justify-center gap-1 min-w-0 bg-slate-50/50">
					<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
						Beneficio caja
					</p>
					<p
						className={`text-2xl font-semibold tabular-nums tracking-tight truncate ${
							beneficioTotal >= 0 ? "text-slate-900" : "text-rose-700"
						}`}>
						{formatCurrency(beneficioTotal)}
					</p>
					<p className="text-xs text-slate-400">Ingresos − gastos</p>
				</div>
			</div>
		</div>
	);
};
