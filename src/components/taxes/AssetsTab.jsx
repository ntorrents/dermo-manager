import React, { useState, useMemo } from "react";
import { Package } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import { useFinance } from "../../hooks/useFinance";

const INVESTMENT_ANNUAL_LIMIT = 25000;

const getQuarterDateRange = (year, quarter) => {
	const startMonth = (quarter - 1) * 3;
	const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
	const endMonth = quarter * 3;
	const endDay = new Date(year, endMonth, 0).getDate();
	const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
	return { startDate, endDate };
};

const toBaseAmount = (entry) => {
	const base = Number(entry?.tax_base);
	if (Number.isFinite(base)) return base;
	const fallback = Number(entry?.base_amount ?? entry?.amount);
	return Number.isFinite(fallback) ? fallback : 0;
};

const parseISODate = (value) => {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
};

const clampRate = (value) => {
	const rate = Number(value);
	if (!Number.isFinite(rate) || rate <= 0) return 26;
	return rate;
};

const diffDaysInclusive = (d1, d2) => {
	const MS_PER_DAY = 1000 * 60 * 60 * 24;
	const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
	const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
	return Math.floor((utc2 - utc1) / MS_PER_DAY) + 1;
};

const INVESTMENT_MIN_BASE = 300.01;

const isEffectiveInvestment = (entry) => {
	if (!entry || entry.type !== "expense" || entry.is_deductible !== true) return false;
	if (entry.is_investment !== true) return false;
	return toBaseAmount(entry) > INVESTMENT_MIN_BASE;
};

export const AssetsTab = ({ user, showToast }) => {
	const { entries = [] } = useFinance(user);
	const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
	const [selectedQuarter, setSelectedQuarter] = useState(() => {
		const month = new Date().getMonth();
		return Math.floor(month / 3) + 1;
	});
	
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

	const amortizacionData = useMemo(() => {
		const { startDate, endDate } = getQuarterDateRange(selectedYear, selectedQuarter);
		const quarterStart = parseISODate(startDate);
		const quarterEnd = parseISODate(endDate);
		if (!quarterStart || !quarterEnd) {
			return { amortizacionTrimestre: 0, activosEnCurso: [] };
		}

		const activos = entries
			.filter((e) => isEffectiveInvestment(e))
			.map((asset) => {
				const purchaseDate = parseISODate(asset.date);
				if (!purchaseDate) return null;

				const base = toBaseAmount(asset);
				const rate = clampRate(asset.amortization_rate);
				const totalLifeDays = Math.max(1, Math.ceil((100 / rate) * 365));
				const amortEndDate = new Date(purchaseDate);
				amortEndDate.setDate(amortEndDate.getDate() + totalLifeDays - 1);

				const activeStart =
					purchaseDate > quarterStart ? purchaseDate : new Date(quarterStart);
				const activeEnd = amortEndDate < quarterEnd ? amortEndDate : new Date(quarterEnd);
				const activeDaysInQuarter =
					activeStart <= activeEnd ? diffDaysInclusive(activeStart, activeEnd) : 0;

				const dailyQuota = (base * rate) / 100 / 365;
				const deducedThisQuarter = dailyQuota * activeDaysInQuarter;

				const effectiveAccumEnd =
					quarterEnd < amortEndDate ? quarterEnd : new Date(amortEndDate);
				const accumDays = diffDaysInclusive(purchaseDate, effectiveAccumEnd);
				const amortizedAccum = dailyQuota * accumDays;
				const progressPct = Math.min(100, (accumDays / totalLifeDays) * 100);

				return {
					id: asset.id,
					description: asset.description || "Bienes de Inversión",
					date: asset.date,
					base,
					rate,
					totalLifeDays,
					amortEndDate: amortEndDate.toISOString().split("T")[0],
					activeDaysInQuarter,
					deducedThisQuarter,
					amortizedAccum,
					progressPct,
				};
			})
			.filter(Boolean)
			.filter((a) => a.activeDaysInQuarter > 0);

		const amortizacionTrimestre = activos.reduce((sum, a) => sum + a.deducedThisQuarter, 0);

		return { amortizacionTrimestre, activosEnCurso: activos };
	}, [entries, selectedYear, selectedQuarter]);

	return (
		<div className="flex-1 min-w-0 bg-gray-50 overflow-y-auto custom-scrollbar">
			<div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
						<select
							className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
							value={selectedQuarter}
							onChange={(e) => setSelectedQuarter(Number(e.target.value))}>
							{[1, 2, 3, 4].map((q) => (
								<option key={q} value={q}>
									Trimestre {q}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
					<h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
						<Package className="text-slate-500" size={16} />
						Amortizaciones en curso
					</h3>
					<p className="text-xs text-slate-500 mb-4">
						En IRPF se deduce la cuota trimestral prorrateada por días activos.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
							<p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
								Límite anual bienes de inversión ({selectedYear})
							</p>
							<p className="text-sm font-black text-slate-700">
								{formatCurrency(investmentAnnualStatus.annualInvestmentBase)} /{" "}
								{formatCurrency(INVESTMENT_ANNUAL_LIMIT)}
							</p>
							<div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
								<div
									className={`h-full rounded-full ${
										investmentAnnualStatus.exceeded ? "bg-rose-700" : "bg-slate-800"
									}`}
									style={{ width: `${investmentAnnualStatus.pct}%` }}
								/>
							</div>
							<p
								className={`mt-2 text-[10px] font-bold ${
									investmentAnnualStatus.exceeded
										? "text-rose-700"
										: "text-slate-500"
								}`}>
								{investmentAnnualStatus.exceeded
									? "Se ha superado el límite anual de 25.000€."
									: `Disponible restante: ${formatCurrency(investmentAnnualStatus.remaining)}`}
							</p>
						</div>
						<div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
							<p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider mb-1">
								Amortización deducible este trimestre
							</p>
							<p className="text-lg font-black text-rose-700">
								{formatCurrency(amortizacionData.amortizacionTrimestre)}
							</p>
						</div>
					</div>

					{amortizacionData.activosEnCurso.length === 0 ? (
						<EmptyState
							icon={Package}
							title="Sin bienes de inversión en curso"
							description="No hay activos amortizables pendientes para el periodo seleccionado."
						/>
					) : (
						<div className="space-y-3">
							{amortizacionData.activosEnCurso.map((asset) => (
								<div
									key={asset.id}
									className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors bg-white">
									<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
										<div>
											<p className="font-bold text-sm text-slate-800">{asset.description}</p>
											<p className="text-[11px] text-slate-500 mt-0.5">
												Compra: {asset.date} · Base: {formatCurrency(asset.base)} · %
												amort. anual: {asset.rate}%
											</p>
										</div>
										<div className="text-left sm:text-right">
											<p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
												Cuota trimestre
											</p>
											<p className="font-black text-sm text-rose-700">
												{formatCurrency(asset.deducedThisQuarter)}
											</p>
										</div>
									</div>
									<div className="mt-3">
										<div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
											<div
												className="h-full bg-slate-800 rounded-full"
												style={{ width: `${asset.progressPct}%` }}
											/>
										</div>
										<div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
											<span className="text-gray-600">
												Amortizado: {formatCurrency(asset.amortizedAccum)} (
												{asset.progressPct.toFixed(1)}%)
											</span>
											<span className="text-gray-500 font-medium">
												Fin de amortización estimada: {asset.amortEndDate}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
