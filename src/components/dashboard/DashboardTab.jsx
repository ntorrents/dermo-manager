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
import { Calendar, Pencil, X, Plus, GripVertical, ChevronDown as ChevronDownIcon } from "lucide-react";
import { getDateLabel } from "../../utils/dateUtils";
import { filterByDate } from "../../utils/dateUtils";
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

/** Top clientes por número de sesiones (entries tipo income con client_id) */
function useTopClients(entries = [], clients = [], viewMode, currentDate) {
	return useMemo(() => {
		const filtered = filterByDate(entries, "date", viewMode, currentDate);
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
	}, [entries, clients, viewMode, currentDate]);
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
	currentDate,
	setCurrentDate,
	viewMode,
	setViewMode,
	userName,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [showAddDropdown, setShowAddDropdown] = useState(false);
	const addDropdownRef = useRef(null);
	const { widgets, setWidgets, saveWidgets } = useDashboardWidgets(user?.id);

	const currentData = useMemo(
		() => filterByDate(entries, "date", viewMode, currentDate),
		[entries, currentDate, viewMode]
	);
	const currentExpenses = useMemo(() => {
		const expenseEntries = entries.filter(
			(e) => e.type === "expense" && e.is_deductible === true
		);
		return filterByDate(expenseEntries, "date", viewMode, currentDate);
	}, [entries, currentDate, viewMode]);
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
	const incomeGrowth = useMemo(
		() => calculateGrowth(currentStats.income, prevStats.income),
		[currentStats.income, prevStats.income]
	);
	const topTreatments = useMemo(
		() => getTopTreatments(currentData, treatments, 5),
		[currentData, treatments]
	);
	const topClients = useTopClients(entries, clients, viewMode, currentDate);
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

	const widgetData = useMemo(
		() => ({
			viewMode,
			currentDate,
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
			viewMode,
			currentDate,
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

				<div className="flex items-center gap-2">
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

					<button
						type="button"
						onClick={() => (isEditing ? handleExitEdit() : setIsEditing(true))}
						className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors sm:justify-start ${
							isEditing
								? "bg-emerald-600 text-white hover:bg-emerald-700"
								: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
						}`}
						title={isEditing ? "Guardar y cerrar" : "Editar Widgets"}>
						{isEditing ? (
							<>
								<X size={16} className="shrink-0" />
								<span className="hidden sm:inline">Guardar y cerrar</span>
							</>
						) : (
							<>
								<Pencil size={16} className="shrink-0" />
								<span className="hidden sm:inline">Editar Widgets</span>
							</>
						)}
					</button>
				</div>
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
