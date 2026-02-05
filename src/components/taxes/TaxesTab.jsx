import React, { useMemo, useState } from "react";
import { Landmark, TrendingUp, Receipt, Percent } from "lucide-react";
import { formatCurrency } from "../../utils/format";

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
	return entries.filter(
		(e) => e.date >= startDate && e.date <= endDate
	);
};

export const TaxesTab = ({ entries = [] }) => {
	const currentYear = new Date().getFullYear();
	const [selectedYear, setSelectedYear] = useState(currentYear);
	const [selectedQuarter, setSelectedQuarter] = useState(
		Math.floor((new Date().getMonth() + 3) / 3)
	);

	const years = Array.from(
		{ length: 5 },
		(_, i) => currentYear - i
	);

	const quarterEntries = useMemo(
		() => filterByQuarter(entries, selectedYear, selectedQuarter),
		[entries, selectedYear, selectedQuarter]
	);

	// Resultado Operativo: Suma bases ingresos - Suma bases gastos
	const resultadoOperativo = useMemo(() => {
		const incomes = quarterEntries.filter((e) => e.type === "income");
		const expenses = quarterEntries.filter((e) => e.type === "expense");

		const sumBaseIncome = incomes.reduce(
			(acc, e) => acc + (Number(e.base_amount) ?? Number(e.amount) ?? 0),
			0
		);
		const sumBaseExpense = expenses.reduce(
			(acc, e) => acc + (Number(e.base_amount) ?? Number(e.amount) ?? 0),
			0
		);
		return sumBaseIncome - sumBaseExpense;
	}, [quarterEntries]);

	// Liquidación IVA 303: IVA Repercutido - IVA Soportado
	const liquidacionIVA = useMemo(() => {
		const incomes = quarterEntries.filter((e) => e.type === "income");
		const expenses = quarterEntries.filter((e) => e.type === "expense");

		const ivaRepercutido = incomes.reduce(
			(acc, e) => acc + (Number(e.tax_amount) ?? 0),
			0
		);
		const ivaSoportado = expenses.reduce(
			(acc, e) => acc + (Number(e.tax_amount) ?? 0),
			0
		);
		return ivaRepercutido - ivaSoportado;
	}, [quarterEntries]);

	// IRPF 130: 20% del Resultado Operativo si es positivo
	const irpf130 = useMemo(() => {
		if (resultadoOperativo <= 0) return 0;
		return Math.round(resultadoOperativo * 0.2 * 100) / 100;
	}, [resultadoOperativo]);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 xl:pb-0">
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
							resultadoOperativo >= 0
								? "text-emerald-600"
								: "text-rose-500"
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
							liquidacionIVA >= 0
								? "text-blue-600"
								: "text-rose-500"
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
						<h3 className="font-black text-gray-800 text-lg">
							IRPF (130)
						</h3>
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
		</div>
	);
};
