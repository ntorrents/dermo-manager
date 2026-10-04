import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GlobalDateFilter } from "../layout/GlobalDateFilter";
import {
	TrendingUp,
	TrendingDown,
	CalendarDays,
	AlertTriangle,
	Package,
} from "lucide-react";
import { filterByReportingRange, toLocalYmd } from "../../utils/dateUtils";
import {
	calculateStats,
	calculateGrowth,
	getTopRevenueItems,
	getLowStockItems,
	getItemsWithExpiredBatches,
} from "../../utils/calculations";
import { useTenant } from "../../context/TenantContext";
import { DashboardUnifiedAlerts } from "./DashboardUnifiedAlerts";
import { WidgetTopTratamientos } from "./widgets/WidgetTopTratamientos";
import { WidgetOcupacionSemanal } from "./widgets/WidgetOcupacionSemanal";
import { WidgetPacientesReactivar } from "./widgets/WidgetPacientesReactivar";

export const DashboardTab = ({
	entries = [],
	inventory = [],
	batches = [],
	appointments = [],
	clients = [],
	reportingRange,
	reportingPreset,
	setReportingPreset,
	reportingAnchorYm,
	setReportingAnchorYm,
	reportingCustomFrom,
	setReportingCustomFrom,
	reportingCustomTo,
	setReportingCustomTo,
	onReportingGoToday,
	onNavigateTab,
}) => {
	const { clinic } = useTenant();
	const navigate = useNavigate();

	const rangeStart = reportingRange?.start ?? "";
	const rangeEnd = reportingRange?.end ?? "";

	const currentData = useMemo(
		() => filterByReportingRange(entries, "date", rangeStart, rangeEnd),
		[entries, rangeStart, rangeEnd],
	);
	const previousMonthYm = useMemo(() => {
		if (reportingPreset !== "month" || !reportingRange?.refMonthYm) return "";
		const parts = reportingRange.refMonthYm.split("-").map(Number);
		const d = new Date(parts[0], parts[1] - 1, 1);
		d.setMonth(d.getMonth() - 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}, [reportingPreset, reportingRange?.refMonthYm]);
	const previousData = useMemo(() => {
		if (reportingPreset !== "month" || !previousMonthYm) return [];
		return entries.filter((e) => e.date && e.date.startsWith(previousMonthYm));
	}, [entries, previousMonthYm, reportingPreset]);

	const currentStats = useMemo(
		() => calculateStats(currentData),
		[currentData],
	);
	const prevStats = useMemo(() => calculateStats(previousData), [previousData]);
	const incomeGrowth = useMemo(
		() => calculateGrowth(currentStats.income, prevStats.income),
		[currentStats.income, prevStats.income],
	);
	const topRevenue = useMemo(
		() => getTopRevenueItems(currentData, 5),
		[currentData],
	);
	const lowStockItems = useMemo(
		() => getLowStockItems(inventory, 5),
		[inventory],
	);
	const expiredStockItems = useMemo(
		() => getItemsWithExpiredBatches(inventory, batches),
		[inventory, batches],
	);
	const beneficioTotal = useMemo(
		() => currentStats.income - currentStats.expense,
		[currentStats.income, currentStats.expense],
	);
	const appointmentsToday = useMemo(() => {
		const todayYmd = toLocalYmd(new Date());
		return (appointments || [])
			.filter((a) => {
				if (a.type === "tax_deadline" || a.type === "task") return false;
				if (a.status === "cancelled") return false;
				return a.start_at && toLocalYmd(a.start_at) === todayYmd;
			})
			.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
	}, [appointments]);
	const upcomingAppointments = useMemo(() => {
		const now = new Date();
		return (appointments || [])
			.filter((a) => {
				if (a.type === "tax_deadline" || a.type === "task") return false;
				const start = a.start_at ? new Date(a.start_at) : null;
				return start && start >= now && a.status !== "cancelled";
			})
			.sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
			.slice(0, 6);
	}, [appointments]);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900 tracking-tight">
						Dashboard
					</h2>
					<p className="text-gray-500 text-sm font-medium mt-0.5">
						Resumen operativo del periodo seleccionado.
					</p>
				</div>
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 lg:flex-1 lg:max-w-none lg:justify-end">
					{typeof setReportingPreset === "function" && (
						<GlobalDateFilter
							preset={reportingPreset}
							onPresetChange={setReportingPreset}
							anchorYm={reportingAnchorYm}
							onAnchorYmChange={setReportingAnchorYm}
							customFrom={reportingCustomFrom}
							customTo={reportingCustomTo}
							onCustomFromChange={setReportingCustomFrom}
							onCustomToChange={setReportingCustomTo}
							rangeLabel={reportingRange?.label}
							onTodayClick={onReportingGoToday}
						/>
					)}
				</div>
			</div>

			{/* Bento operativo superior */}
			<div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_auto] gap-3 md:gap-4">
				<section className="lg:col-span-7 lg:row-span-2 rounded-2xl border border-edge bg-surface p-5 flex flex-col gap-3 min-h-[18rem] shadow-sm">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
							<CalendarDays size={14} /> Agenda de hoy
						</p>
						{onNavigateTab && (
							<button
								type="button"
								onClick={() => onNavigateTab("calendar")}
								className="text-xs font-medium text-muted hover:text-fg transition-colors">
								Ver agenda →
							</button>
						)}
					</div>
					{appointmentsToday.length === 0 ? (
						<div className="flex-1 flex flex-col items-center justify-center text-center py-6">
							<p className="text-sm font-medium text-fg">Sin citas hoy</p>
							<p className="text-xs text-muted mt-1">
								⌘K → «Nueva cita rápida»
							</p>
						</div>
					) : (
						<ul className="space-y-1 flex-1">
							{appointmentsToday.slice(0, 6).map((a) => {
								const t = a.start_at
									? new Date(a.start_at).toLocaleTimeString("es-ES", {
											hour: "2-digit",
											minute: "2-digit",
										})
									: "—";
								const client = clients.find((c) => c.id === a.client_id);
								const clientName = client
									? [client.name, client.surname].filter(Boolean).join(" ")
									: null;
								return (
									<li
										key={a.id}
										className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 transition-colors">
										<span className="text-xs font-medium text-muted w-12 shrink-0 tabular-nums">
											{t}
										</span>
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium text-fg truncate">
												{a.title || "Cita"}
											</p>
											{clientName && (
												<p className="text-[11px] text-muted truncate">
													{clientName}
												</p>
											)}
										</div>
										<span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
											<span
												className={`w-1.5 h-1.5 rounded-full ${
													a.status === "confirmed"
														? "bg-success"
														: a.status === "pending"
															? "bg-warning"
															: "bg-muted"
												}`}
											/>
											{a.status === "confirmed"
												? "OK"
												: a.status === "pending"
													? "Pend."
													: a.status || "—"}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</section>

				<section className="lg:col-span-5 rounded-2xl border border-edge bg-surface shadow-sm overflow-hidden">
					<div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x divide-edge">
						<div className="px-4 py-4 space-y-1">
							<p className="text-xs font-medium text-muted uppercase tracking-wider">
								Ingresos
							</p>
							<p className="text-xl font-semibold text-fg tabular-nums tracking-tight">
								{currentStats.income.toLocaleString("es-ES", {
									maximumFractionDigits: 0,
								})}{" "}
								€
							</p>
							<p
								className={`text-xs font-medium flex items-center gap-1 tabular-nums ${
									incomeGrowth >= 0 ? "text-success" : "text-danger"
								}`}>
								{incomeGrowth >= 0 ? (
									<TrendingUp size={12} />
								) : (
									<TrendingDown size={12} />
								)}
								{reportingPreset === "month"
									? `${incomeGrowth >= 0 ? "+" : ""}${Math.round(incomeGrowth)}%`
									: "—"}
							</p>
						</div>
						<div className="px-4 py-4 space-y-1">
							<p className="text-xs font-medium text-muted uppercase tracking-wider">
								Gastos
							</p>
							<p className="text-xl font-semibold text-fg tabular-nums tracking-tight">
								{currentStats.expense.toLocaleString("es-ES", {
									maximumFractionDigits: 0,
								})}{" "}
								€
							</p>
							<p className="text-xs text-muted">Periodo</p>
						</div>
						<div className="px-4 py-4 space-y-1 bg-surface-2">
							<p className="text-xs font-medium text-muted uppercase tracking-wider">
								Beneficio
							</p>
							<p className="text-xl font-semibold text-fg tabular-nums tracking-tight">
								{beneficioTotal.toLocaleString("es-ES", {
									maximumFractionDigits: 0,
								})}{" "}
								€
							</p>
							<p className="text-xs text-muted">Caja</p>
						</div>
					</div>
				</section>

				<section className="lg:col-span-5 rounded-2xl border border-edge bg-surface p-4 space-y-2 shadow-sm">
					<p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
						<AlertTriangle size={13} className="text-warning" /> Riesgo
						operativo
					</p>
					{lowStockItems.length > 0 ? (
						<p className="text-sm text-fg leading-snug">
							<span className="font-semibold text-danger">Rotura de stock</span>{" "}
							en {lowStockItems.length} material
							{lowStockItems.length === 1 ? "" : "es"}
							{appointmentsToday.length > 0
								? ` · ${appointmentsToday.length} cita${appointmentsToday.length === 1 ? "" : "s"} hoy`
								: ""}
							.{" "}
							<span className="text-muted">
								Ej: {lowStockItems[0]?.name}
								{lowStockItems[0]?.stock != null
									? ` (${lowStockItems[0].stock} ud)`
									: ""}
							</span>
						</p>
					) : expiredStockItems.length > 0 ? (
						<p className="text-sm text-fg">
							<span className="font-semibold text-warning">Lotes caducados</span>{" "}
							en {expiredStockItems.length} ítem
							{expiredStockItems.length === 1 ? "" : "s"}.
						</p>
					) : (
						<p className="text-sm text-muted flex items-center gap-2">
							<Package size={14} /> Sin alertas de stock.
						</p>
					)}
					{onNavigateTab &&
						(lowStockItems.length > 0 || expiredStockItems.length > 0) && (
							<button
								type="button"
								onClick={() => onNavigateTab("inventory")}
								className="text-xs font-medium text-muted hover:text-fg">
								Ir a inventario →
							</button>
						)}
					<div className="pt-2 border-t border-edge text-xs text-muted">
						<span className="font-medium text-fg tabular-nums">
							{upcomingAppointments.length}
						</span>{" "}
						próximas citas en agenda
					</div>
				</section>
			</div>

			<div className="w-full h-auto shrink-0">
				<DashboardUnifiedAlerts
					appointmentsToday={appointmentsToday}
					lowStockItems={lowStockItems}
					expiredStockItems={expiredStockItems}
					clients={clients}
					onGoCalendar={
						onNavigateTab ? () => onNavigateTab("calendar") : undefined
					}
					onGoInventory={
						onNavigateTab ? () => onNavigateTab("inventory") : undefined
					}
				/>
			</div>

			{/* Bento analítico inferior */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
				<WidgetTopTratamientos topRevenue={topRevenue} />
				<WidgetOcupacionSemanal appointments={appointments} />
				<WidgetPacientesReactivar
					clients={clients}
					entries={entries}
					clinicName={clinic?.name}
					onOpenClient={(id) => navigate(`/clientes/${id}`)}
				/>
			</div>
		</div>
	);
};
