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
	Calendar,
	CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "../../utils/format";
import { filterByDate, getDateLabel } from "../../utils/dateUtils";
import {
	calculateStats,
	calculateGrowth,
	getTopTreatments,
	getLowStockItems,
	getItemsWithExpiredBatches,
} from "../../utils/calculations";
import { DailyBarChart } from "./DailyBarChart";

export const DashboardTab = ({
	entries = [],
	inventory = [],
	batches = [],
	treatments = [],
	appointments = [],
	clients = [],
	currentDate,
	setCurrentDate,
	viewMode,
	setViewMode,
	userName,
}) => {
	// --- LÓGICA DE FECHAS CENTRALIZADA ---
	const currentData = useMemo(() => {
		return filterByDate(entries, "date", viewMode, currentDate);
	}, [entries, currentDate, viewMode]);

	// Nota: La comparativa "vs mes pasado" solo la mostramos si estamos en modo mensual
	// para evitar complejidad de cálculo de "trimestre anterior"
	const previousMonth = useMemo(() => {
		if (viewMode !== "month" || !currentDate) return "";
		const date = new Date(currentDate + "-01");
		date.setMonth(date.getMonth() - 1);
		return date.toISOString().slice(0, 7);
	}, [currentDate, viewMode]);

	const previousData = useMemo(() => {
		if (viewMode !== "month") return [];
		return entries.filter((e) => e.date && e.date.startsWith(previousMonth));
	}, [entries, previousMonth, viewMode]);

	const currentStats = useMemo(() => calculateStats(currentData), [currentData]);
	const prevStats = useMemo(() => calculateStats(previousData), [previousData]);
	const growth = useMemo(
		() => calculateGrowth(currentStats.net, prevStats.net),
		[currentStats.net, prevStats.net]
	);
	const isGrowing = growth >= 0;

	const topTreatments = useMemo(
		() => getTopTreatments(currentData, treatments, 5),
		[currentData, treatments]
	);
	const lowStockItems = useMemo(
		() => getLowStockItems(inventory, 5),
		[inventory]
	);
	const expiredStockItems = useMemo(
		() => getItemsWithExpiredBatches(inventory, batches),
		[inventory, batches]
	);
	const incomeGrowth = useMemo(
		() => calculateGrowth(currentStats.income, prevStats.income),
		[currentStats.income, prevStats.income]
	);
	const taxHucha = useMemo(
		() =>
			currentData
				.filter((e) => e.type === "income")
				.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
		[currentData]
	);

	const upcomingAppointments = useMemo(() => {
		const now = new Date();
		return (appointments || [])
			.filter((a) => {
				const start = a.start_at ? new Date(a.start_at) : null;
				return start && start >= now && a.status !== "cancelled";
			})
			.sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
			.slice(0, 6);
	}, [appointments]);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* CABECERA */}
			<div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
				<div>
					<h2 className="text-2xl font-bold text-gray-800">
						Hola, <span className="text-rose-500">{userName || "Nil"}</span> 👋
					</h2>
					<p className="text-gray-400 text-sm">
						Resumen de{" "}
						<span className="font-bold text-gray-600">
							{getDateLabel(currentDate, viewMode)}
						</span>
					</p>
				</div>

				{/* SELECTOR DE FECHAS */}
				<div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 gap-2 items-center">
					<div className="relative">
						<Calendar
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
							size={16}
						/>
						<input
							type="month"
							value={currentDate}
							onChange={(e) => setCurrentDate(e.target.value)}
							className="pl-9 pr-2 py-2 bg-gray-50 rounded-lg text-sm font-bold text-gray-700 outline-none hover:bg-gray-100 transition-colors cursor-pointer border-none"
						/>
					</div>
					<div className="h-6 w-px bg-gray-200"></div>
					<select
						value={viewMode}
						onChange={(e) => setViewMode(e.target.value)}
						className="py-2 pl-2 pr-8 bg-gray-50 rounded-lg text-sm font-bold text-gray-700 outline-none hover:bg-gray-100 transition-colors appearance-none cursor-pointer border-none">
						<option value="month">Mensual</option>
						<option value="quarter">Trimestral</option>
						<option value="year">Anual</option>
					</select>
				</div>
			</div>

			{/* ALERTAS STOCK: bajo mínimos o caducados */}
			{(lowStockItems.length > 0 || expiredStockItems.length > 0) && (
				<div className="bg-red-50 border border-red-100 p-4 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
					<div className="flex items-start gap-4">
						<div className="bg-red-100 p-2 rounded-lg text-red-600 shrink-0">
							<AlertTriangle size={24} />
						</div>
						<div className="min-w-0 flex-1">
							<h4 className="font-bold text-red-800">Alertas de stock</h4>
							{lowStockItems.length > 0 && (
								<p className="text-sm text-red-700 mt-1">
									<strong>Stock bajo:</strong>{" "}
									{lowStockItems.map((i) => i.name).join(", ")}
									{lowStockItems.length > 3 && ` (+${lowStockItems.length - 3})`}
								</p>
							)}
							{expiredStockItems.length > 0 && (
								<p className="text-sm text-red-700 mt-1">
									<strong>Con lotes caducados:</strong>{" "}
									{expiredStockItems.map((i) => i.name).join(", ")}
									{expiredStockItems.length > 3 && ` (+${expiredStockItems.length - 3})`}
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* KPI 1: Facturación mes (grande) vs anterior */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="md:col-span-1 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-10 -mr-10 -mt-10 pointer-events-none"></div>
					<div>
						<p className="text-emerald-100 font-medium mb-1 flex items-center gap-2">
							<DollarSign size={16} /> Facturación {viewMode === "month" ? "mes" : "periodo"}
						</p>
						<h3 className="text-4xl font-bold tracking-tight">
							{formatCurrency(currentStats.income)}
						</h3>
					</div>
					<div className="mt-8">
						{viewMode === "month" && prevStats.income !== 0 && (
							<div
								className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${
									incomeGrowth >= 0
										? "bg-white/20 text-white"
										: "bg-red-500/30 text-red-100"
								}`}>
								{incomeGrowth >= 0 ? (
									<ArrowUpRight size={16} />
								) : (
									<ArrowDownRight size={16} />
								)}
								<span>{Math.abs(incomeGrowth).toFixed(1)}%</span>
								<span className="opacity-90 ml-1">vs mes anterior</span>
							</div>
						)}
					</div>
				</div>

				{/* KPI 2: Hucha de impuestos */}
				<div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl shadow-sm flex flex-col justify-center">
					<div className="flex justify-between items-center mb-1">
						<p className="text-amber-800 text-sm font-bold">Hucha de impuestos</p>
						<span className="text-[10px] font-bold text-amber-600 uppercase">IVA a pagar (est.)</span>
					</div>
					<p className="text-2xl font-bold text-amber-900">
						{formatCurrency(taxHucha)}
					</p>
					<p className="text-xs text-amber-700 mt-2">
						Acumulado en el periodo
					</p>
				</div>

				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
					<h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
						<CalendarDays className="text-blue-500" size={20} /> Próximos eventos
					</h3>
					{upcomingAppointments.length > 0 ? (
						<div className="space-y-2">
							{upcomingAppointments.map((a) => {
								const start = a.start_at ? new Date(a.start_at) : null;
								const client = clients?.find((c) => c.id === a.client_id);
								const title = a.title || (client ? `${client.name} ${client.surname || ""}`.trim() : "Cita");
								return (
									<div
										key={a.id}
										className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
										<div className="text-center shrink-0 w-10">
											<span className="block text-xs font-bold text-blue-600 uppercase leading-tight">
												{start ? format(start, "dd", { locale: es }) : "—"}
											</span>
											<span className="block text-[10px] text-gray-400 font-medium">
												{start ? format(start, "MMM", { locale: es }) : ""}
											</span>
										</div>
										<p className="text-sm font-bold text-gray-800 truncate flex-1" title={title}>
											{title}
										</p>
									</div>
								);
							})}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-6 text-gray-400">
							<Calendar size={32} className="mb-2 opacity-50" />
							<p className="text-sm font-medium">Sin citas próximas</p>
						</div>
					)}
				</div>
			</div>

			{/* Fila secundaria: Beneficio neto + Ingresos/Gastos */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="bg-gray-900 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-center gap-4">
					<p className="text-gray-400 font-medium flex items-center gap-2">
						<TrendingUp size={16} /> Beneficio neto
					</p>
					<p className="text-3xl font-bold">{formatCurrency(currentStats.net)}</p>
					{viewMode === "month" && prevStats.net !== 0 && (
						<span className={`text-sm font-bold ${isGrowing ? "text-green-400" : "text-red-400"}`}>
							{isGrowing ? "+" : ""}{growth.toFixed(1)}% vs mes pasado
						</span>
					)}
				</div>
				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center gap-4">
					<div className="flex justify-between items-center">
						<span className="text-gray-500 text-sm font-medium">Ingresos</span>
						<span className="font-bold text-emerald-600">{formatCurrency(currentStats.income)}</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-gray-500 text-sm font-medium">Gastos</span>
						<span className="font-bold text-rose-600">{formatCurrency(currentStats.expense)}</span>
					</div>
				</div>
			</div>

			{/* GRÁFICAS */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
						<BarChart3 className="text-rose-500" size={20} /> Actividad{" "}
						{viewMode === "month" ? "Diaria" : "Periodo"}
					</h3>
					<div className="h-64">
						<DailyBarChart data={currentData} currentMonth={currentDate} />
					</div>
				</div>

				<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
					<h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
						<Award className="text-yellow-500" size={20} /> Top Tratamientos
					</h3>
					{topTreatments.length > 0 ? (
						<div className="space-y-4">
							{(() => {
								const maxCount = Math.max(...topTreatments.map((t) => t.count), 1);
								return topTreatments.map((t, index) => (
									<div key={t.name} className="space-y-1">
										<div className="flex justify-between text-xs font-bold text-gray-600">
											<span className="truncate pr-2">{t.name}</span>
											<span>{t.count} sesiones</span>
										</div>
										<div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
											<div
												className={`h-full rounded-lg transition-all ${
													index === 0
														? "bg-rose-500"
														: index === 1
														? "bg-rose-400"
														: index === 2
														? "bg-rose-300"
														: "bg-rose-200"
												}`}
												style={{ width: `${(t.count / maxCount) * 100}%` }}
											/>
										</div>
									</div>
								));
							})()}
						</div>
					) : (
						<div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 min-h-[200px]">
							<Package size={40} className="mb-2" />
							<p className="text-sm text-center">Sin datos suficientes</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
