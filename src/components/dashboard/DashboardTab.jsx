import React, { useMemo } from "react";
import {
	TrendingUp,
	DollarSign,
	Package,
	Award,
	AlertTriangle,
	ArrowUpRight,
	ArrowDownRight,
	BarChart3,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { DailyBarChart } from "./DailyBarChart"; // <--- 1. IMPORTAMOS LA NUEVA GRÁFICA

// 2. AÑADIMOS 'treatments' A LAS PROPS
export const DashboardTab = ({
	user,
	entries,
	inventory = [],
	treatments = [],
	currentMonth,
	setCurrentMonth,
	userName,
}) => {
	// --- LÓGICA DE FECHAS ---
	const currentData = useMemo(() => {
		return entries.filter((e) => e.date.startsWith(currentMonth));
	}, [entries, currentMonth]);

	const previousMonth = useMemo(() => {
		const date = new Date(currentMonth + "-01");
		date.setMonth(date.getMonth() - 1);
		return date.toISOString().slice(0, 7);
	}, [currentMonth]);

	const previousData = useMemo(() => {
		return entries.filter((e) => e.date.startsWith(previousMonth));
	}, [entries, previousMonth]);

	// --- CÁLCULOS FINANCIEROS ---
	const calculateStats = (data) => {
		const income = data
			.filter((e) => e.type === "income")
			.reduce((a, b) => a + b.amount, 0);
		const expense = data
			.filter((e) => e.type === "expense")
			.reduce((a, b) => a + b.amount, 0);
		return { income, expense, net: income - expense };
	};

	const currentStats = calculateStats(currentData);
	const prevStats = calculateStats(previousData);
	const growth =
		prevStats.net === 0
			? 0
			: ((currentStats.net - prevStats.net) / prevStats.net) * 100;
	const isGrowing = growth >= 0;

	// --- 3. LÓGICA TOP TRATAMIENTOS (FILTRADO MEJORADO) ---
	const topTreatments = useMemo(() => {
		// A. Creamos un Set con los nombres oficiales de tus tratamientos (en minúsculas para comparar)
		const officialTreatments = new Set(
			treatments.map((t) => t.name.toLowerCase()),
		);

		const ranking = {};

		currentData
			.filter((e) => e.type === "income")
			.forEach((e) => {
				// Limpiamos el nombre: "Botox (Pepito)" -> "Botox"
				const rawName = e.description.split("(")[0].trim();

				// B. EL FILTRO CLAVE: Solo contamos si el nombre está en tu catálogo oficial
				if (officialTreatments.has(rawName.toLowerCase())) {
					if (!ranking[rawName]) ranking[rawName] = { count: 0, amount: 0 };
					ranking[rawName].count += 1;
					ranking[rawName].amount += e.amount;
				}
			});

		return Object.entries(ranking)
			.map(([name, data]) => ({ name, ...data }))
			.sort((a, b) => b.amount - a.amount)
			.slice(0, 5);
	}, [currentData, treatments]); // Se recalcula si cambian los tratamientos

	// --- LÓGICA ALERTAS (Stock Bajo) ---
	const lowStockItems = inventory.filter((i) => i.stock <= (i.minStock || 5));

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* CABECERA */}
			<div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
				<div>
					<h2 className="text-2xl font-bold text-gray-800">
						Hola, <span className="text-rose-500">{userName || "Nil"}</span> 👋
					</h2>
					<p className="text-gray-400 text-sm">Resumen de actividad.</p>
				</div>
				<input
					type="month"
					value={currentMonth}
					onChange={(e) => setCurrentMonth(e.target.value)}
					className="bg-white border border-gray-200 p-2 rounded-xl text-gray-600 font-medium shadow-sm outline-none focus:ring-2 ring-rose-100"
				/>
			</div>

			{/* ALERTAS */}
			{lowStockItems.length > 0 && (
				<div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2">
					<div className="bg-orange-100 p-2 rounded-lg text-orange-600">
						<AlertTriangle size={24} />
					</div>
					<div>
						<h4 className="font-bold text-orange-800">Atención Requerida</h4>
						<p className="text-sm text-orange-700 mb-2">
							Tienes <strong>{lowStockItems.length} productos</strong> con stock
							bajo.
						</p>
						<div className="flex flex-wrap gap-2">
							{lowStockItems.slice(0, 3).map((item) => (
								<span
									key={item.id}
									className="text-xs bg-white text-orange-600 px-2 py-1 rounded-md border border-orange-200 font-medium">
									{item.name} ({item.stock})
								</span>
							))}
							{lowStockItems.length > 3 && (
								<span className="text-xs text-orange-600 pt-1">
									...+{lowStockItems.length - 3}
								</span>
							)}
						</div>
					</div>
				</div>
			)}

			{/* KPIS PRINCIPALES */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Beneficio Neto */}
				<div className="md:col-span-1 bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
					<div>
						<p className="text-gray-400 font-medium mb-1 flex items-center gap-2">
							<TrendingUp size={16} /> Beneficio Neto
						</p>
						<h3 className="text-4xl font-bold tracking-tight">
							{formatCurrency(currentStats.net)}
						</h3>
					</div>
					<div className="mt-8">
						<div
							className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isGrowing ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
							{isGrowing ? (
								<ArrowUpRight size={16} />
							) : (
								<ArrowDownRight size={16} />
							)}
							<span>{Math.abs(growth).toFixed(1)}%</span>
							<span className="text-gray-400 font-normal ml-1">
								vs mes pasado
							</span>
						</div>
					</div>
				</div>

				{/* Ingresos vs Gastos */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center gap-6">
					<div>
						<div className="flex justify-between items-center mb-1">
							<p className="text-gray-500 text-sm font-medium">
								Ingresos Totales
							</p>
							<div className="bg-green-100 text-green-600 p-1.5 rounded-lg">
								<DollarSign size={16} />
							</div>
						</div>
						<p className="text-2xl font-bold text-gray-800">
							{formatCurrency(currentStats.income)}
						</p>
					</div>
					<div className="h-px bg-gray-100 w-full"></div>
					<div>
						<div className="flex justify-between items-center mb-1">
							<p className="text-gray-500 text-sm font-medium">
								Gastos / Material
							</p>
							<div className="bg-red-100 text-red-600 p-1.5 rounded-lg">
								<Package size={16} />
							</div>
						</div>
						<p className="text-2xl font-bold text-gray-800">
							{formatCurrency(currentStats.expense)}
						</p>
					</div>
				</div>

				{/* Ticket Medio */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center gap-4">
					<div className="flex items-center gap-4">
						<div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg">
							{formatCurrency(
								currentStats.income /
									(currentData.filter((e) => e.type === "income").length || 1),
							).replace("€", "")}
						</div>
						<div>
							<p className="text-gray-900 font-bold text-lg">Ticket Medio</p>
							<p className="text-gray-400 text-sm">Valor medio por cita</p>
						</div>
					</div>
				</div>
			</div>

			{/* GRÁFICO DIARIO + TOP TRATAMIENTOS */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* 4. AQUÍ ESTÁ LA NUEVA GRÁFICA DE BARRAS */}
				<div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
						<BarChart3 className="text-rose-500" size={20} /> Actividad Diaria
					</h3>
					<div className="h-64">
						<DailyBarChart data={currentData} currentMonth={currentMonth} />
					</div>
				</div>

				{/* Ranking Filtrado */}
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
						<Award className="text-yellow-500" size={20} /> Top Tratamientos
					</h3>

					{topTreatments.length > 0 ? (
						<div className="space-y-4">
							{topTreatments.map((t, index) => (
								<div
									key={t.name}
									className="flex items-center justify-between group">
									<div className="flex items-center gap-3">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
												index === 0
													? "bg-yellow-100 text-yellow-700"
													: index === 1
														? "bg-gray-100 text-gray-600"
														: index === 2
															? "bg-orange-100 text-orange-700"
															: "bg-rose-50 text-rose-400"
											}`}>
											#{index + 1}
										</div>
										<div>
											<p className="text-sm font-bold text-gray-800">
												{t.name}
											</p>
											<p className="text-xs text-gray-400">
												{t.count} sesiones
											</p>
										</div>
									</div>
									<span className="font-bold text-sm text-gray-600">
										{formatCurrency(t.amount)}
									</span>
								</div>
							))}
						</div>
					) : (
						<div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
							<Package size={40} className="mb-2" />
							<p className="text-sm text-center">
								No hay tratamientos registrados
								<br />
								<span className="text-xs">
									(O los ingresos no coinciden con el catálogo)
								</span>
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
