import React, { useMemo, useState } from "react";
import {
	Landmark,
	TrendingUp,
	Receipt,
	Percent,
	BarChart3,
	Calendar,
	Download,
	Banknote,
	FileSpreadsheet,
	Package,
	ShieldCheck,
	TriangleAlert,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { exportTrimestreToZip } from "../../utils/export";
import { exportPre303LibrosTrimestre } from "../../utils/aeatLibrosExport";
import { EmptyState } from "../ui/EmptyState";
import {
	classifyFinanceIssue,
} from "../../utils/financeIssues";

const monthNames = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

const getQuarterDateRange = (year, quarter) => {
	const startMonth = (quarter - 1) * 3;
	const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
	const endMonth = quarter * 3;
	const endDay = new Date(year, endMonth, 0).getDate();
	const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
	return { startDate, endDate };
};

const filterByQuarter = (entries, year, quarter) => {
	if (!entries || entries.length === 0) return [];
	const { startDate, endDate } = getQuarterDateRange(year, quarter);
	return entries.filter((e) => e.date >= startDate && e.date <= endDate);
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

const diffDaysInclusive = (start, end) => {
	const MS_PER_DAY = 24 * 60 * 60 * 1000;
	return Math.max(0, Math.floor((end - start) / MS_PER_DAY) + 1);
};

const INVESTMENT_MIN_BASE = 300;
const INVESTMENT_ANNUAL_LIMIT = 25000;

const isEffectiveInvestment = (entry) => {
	if (!entry || entry.type !== "expense" || entry.is_deductible !== true) return false;
	if (entry.is_investment !== true) return false;
	return toBaseAmount(entry) > INVESTMENT_MIN_BASE;
};

export const TaxesTab = ({
	entries = [],
	clients = [],
	user,
	showToast = () => {},
	onNavigateFinanceIssues,
}) => {
	const currentYear = new Date().getFullYear();
	const [selectedYear, setSelectedYear] = useState(currentYear);
	const [selectedQuarter, setSelectedQuarter] = useState(
		Math.floor((new Date().getMonth() + 3) / 3),
	);
	const [exporting, setExporting] = useState(false);
	const [exportingLibros, setExportingLibros] = useState(false);

	const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

	const quarterEntries = useMemo(
		() => filterByQuarter(entries, selectedYear, selectedQuarter),
		[entries, selectedYear, selectedQuarter],
	);

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
				const elapsedDays =
					effectiveAccumEnd >= purchaseDate
						? diffDaysInclusive(purchaseDate, effectiveAccumEnd)
						: 0;
				const amortizedAccum = Math.min(base, dailyQuota * elapsedDays);
				const pending = Math.max(0, base - amortizedAccum);
				const progressPct = base > 0 ? Math.min(100, (amortizedAccum / base) * 100) : 0;

				const remainingLifeDays =
					quarterEnd < amortEndDate
						? diffDaysInclusive(new Date(quarterEnd.getTime() + 86400000), amortEndDate)
						: 0;

				return {
					id: asset.id,
					description: asset.description || "Bien sin descripción",
					date: asset.date,
					base,
					rate,
					deducedThisQuarter,
					amortizedAccum,
					pending,
					progressPct,
					remainingLifeDays,
				};
			})
			.filter(Boolean)
			.filter((asset) => asset.pending > 0)
			.sort((a, b) => a.date.localeCompare(b.date));

		const amortizacionTrimestre = activos.reduce(
			(acc, asset) => acc + asset.deducedThisQuarter,
			0,
		);

		return { amortizacionTrimestre, activosEnCurso: activos };
	}, [entries, selectedYear, selectedQuarter]);

	// Resultado Operativo: Suma bases ingresos - Suma bases gastos deducibles (excl. Plan Amigo)
	const resultadoOperativo = useMemo(() => {
		const incomes = quarterEntries.filter((e) => e.type === "income" && !e.plan_amigo);
		const expenses = quarterEntries.filter((e) => {
			if (e.type !== "expense" || e.is_deductible !== true) return false;
			return !isEffectiveInvestment(e);
		});

		const sumBaseIncome = incomes.reduce(
			(acc, e) =>
				acc +
				(Number(e.tax_base) ?? Number(e.base_amount) ?? Number(e.amount) ?? 0),
			0,
		);
		const sumBaseExpense = expenses.reduce(
			(acc, e) =>
				acc +
				(Number(e.tax_base) ?? Number(e.base_amount) ?? Number(e.amount) ?? 0),
			0,
		);
		return sumBaseIncome - (sumBaseExpense + amortizacionData.amortizacionTrimestre);
	}, [quarterEntries, amortizacionData.amortizacionTrimestre]);

	// Liquidación IVA 303: IVA Repercutido - IVA Soportado (excl. Plan Amigo)
	const liquidacionIVA = useMemo(() => {
		const incomes = quarterEntries.filter((e) => e.type === "income" && !e.plan_amigo);
		const expenses = quarterEntries.filter(
			(e) => e.type === "expense" && e.is_deductible === true,
		);

		const ivaRepercutido = incomes.reduce(
			(acc, e) => acc + (Number(e.tax_amount) ?? 0),
			0,
		);
		const ivaSoportado = expenses.reduce(
			(acc, e) => acc + (Number(e.tax_amount) ?? 0),
			0,
		);
		return ivaRepercutido - ivaSoportado;
	}, [quarterEntries]);

	// IRPF 130: 20% del Resultado Operativo si es positivo
	const irpf130 = useMemo(() => {
		if (resultadoOperativo <= 0) return 0;
		return Math.round(resultadoOperativo * 0.2 * 100) / 100;
	}, [resultadoOperativo]);

	// Retenciones a ingresar (Modelo 111/115): suma de irpf_amount de gastos del trimestre
	const retencionesIngresar = useMemo(() => {
		return quarterEntries
			.filter((e) => e.type === "expense")
			.reduce((acc, e) => acc + (Number(e.irpf_amount) ?? 0), 0);
	}, [quarterEntries]);

	// Desglose mensual: agrupa por mes
	const monthlyBreakdown = useMemo(() => {
		const byMonth = {};
		quarterEntries.forEach((e) => {
			const month = e.date ? e.date.slice(0, 7) : null;
			if (!month) return;
			if (!byMonth[month]) {
				byMonth[month] = { income: 0, expense: 0 };
			}
			const amt = Number(e.amount) || 0;
			if (e.type === "income") {
				byMonth[month].income += amt;
			} else if (e.type === "expense") {
				byMonth[month].expense += amt;
			}
		});
		// Convertir a array ordenado por mes
		return Object.entries(byMonth)
			.map(([month, data]) => ({
				month,
				monthLabel:
					monthNames[new Date(month + "-01").getMonth()] +
					" " +
					month.slice(0, 4),
				income: data.income,
				expense: data.expense,
				profit: data.income - data.expense,
			}))
			.sort((a, b) => a.month.localeCompare(b.month));
	}, [quarterEntries]);

	const investmentAnnualStatus = useMemo(() => {
		const yearStart = `${selectedYear}-01-01`;
		const yearEnd = `${selectedYear}-12-31`;
		const annualInvestmentBase = entries
			.filter(
				(e) => isEffectiveInvestment(e) && e.date >= yearStart && e.date <= yearEnd,
			)
			.reduce((acc, e) => acc + toBaseAmount(e), 0);
		const pct = Math.min(100, (annualInvestmentBase / INVESTMENT_ANNUAL_LIMIT) * 100);
		return {
			annualInvestmentBase,
			remaining: Math.max(0, INVESTMENT_ANNUAL_LIMIT - annualInvestmentBase),
			pct,
			exceeded: annualInvestmentBase > INVESTMENT_ANNUAL_LIMIT,
		};
	}, [entries, selectedYear]);

	const fiscalChecklist = useMemo(() => {
		const deductibleExpenses = quarterEntries.filter(
			(e) => e.type === "expense" && e.is_deductible === true,
		);
		const totalDeducible = deductibleExpenses.length;

		let missingInvoice = 0;
		let missingNif = 0;
		let invalidNif = 0;
		let missingAttachment = 0;
		for (const e of deductibleExpenses) {
			const issue = classifyFinanceIssue(e);
			if (issue === "missing_invoice") missingInvoice += 1;
			else if (issue === "missing_nif") missingNif += 1;
			else if (issue === "invalid_nif") invalidNif += 1;
			else if (issue === "missing_attachment") missingAttachment += 1;
		}

		const criticalIssues = missingInvoice + missingNif + invalidNif;
		const warningIssues = missingAttachment;

		return {
			totalDeducible,
			missingInvoice,
			missingNif,
			invalidNif,
			missingAttachment,
			criticalIssues,
			warningIssues,
			readyToExport: criticalIssues === 0,
		};
	}, [quarterEntries]);

	const openFinanceIssues = (issue) => {
		if (!onNavigateFinanceIssues) return;
		onNavigateFinanceIssues({
			year: selectedYear,
			quarter: selectedQuarter,
			issue,
		});
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<h2 className="text-2xl xl:text-3xl font-black text-gray-800 tracking-tight flex items-center gap-2">
					<Landmark className="text-rose-500" size={28} /> Fiscalidad
				</h2>
				<div className="flex gap-3 flex-wrap">
					<select
						value={selectedYear}
						onChange={(e) => setSelectedYear(Number(e.target.value))}
						className="p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-rose-300">
						{years.map((y) => (
							<option key={y} value={y}>
								{y}
							</option>
						))}
					</select>
					<select
						value={selectedQuarter}
						onChange={(e) => setSelectedQuarter(Number(e.target.value))}
						className="p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-rose-300">
						<option value={1}>1T (Ene-Mar)</option>
						<option value={2}>2T (Abr-Jun)</option>
						<option value={3}>3T (Jul-Sep)</option>
						<option value={4}>4T (Oct-Dic)</option>
					</select>
					<button
						onClick={async () => {
							setExporting(true);
							await exportTrimestreToZip(
								entries,
								clients,
								selectedYear,
								selectedQuarter,
								user?.id,
								showToast,
							);
							setExporting(false);
						}}
						disabled={exporting || exportingLibros}
						className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
						<Download size={18} />
						{exporting ? "Generando..." : "Descargar Trimestre"}
					</button>
					<button
						type="button"
						onClick={async () => {
							setExportingLibros(true);
							try {
								await exportPre303LibrosTrimestre(
									entries,
									clients,
									selectedYear,
									selectedQuarter,
									showToast,
								);
							} catch (err) {
								console.error(err);
								showToast(
									err?.message || "No se pudo generar el Excel de libros IVA",
									"error",
								);
							} finally {
								setExportingLibros(false);
							}
						}}
						disabled={exporting || exportingLibros}
						className="px-4 py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
						title="Plantilla oficial AEAT (libros registro) rellenada con ventas y compras deducibles del trimestre. Importación en Pre303 / Sede (revisar antes de presentar).">
						<FileSpreadsheet size={18} />
						{exportingLibros ? "Generando..." : "Libro IVA (Pre303)"}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
				{/* Tarjeta 1: Resultado Operativo */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<div className="flex items-center gap-3 mb-4">
						<div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
							<TrendingUp size={24} />
						</div>
						<h3 className="font-black text-gray-800 text-lg">
							Resultado Operativo
						</h3>
					</div>
					<p className="text-xs text-gray-500 mb-2">
						Bases Ingresos − Gastos corrientes − Amortización trimestral
					</p>
					<p
						className={`text-3xl font-black ${
							resultadoOperativo >= 0 ? "text-emerald-600" : "text-rose-500"
						}`}>
						{formatCurrency(resultadoOperativo)}
					</p>
				</div>

				{/* Tarjeta 2: Liquidación IVA 303 */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<div className="flex items-center gap-3 mb-4">
						<div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
							<Receipt size={24} />
						</div>
						<h3 className="font-black text-gray-800 text-lg">
							Liquidación IVA (303)
						</h3>
					</div>
					<p className="text-xs text-gray-500 mb-2">
						IVA Repercutido − IVA Soportado
					</p>
					<p
						className={`text-3xl font-black ${
							liquidacionIVA >= 0 ? "text-blue-600" : "text-rose-500"
						}`}>
						{formatCurrency(liquidacionIVA)}
					</p>
					<p className="text-[10px] text-gray-400 mt-2 italic">
						{liquidacionIVA > 0
							? "A favor de Hacienda"
							: liquidacionIVA < 0
								? "A devolver por Hacienda"
								: "Neutro"}
					</p>
				</div>

				{/* Tarjeta 3: IRPF 130 */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<div className="flex items-center gap-3 mb-4">
						<div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
							<Percent size={24} />
						</div>
						<h3 className="font-black text-gray-800 text-lg">IRPF (130)</h3>
					</div>
					<p className="text-xs text-gray-500 mb-2">
						20% del Resultado Operativo
					</p>
					<p className="text-3xl font-black text-amber-600">
						{formatCurrency(irpf130)}
					</p>
					{resultadoOperativo <= 0 && (
						<p className="text-[10px] text-gray-400 mt-2 italic">
							Sin pago (resultado negativo)
						</p>
					)}
				</div>

				{/* Tarjeta 4: Retenciones a ingresar (Modelo 111/115) */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<div className="flex items-center gap-3 mb-4">
						<div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
							<Banknote size={24} />
						</div>
						<h3 className="font-black text-gray-800 text-lg">
							Retenciones a ingresar
						</h3>
					</div>
					<p className="text-xs text-gray-500 mb-2">
						Modelo 111/115 (IRPF retenido)
					</p>
					<p className="text-3xl font-black text-violet-600">
						{formatCurrency(retencionesIngresar)}
					</p>
					{retencionesIngresar > 0 && (
						<p className="text-[10px] text-gray-400 mt-2 italic">
							Suma de retenciones de gastos del trimestre
						</p>
					)}
				</div>
			</div>

			<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
				<h3 className="font-black text-gray-800 text-lg mb-2 flex items-center gap-2">
					<ShieldCheck className="text-slate-700" size={20} />
					Checklist fiscal antes de exportar
				</h3>
				<p className="text-xs text-gray-500 mb-4">
					Control rápido del trimestre para detectar incidencias antes de generar
					modelos o libros.
				</p>
				{onNavigateFinanceIssues && (
					<div className="flex flex-wrap gap-2 mb-4">
						<button
							type="button"
							onClick={() => openFinanceIssues("all")}
							className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
							Abrir Finanzas (periodo del checklist)
						</button>
						{fiscalChecklist.criticalIssues + fiscalChecklist.warningIssues > 0 && (
							<button
								type="button"
								onClick={() => openFinanceIssues("any")}
								className="text-xs font-bold px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
								Ver solo incidencias
							</button>
						)}
					</div>
				)}
				<div
					className={`rounded-2xl border p-4 mb-4 ${
						fiscalChecklist.readyToExport
							? "bg-emerald-50 border-emerald-100"
							: "bg-amber-50 border-amber-100"
					}`}>
					<p
						className={`text-sm font-bold ${
							fiscalChecklist.readyToExport
								? "text-emerald-700"
								: "text-amber-700"
						}`}>
						{fiscalChecklist.readyToExport
							? "Listo para exportar: no hay incidencias críticas."
							: "Revisar antes de exportar: hay incidencias críticas en gastos deducibles."}
					</p>
					<p className="text-xs text-gray-600 mt-1">
						Gastos deducibles en el trimestre:{" "}
						<span className="font-black">{fiscalChecklist.totalDeducible}</span>
					</p>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					<div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
						<p className="text-[10px] uppercase font-black text-gray-400">
							Sin nº factura
						</p>
						<p className="text-xl font-black text-gray-800">
							{fiscalChecklist.missingInvoice}
						</p>
						{onNavigateFinanceIssues && fiscalChecklist.missingInvoice > 0 && (
							<button
								type="button"
								onClick={() => openFinanceIssues("missing_invoice")}
								className="mt-2 text-[11px] font-bold text-rose-600 hover:underline">
								Ver en Finanzas
							</button>
						)}
					</div>
					<div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
						<p className="text-[10px] uppercase font-black text-gray-400">
							Sin NIF proveedor
						</p>
						<p className="text-xl font-black text-gray-800">
							{fiscalChecklist.missingNif}
						</p>
						{onNavigateFinanceIssues && fiscalChecklist.missingNif > 0 && (
							<button
								type="button"
								onClick={() => openFinanceIssues("missing_nif")}
								className="mt-2 text-[11px] font-bold text-rose-600 hover:underline">
								Ver en Finanzas
							</button>
						)}
					</div>
					<div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
						<p className="text-[10px] uppercase font-black text-gray-400">
							NIF inválido
						</p>
						<p className="text-xl font-black text-gray-800">
							{fiscalChecklist.invalidNif}
						</p>
						{onNavigateFinanceIssues && fiscalChecklist.invalidNif > 0 && (
							<button
								type="button"
								onClick={() => openFinanceIssues("invalid_nif")}
								className="mt-2 text-[11px] font-bold text-rose-600 hover:underline">
								Ver en Finanzas
							</button>
						)}
					</div>
					<div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
						<p className="text-[10px] uppercase font-black text-gray-400">
							Sin justificante
						</p>
						<p className="text-xl font-black text-gray-800">
							{fiscalChecklist.missingAttachment}
						</p>
						{onNavigateFinanceIssues && fiscalChecklist.missingAttachment > 0 && (
							<button
								type="button"
								onClick={() => openFinanceIssues("missing_attachment")}
								className="mt-2 text-[11px] font-bold text-rose-600 hover:underline">
								Ver en Finanzas
							</button>
						)}
					</div>
					<div className="p-3 rounded-xl border border-gray-100 bg-slate-50">
						<p className="text-[10px] uppercase font-black text-gray-400">
							Estado
						</p>
						<p
							className={`text-xs font-black mt-1 flex items-center gap-1 ${
								fiscalChecklist.readyToExport
									? "text-emerald-700"
									: "text-amber-700"
							}`}>
							<TriangleAlert size={12} />
							{fiscalChecklist.criticalIssues} críticas ·{" "}
							{fiscalChecklist.warningIssues} aviso
						</p>
					</div>
				</div>
			</div>

			{/* Desglose Mensual */}
			<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
				<h3 className="font-black text-gray-800 text-lg mb-4 flex items-center gap-2">
					<BarChart3 className="text-rose-500" size={20} />
					Desglose Mensual
				</h3>
				{monthlyBreakdown.length > 0 ? (
					<div className="space-y-4">
						{monthlyBreakdown.map((row) => {
							const maxVal = Math.max(row.income, row.expense, 1);
							const incomePct = (row.income / maxVal) * 100;
							const expensePct = (row.expense / maxVal) * 100;
							return (
								<div
									key={row.month}
									className="border border-gray-100 rounded-2xl p-4 hover:border-rose-100 transition-colors">
									<div className="flex items-center gap-2 mb-3">
										<Calendar size={16} className="text-gray-400" />
										<span className="font-bold text-gray-800">
											{row.monthLabel}
										</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
										<div className="flex justify-between sm:block">
											<span className="text-gray-500 font-medium">
												Ingresos
											</span>
											<span className="font-bold text-emerald-600 sm:block">
												{formatCurrency(row.income)}
											</span>
										</div>
										<div className="flex justify-between sm:block">
											<span className="text-gray-500 font-medium">Gastos</span>
											<span className="font-bold text-rose-500 sm:block">
												{formatCurrency(row.expense)}
											</span>
										</div>
										<div className="flex justify-between sm:block">
											<span className="text-gray-500 font-medium">
												Resultado
											</span>
											<span
												className={`font-bold sm:block ${
													row.profit >= 0 ? "text-emerald-600" : "text-rose-500"
												}`}>
												{row.profit >= 0 ? "+" : ""}
												{formatCurrency(row.profit)}
											</span>
										</div>
									</div>
									<div className="flex gap-2 h-2 rounded-full overflow-hidden bg-gray-100">
										<div
											className="bg-emerald-500 rounded-l-full"
											style={{ width: `${incomePct}%` }}
										/>
										<div
											className="bg-rose-500"
											style={{ width: `${expensePct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<EmptyState
						icon={BarChart3}
						title="Sin movimientos en el trimestre"
						description="Cuando registres ingresos o gastos en este periodo, verás aquí su desglose mensual."
					/>
				)}
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
				<div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 mb-4">
					<p className="text-xs text-indigo-700 font-bold uppercase tracking-wider mb-1">
						Amortización deducible este trimestre
					</p>
					<p className="text-2xl font-black text-indigo-700">
						{formatCurrency(amortizacionData.amortizacionTrimestre)}
					</p>
				</div>
				{amortizacionData.activosEnCurso.length === 0 ? (
					<EmptyState
						icon={Package}
						title="Sin bienes de inversión en curso"
						description="No hay activos amortizables pendientes para el periodo seleccionado."
					/>
				) : (
					<div className="space-y-4">
						{amortizacionData.activosEnCurso.map((asset) => (
							<div
								key={asset.id}
								className="border border-gray-100 rounded-2xl p-4 hover:border-indigo-100 transition-colors">
								<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
									<div>
										<p className="font-black text-gray-800">{asset.description}</p>
										<p className="text-xs text-gray-500 mt-1">
											Compra: {asset.date} · Base: {formatCurrency(asset.base)} · %
											amortización anual: {asset.rate}%
										</p>
									</div>
									<div className="text-left sm:text-right">
										<p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
											Cuota trimestre
										</p>
										<p className="font-black text-indigo-700">
											{formatCurrency(asset.deducedThisQuarter)}
										</p>
									</div>
								</div>
								<div className="mt-3">
									<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
										<div
											className="h-full bg-indigo-500 rounded-full"
											style={{ width: `${asset.progressPct}%` }}
										/>
									</div>
									<div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
										<span className="text-gray-600">
											Amortizado: {formatCurrency(asset.amortizedAccum)} (
											{asset.progressPct.toFixed(1)}%)
										</span>
										<span className="text-gray-500">
											Pendiente: {formatCurrency(asset.pending)} · Vida útil restante:{" "}
											{asset.remainingLifeDays} días
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
