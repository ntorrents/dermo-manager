import React, { useMemo, useState } from "react";
import {
	Landmark,
	TrendingUp,
	Receipt,
	Percent,
	BarChart3,
	Calendar,
	Download,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { exportTrimestreToZip } from "../../utils/export";

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

export const TaxesTab = ({
	entries = [],
	clients = [],
	user,
	showToast = () => {},
}) => {
	const currentYear = new Date().getFullYear();
	const [selectedYear, setSelectedYear] = useState(currentYear);
	const [selectedQuarter, setSelectedQuarter] = useState(
		Math.floor((new Date().getMonth() + 3) / 3),
	);
	const [exporting, setExporting] = useState(false);

	const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

	const quarterEntries = useMemo(
		() => filterByQuarter(entries, selectedYear, selectedQuarter),
		[entries, selectedYear, selectedQuarter],
	);

	// Resultado Operativo: Suma bases ingresos - Suma bases gastos deducibles (excl. Plan Amigo)
	const resultadoOperativo = useMemo(() => {
		const incomes = quarterEntries.filter((e) => e.type === "income" && !e.plan_amigo);
		const expenses = quarterEntries.filter(
			(e) => e.type === "expense" && e.is_deductible === true,
		);

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
		return sumBaseIncome - sumBaseExpense;
	}, [quarterEntries]);

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
						disabled={exporting}
						className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
						<Download size={18} />
						{exporting ? "Generando..." : "Descargar Trimestre"}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
						Bases Ingresos − Bases Gastos
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
					<p className="text-gray-400 text-sm text-center py-8">
						Sin movimientos en el trimestre seleccionado
					</p>
				)}
			</div>
		</div>
	);
};
