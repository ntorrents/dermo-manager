import React, { useState, useMemo } from "react";
import { Package } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import { useFinance } from "../../hooks/useFinance";

const INVESTMENT_ANNUAL_LIMIT = 25000;

export const AssetsTab = ({ user, showToast }) => {
	const { entries = [] } = useFinance(user);
	const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
	
	const investmentAnnualStatus = useMemo(() => {
		const currentYearInvestments = entries.filter(
			(e) =>
				e.activo &&
				e.type === "expense" &&
				e.is_investment &&
				e.date.startsWith(selectedYear),
		);
		const annualInvestmentBase = currentYearInvestments.reduce(
			(sum, e) => sum + (Number(e.tax_base) || 0),
			0,
		);
		return {
			annualInvestmentBase,
			limit: INVESTMENT_ANNUAL_LIMIT,
			exceeded: annualInvestmentBase > INVESTMENT_ANNUAL_LIMIT,
			remaining: Math.max(0, INVESTMENT_ANNUAL_LIMIT - annualInvestmentBase),
			pct: Math.min(100, (annualInvestmentBase / INVESTMENT_ANNUAL_LIMIT) * 100),
		};
	}, [entries, selectedYear]);

	return (
		<div className="flex-1 min-w-0 bg-gray-50 overflow-y-auto custom-scrollbar">
			<div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div>
						<h2 className="text-2xl font-black text-gray-800 tracking-tight">
							Bienes de Inversión
						</h2>
						<p className="text-sm font-medium text-gray-500 mt-1">
							Amortizaciones en curso y estimación trimestral
						</p>
					</div>
					<div className="flex items-center gap-3">
						<select
							className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
							value={selectedYear}
							onChange={(e) => setSelectedYear(e.target.value)}>
							{[2024, 2025, 2026, 2027].map((y) => (
								<option key={y} value={y.toString()}>
									{y}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<h3 className="font-black text-gray-800 text-lg mb-2 flex items-center gap-2">
						<Package className="text-indigo-500" size={20} />
						Bienes de Inversión (Amortizaciones en curso)
					</h3>
					<p className="text-xs text-gray-500 mb-4">
						En IRPF se deduce la cuota trimestral prorrateada por días activos.
					</p>
					<div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 mb-4">
						<p className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-1">
							Límite anual bienes de inversión ({selectedYear})
						</p>
						<p className="text-lg font-black text-amber-700">
							{formatCurrency(investmentAnnualStatus.annualInvestmentBase)} /{" "}
							{formatCurrency(INVESTMENT_ANNUAL_LIMIT)}
						</p>
						<div className="mt-2 h-2 bg-amber-100 rounded-full overflow-hidden">
							<div
								className={`h-full rounded-full ${
									investmentAnnualStatus.exceeded ? "bg-rose-500" : "bg-amber-500"
								}`}
								style={{ width: `${investmentAnnualStatus.pct}%` }}
							/>
						</div>
						<p
							className={`mt-2 text-xs font-bold ${
								investmentAnnualStatus.exceeded
									? "text-rose-600"
									: "text-amber-700"
							}`}>
							{investmentAnnualStatus.exceeded
								? "Se ha superado el límite anual de 25.000€."
								: `Disponible restante: ${formatCurrency(investmentAnnualStatus.remaining)}`}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
