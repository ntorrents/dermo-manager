import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Pencil,
	X,
	Plus,
	GripVertical,
	ChevronDown as ChevronDownIcon,
	TrendingUp,
	TrendingDown,
	Euro,
	Users,
	CalendarDays,
} from "lucide-react";
import { filterByReportingRange } from "../../utils/dateUtils";
import { ReportingPeriodToolbar } from "../ui/ReportingPeriodToolbar";
import {
	calculateStats,
	calculateGrowth,
	getTopTreatments,
	getLowStockItems,
	getItemsWithExpiredBatches,
} from "../../utils/calculations";
import { useDashboardWidgets } from "../../hooks/useDashboardWidgets";
import {
	getWidgetById,
	getAvailableToAdd,
	getGridSpanClasses,
	MAX_WIDGETS,
	SPAN_MIN,
	SPAN_MAX,
} from "./widgets";
import { WidgetAlerts } from "./widgets/WidgetAlerts";

/** Top clientes por número de sesiones (entries tipo income con client_id) */
function useTopClients(entries = [], clients = [], startStr, endStr) {
	return useMemo(() => {
		const filtered = filterByReportingRange(entries, "date", startStr, endStr);
		const byClient = {};
		filtered
			.filter((e) => e.type === "income" && e.client_id)
			.forEach((e) => {
				byClient[e.client_id] = (byClient[e.client_id] || 0) + 1;
			});
		return Object.entries(byClient)
			.map(([clientId, count]) => {
				const client = clients.find((c) => c.id === clientId);
				const name = client
					? `${client.name || ""} ${client.surname || ""}`.trim() || "Sin nombre"
					: "Sin nombre";
				return { clientId, name, count };
			})
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);
	}, [entries, clients, startStr, endStr]);
}

/** Ítem sortable con drag handle y controles de tamaño */
function SortableWidgetItem({
	item,
	index,
	isEditing,
	widgetData,
	onRemove,
	onSizeChange,
}) {
	const { id: widgetId, colSpan, rowSpan } = item;
	const config = getWidgetById(widgetId);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: `widget-${index}` });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	if (!config) return null;
	const WidgetComponent = config.component;
	const spanClasses = getGridSpanClasses(colSpan, rowSpan);

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`relative z-[1] w-full h-full min-h-[200px] ${spanClasses} ${isDragging ? "z-[20] opacity-90 shadow-xl" : ""}`}>
			{isEditing && (
				<>
					<div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-2">
						<button
							type="button"
							className="touch-none cursor-grab active:cursor-grabbing flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
							{...attributes}
							{...listeners}
							aria-label="Arrastrar para reordenar">
							<GripVertical size={18} />
						</button>
						<div className="flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1">
							<select
								aria-label="Ancho"
								value={colSpan}
								onChange={(e) =>
									onSizeChange(index, { colSpan: Number(e.target.value) })
								}
								className="text-xs font-bold text-gray-700 bg-transparent border-none py-0.5 pr-5 pl-1 rounded cursor-pointer focus:ring-0">
								{[1, 2, 3].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
							<span className="text-gray-400 text-xs">×</span>
							<select
								aria-label="Alto"
								value={rowSpan}
								onChange={(e) =>
									onSizeChange(index, { rowSpan: Number(e.target.value) })
								}
								className="text-xs font-bold text-gray-700 bg-transparent border-none py-0.5 pr-5 pl-1 rounded cursor-pointer focus:ring-0">
								{[1, 2, 3].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</div>
						<button
							type="button"
							onClick={() => onRemove(widgetId)}
							className="p-1.5 rounded text-rose-600 hover:bg-rose-50 shrink-0"
							aria-label="Eliminar widget">
							<X size={18} />
						</button>
					</div>
				</>
			)}
			<div className="w-full h-full min-h-[200px]">
				<WidgetComponent {...widgetData} />
			</div>
		</div>
	);
}

export const DashboardTab = ({
	user,
	entries = [],
	inventory = [],
	batches = [],
	treatments = [],
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
	userName,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [showAddDropdown, setShowAddDropdown] = useState(false);
	const addDropdownRef = useRef(null);
	const { widgets, setWidgets, saveWidgets } = useDashboardWidgets(user?.id);

	const rangeStart = reportingRange?.start ?? "";
	const rangeEnd = reportingRange?.end ?? "";

	const currentData = useMemo(
		() => filterByReportingRange(entries, "date", rangeStart, rangeEnd),
		[entries, rangeStart, rangeEnd]
	);
	const currentExpenses = useMemo(() => {
		const expenseEntries = entries.filter(
			(e) => e.type === "expense" && e.is_deductible === true
		);
		return filterByReportingRange(expenseEntries, "date", rangeStart, rangeEnd);
	}, [entries, rangeStart, rangeEnd]);
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

	const currentStats = useMemo(() => calculateStats(currentData), [currentData]);
	const prevStats = useMemo(() => calculateStats(previousData), [previousData]);
	const incomeGrowth = useMemo(
		() => calculateGrowth(currentStats.income, prevStats.income),
		[currentStats.income, prevStats.income]
	);
	const topTreatments = useMemo(
		() => getTopTreatments(currentData, treatments, 5),
		[currentData, treatments]
	);
	const topClients = useTopClients(entries, clients, rangeStart, rangeEnd);
	const lowStockItems = useMemo(() => getLowStockItems(inventory, 5), [inventory]);
	const expiredStockItems = useMemo(
		() => getItemsWithExpiredBatches(inventory, batches),
		[inventory, batches]
	);
	const beneficioTotal = useMemo(
		() => currentStats.income - currentStats.expense,
		[currentStats.income, currentStats.expense]
	);
	const ventasSinIvaFiscal = useMemo(
		() =>
			currentData
				.filter((e) => e.type === "income" && !e.plan_amigo)
				.reduce(
					(acc, e) =>
						acc +
						(Number(e.tax_base) || Number(e.amount) || 0),
					0
				),
		[currentData]
	);
	const gastosSinIva = useMemo(
		() =>
			currentExpenses.reduce(
				(acc, e) => acc + (e.tax_base != null ? Number(e.tax_base) : 0),
				0
			),
		[currentExpenses]
	);
	const beneficioFiscal = ventasSinIvaFiscal - gastosSinIva;
	const ivaVentas = useMemo(
		() =>
			currentData
				.filter((e) => e.type === "income" && !e.plan_amigo)
				.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
		[currentData]
	);
	const ivaGastos = useMemo(
		() => currentExpenses.reduce((acc, e) => acc + (Number(e.tax_amount) || 0), 0),
		[currentExpenses]
	);
	const taxHucha = ivaVentas - ivaGastos;
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
	const activeClientsCount = useMemo(
		() => (clients || []).filter((c) => c.activo !== false).length,
		[clients],
	);

	const chartMonthYm = reportingRange?.refMonthYm ?? "";

	const widgetData = useMemo(
		() => ({
			reportingPreset,
			chartMonthYm,
			currentData,
			currentStats,
			prevStats,
			incomeGrowth,
			taxHucha,
			upcomingAppointments,
			clients,
			beneficioTotal,
			beneficioFiscal,
			topTreatments,
			topClients,
			lowStockItems,
			expiredStockItems,
		}),
		[
			reportingPreset,
			chartMonthYm,
			currentData,
			currentStats,
			prevStats,
			incomeGrowth,
			taxHucha,
			upcomingAppointments,
			clients,
			beneficioTotal,
			beneficioFiscal,
			topTreatments,
			topClients,
			lowStockItems,
			expiredStockItems,
		]
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		})
	);

	const activeIds = widgets.map((w) => w.id);
	const availableToAdd = getAvailableToAdd(activeIds);
	const canAddMore = widgets.length < MAX_WIDGETS;

	const removeWidget = useCallback((widgetId) => {
		setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
	}, [setWidgets]);

	const addWidget = useCallback((widgetId) => {
		setWidgets((prev) => {
			if (prev.length >= MAX_WIDGETS || prev.some((w) => w.id === widgetId))
				return prev;
			const config = getWidgetById(widgetId);
			return [
				...prev,
				{
					id: widgetId,
					colSpan: config?.defaultColSpan ?? 1,
					rowSpan: config?.defaultRowSpan ?? 1,
				},
			];
		});
		setShowAddDropdown(false);
	}, [setWidgets]);

	const onSizeChange = useCallback(
		(index, { colSpan, rowSpan }) => {
			setWidgets((prev) => {
				const next = [...prev];
				const w = next[index];
				if (!w) return prev;
				if (colSpan != null) w.colSpan = Math.max(SPAN_MIN, Math.min(SPAN_MAX, colSpan));
				if (rowSpan != null) w.rowSpan = Math.max(SPAN_MIN, Math.min(SPAN_MAX, rowSpan));
				return next;
			});
		},
		[setWidgets]
	);

	const handleDragEnd = useCallback(
		(event) => {
			const { active, over } = event;
			if (!over || active.id === over.id) return;
			const oldIndex = widgets.findIndex((_, i) => `widget-${i}` === active.id);
			const newIndex = widgets.findIndex((_, i) => `widget-${i}` === over.id);
			if (oldIndex === -1 || newIndex === -1) return;
			setWidgets((prev) => {
				const arr = [...prev];
				const [removed] = arr.splice(oldIndex, 1);
				arr.splice(newIndex, 0, removed);
				return arr;
			});
		},
		[widgets, setWidgets]
	);

	const handleExitEdit = useCallback(async () => {
		await saveWidgets(widgets);
		setIsEditing(false);
		setShowAddDropdown(false);
	}, [widgets, saveWidgets]);

	useEffect(() => {
		function handleClickOutside(e) {
			if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) {
				setShowAddDropdown(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const sortableIds = widgets.map((_, i) => `widget-${i}`);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900 tracking-tight">
						Hola, <span className="text-rose-500">{userName || "Nil"}</span>
					</h2>
					<p className="text-gray-500 text-sm font-medium mt-0.5">
						Resumen del periodo seleccionado (compartido con Finanzas).
					</p>
				</div>
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:max-w-2xl lg:shrink-0">
					<div className="flex-1 min-w-0">
						<ReportingPeriodToolbar
							preset={reportingPreset}
							onPresetChange={setReportingPreset}
							anchorYm={reportingAnchorYm}
							onAnchorYmChange={setReportingAnchorYm}
							customFrom={reportingCustomFrom}
							customTo={reportingCustomTo}
							onCustomFromChange={setReportingCustomFrom}
							onCustomToChange={setReportingCustomTo}
							rangeLabel={reportingRange?.label}
						/>
					</div>
					<button
						type="button"
						onClick={() => (isEditing ? handleExitEdit() : setIsEditing(true))}
						className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0 ${
							isEditing
								? "bg-emerald-600 text-white hover:bg-emerald-700"
								: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
						}`}
						title={isEditing ? "Guardar y cerrar" : "Editar widgets"}>
						{isEditing ? (
							<>
								<X size={16} className="shrink-0" />
								<span className="hidden sm:inline">Guardar y cerrar</span>
							</>
						) : (
							<>
								<Pencil size={16} className="shrink-0" />
								<span className="hidden sm:inline">Editar widgets</span>
							</>
						)}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
				<div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-1">
					<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
						<Euro size={14} className="text-emerald-500" /> Ingresos período
					</div>
					<p className="text-xl font-bold text-gray-900 tabular-nums">
						{currentStats.income.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
					</p>
					<p className={`text-xs font-semibold flex items-center gap-1 ${incomeGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
						{incomeGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
						{reportingPreset === "month"
							? `${incomeGrowth >= 0 ? "+" : ""}${Math.round(incomeGrowth)}% vs mes ant.`
							: "Comparativa mensual no aplica"}
					</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-1">
					<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
						<TrendingDown size={14} className="text-rose-500" /> Gastos período
					</div>
					<p className="text-xl font-bold text-gray-900 tabular-nums">
						{currentStats.expense.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
					</p>
					<p className="text-xs text-gray-500">Incluye costes operativos del rango</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-1">
					<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
						<CalendarDays size={14} className="text-blue-500" /> Próximas citas
					</div>
					<p className="text-xl font-bold text-gray-900">{upcomingAppointments.length}</p>
					<p className="text-xs text-gray-500">En la agenda desde hoy</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-1">
					<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
						<Users size={14} className="text-violet-500" /> Clientes activos
					</div>
					<p className="text-xl font-bold text-gray-900">{activeClientsCount}</p>
					<p className="text-xs text-gray-500">No archivados</p>
				</div>
			</div>

			<div className="w-full h-auto shrink-0">
				<WidgetAlerts lowStockItems={lowStockItems} expiredStockItems={expiredStockItems} />
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}>
				<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full grid-auto-rows-[minmax(200px,auto)]">
						{widgets.map((item, index) => (
							<SortableWidgetItem
								key={`${item.id}-${index}`}
								item={item}
								index={index}
								isEditing={isEditing}
								widgetData={widgetData}
								onRemove={removeWidget}
								onSizeChange={onSizeChange}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>

			{isEditing && canAddMore && (
				<div className="flex justify-center relative" ref={addDropdownRef}>
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowAddDropdown((v) => !v)}
							className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition-colors font-medium">
							<Plus size={20} />
							<span>Añadir widget</span>
							<ChevronDownIcon
								size={16}
								className={`transition-transform ${showAddDropdown ? "rotate-180" : ""}`}
							/>
						</button>
						{showAddDropdown && (
							<div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-30">
								{availableToAdd.length === 0 ? (
									<p className="text-sm text-gray-500 px-4 py-2 text-center">
										No hay más widgets o ya has llegado al máximo.
									</p>
								) : (
									<ul className="max-h-64 overflow-y-auto">
										{availableToAdd.map((w) => (
											<li key={w.id}>
												<button
													type="button"
													onClick={() => addWidget(w.id)}
													className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-rose-50 transition-colors">
													{w.title}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
