import React, { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import {
	format,
	parse,
	startOfWeek,
	getDay,
	addHours,
	endOfWeek,
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
	Plus,
	Trash2,
	Edit2,
	ChevronLeft,
	ChevronRight,
	Landmark,
	ShoppingBag,
	Sparkles,
	Check,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import {
	mergeCalendarEvents,
	STATUS_COLORS,
	taxDeadlinesInRange,
	actionsInRange,
} from "../../utils/calendarUtils";
import { formatCurrency } from "../../utils/format";
import { SidePanel } from "../ui/SidePanel";
import { LoadingButton } from "../ui/LoadingButton";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useTenant } from "../../context/TenantContext";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const locales = { es };
const localizer = dateFnsLocalizer({
	format,
	parse,
	startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
	getDay,
	locales,
});

const messages = {
	date: "Fecha",
	time: "Hora",
	event: "Evento",
	allDay: "Todo el día",
	week: "Semana",
	work_week: "Semana laboral",
	day: "Día",
	month: "Mes",
	previous: "Anterior",
	next: "Siguiente",
	yesterday: "Ayer",
	tomorrow: "Mañana",
	today: "Hoy",
	agenda: "Lista",
	noEventsInRange: "No hay citas en este rango",
	showMore: (n) => `+${n} más`,
};

const STATUS_OPTIONS = [
	{ value: "pending", label: "Pendiente", color: STATUS_COLORS.pending.border },
	{ value: "confirmed", label: "Confirmada", color: STATUS_COLORS.confirmed.border },
	{ value: "done", label: "Realizada", color: STATUS_COLORS.done.border },
	{ value: "cancelled", label: "Cancelada", color: STATUS_COLORS.cancelled.border },
];

const VIEW_OPTIONS = [
	{ id: Views.WEEK, label: "Semana" },
	{ id: Views.DAY, label: "Día" },
	{ id: Views.MONTH, label: "Mes" },
	{ id: Views.AGENDA, label: "Lista" },
];

const DnDCalendar = withDragAndDrop(Calendar);

function rangeForView(view, date) {
	if (view === Views.DAY) {
		return { start: startOfDay(date), end: endOfDay(date) };
	}
	if (view === Views.MONTH || view === Views.AGENDA) {
		return { start: startOfMonth(date), end: endOfMonth(date) };
	}
	return {
		start: startOfWeek(date, { weekStartsOn: 1 }),
		end: endOfWeek(date, { weekStartsOn: 1 }),
	};
}

function CalendarEventBlock({ event }) {
	const time =
		event.allDay || !event.start ? "" : format(event.start, "HH:mm");
	return (
		<div className="leading-snug px-1 py-0.5 h-full min-h-0 overflow-hidden">
			{time ? (
				<span className="text-[10px] font-semibold opacity-75 tabular-nums mr-1">
					{time}
				</span>
			) : null}
			<span className="text-[11px] font-semibold">{event.title}</span>
		</div>
	);
}

function AgendaToolbar({
	label,
	onNavigate,
	onView,
	view,
	onCreate,
}) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => onNavigate("TODAY")}
					className="h-9 px-3 rounded-xl border border-edge bg-surface text-sm font-semibold text-fg hover:bg-surface-2">
					Hoy
				</button>
				<div className="inline-flex items-center rounded-xl border border-edge bg-surface overflow-hidden">
					<button
						type="button"
						onClick={() => onNavigate("PREV")}
						className="h-9 w-9 inline-flex items-center justify-center text-muted hover:bg-surface-2 hover:text-fg"
						aria-label="Anterior">
						<ChevronLeft size={18} />
					</button>
					<button
						type="button"
						onClick={() => onNavigate("NEXT")}
						className="h-9 w-9 inline-flex items-center justify-center text-muted hover:bg-surface-2 hover:text-fg border-l border-edge"
						aria-label="Siguiente">
						<ChevronRight size={18} />
					</button>
				</div>
				<p className="text-base sm:text-lg font-bold text-fg capitalize tracking-tight ml-1">
					{label}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<div className="inline-flex rounded-xl border border-edge bg-surface-2 p-0.5">
					{VIEW_OPTIONS.map((v) => (
						<button
							key={v.id}
							type="button"
							onClick={() => onView(v.id)}
							className={`h-8 px-3 rounded-[10px] text-xs font-semibold transition-colors ${
								view === v.id
									? "bg-surface text-fg shadow-sm"
									: "text-muted hover:text-fg"
							}`}>
							{v.label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={onCreate}
					className="h-9 px-3.5 rounded-xl btn-inverse text-sm font-semibold inline-flex items-center gap-1.5">
					<Plus size={16} /> Crear
				</button>
			</div>
		</div>
	);
}

export const CalendarTab = ({
	user,
	entries = [],
	appointments = [],
	clients = [],
	treatments = [],
	showToast,
	onRefresh,
}) => {
	const { clinicId } = useTenant();
	const [view, setView] = useState(Views.WEEK);
	const [date, setDate] = useState(new Date());
	const [showModal, setShowModal] = useState(false);
	const [showDetailModal, setShowDetailModal] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState(null);
	const [selectedSlot, setSelectedSlot] = useState(null);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		startAt: "",
		startTime: "10:00",
		endTime: "11:00",
		type: "appointment",
		allDay: false,
		status: "pending",
		clientId: "",
		treatmentId: "",
		notes: "",
	});
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const visibleRange = useMemo(() => rangeForView(view, date), [view, date]);

	const events = useMemo(
		() => mergeCalendarEvents(entries, appointments, clients),
		[entries, appointments, clients],
	);

	const taxPills = useMemo(
		() => taxDeadlinesInRange(appointments, visibleRange.start, visibleRange.end),
		[appointments, visibleRange],
	);

	const weekActions = useMemo(
		() => actionsInRange(entries, clients, visibleRange.start, visibleRange.end),
		[entries, clients, visibleRange],
	);

	const openModalForSlot = (slotInfo) => {
		const d = slotInfo.start;
		setSelectedSlot(slotInfo);
		setSelectedEvent(null);
		const dateStr = format(d, "yyyy-MM-dd");
		setFormData({
			title: "",
			startAt: dateStr,
			startTime: format(d, "HH:mm"),
			endTime: format(addHours(d, 1), "HH:mm"),
			type: "appointment",
			allDay: false,
			status: "confirmed",
			clientId: "",
			treatmentId: "",
			notes: "",
		});
		setShowModal(true);
	};

	const openModalForTask = () => {
		const d = new Date();
		setSelectedSlot(null);
		setSelectedEvent(null);
		setFormData({
			title: "",
			startAt: format(d, "yyyy-MM-dd"),
			startTime: "10:00",
			endTime: "11:00",
			type: "appointment",
			allDay: false,
			status: "confirmed",
			clientId: "",
			treatmentId: "",
			notes: "",
		});
		setShowModal(true);
	};

	const handleSelectEvent = (event) => {
		if (event.resource?.type === "appointment") {
			setSelectedEvent(event);
			setShowDetailModal(true);
		}
	};

	const openEditFromDetail = () => {
		const a = selectedEvent?.resource?.appointment;
		if (!a) return;
		const start = a.start_at ? new Date(a.start_at) : new Date();
		const end = a.end_at ? new Date(a.end_at) : addHours(start, 1);
		setFormData({
			title: a.title || "",
			startAt: format(start, "yyyy-MM-dd"),
			startTime: format(start, "HH:mm"),
			endTime: format(end, "HH:mm"),
			type: a.type || "appointment",
			allDay: !!a.all_day,
			status: a.status || "pending",
			clientId: a.client_id || "",
			treatmentId: a.treatment_id || "",
			notes: a.notes || "",
		});
		setShowDetailModal(false);
		setShowModal(true);
	};

	const getPayload = () => {
		let startAt;
		let endAt;
		let all_day = false;
		if (formData.type === "task" && formData.allDay) {
			startAt = new Date(`${formData.startAt}T00:00:00`);
			endAt = new Date(`${formData.startAt}T23:59:59`);
			all_day = true;
		} else {
			startAt = new Date(`${formData.startAt}T${formData.startTime}`);
			endAt = new Date(`${formData.startAt}T${formData.endTime}`);
		}
		return {
			user_id: user.id,
			clinic_id: clinicId,
			title: formData.title || (formData.type === "task" ? "Tarea" : "Cita"),
			start_at: startAt.toISOString(),
			end_at: endAt.toISOString(),
			type: formData.type,
			all_day,
			status: formData.status || "pending",
			client_id: formData.clientId || null,
			treatment_id: formData.treatmentId || null,
			notes: formData.notes || null,
		};
	};

	const handleSubmit = async (e) => {
		e?.preventDefault?.();
		if (!clinicId) {
			showToast("No hay clínica activa", "error");
			return;
		}
		setSaving(true);
		try {
			const payload = getPayload();
			const appointmentId = selectedEvent?.resource?.appointment?.id;

			if (appointmentId) {
				const { clinic_id: _c, ...updatePayload } = payload;
				const { error } = await supabase
					.from("appointments")
					.update(updatePayload)
					.eq("id", appointmentId);
				if (error) throw error;
				showToast("Cita actualizada");
			} else {
				const { error } = await supabase
					.from("appointments")
					.insert([{ ...payload, activo: true }]);
				if (error) throw error;
				showToast(formData.type === "task" ? "Tarea creada" : "Cita creada");
			}
			setShowModal(false);
			setSelectedEvent(null);
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("Error al guardar", "error");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteAppointment = async () => {
		const appointmentId = selectedEvent?.resource?.appointment?.id;
		if (!appointmentId) return;
		setSaving(true);
		try {
			const { error } = await supabase
				.from("appointments")
				.update({ activo: false })
				.eq("id", appointmentId);
			if (error) throw error;
			showToast("Cita archivada");
			setShowModal(false);
			setShowDeleteConfirm(false);
			setShowDetailModal(false);
			setSelectedEvent(null);
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("Error al eliminar", "error");
		} finally {
			setSaving(false);
		}
	};

	const handleQuickStatus = async (status) => {
		const appointmentId = selectedEvent?.resource?.appointment?.id;
		if (!appointmentId) return;
		setSaving(true);
		try {
			const { error } = await supabase
				.from("appointments")
				.update({ status })
				.eq("id", appointmentId);
			if (error) throw error;
			showToast("Estado actualizado");
			setSelectedEvent((prev) =>
				prev
					? {
							...prev,
							status,
							resource: {
								...prev.resource,
								appointment: { ...prev.resource.appointment, status },
							},
						}
					: prev,
			);
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("No se pudo actualizar", "error");
		} finally {
			setSaving(false);
		}
	};

	const handleEventDrop = async ({ event, start, end, isAllDay }) => {
		if (event.resource?.type !== "appointment") return;
		const appointmentId = event.resource.appointment.id;
		try {
			const { error } = await supabase
				.from("appointments")
				.update({
					start_at: start.toISOString(),
					end_at: end.toISOString(),
					all_day: !!isAllDay,
				})
				.eq("id", appointmentId);
			if (error) throw error;
			showToast("Cita movida");
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("Error al mover cita", "error");
			onRefresh?.();
		}
	};

	const eventStyleGetter = (event) => {
		const isTask = event.resource?.isTask || event.resource?.appointment?.type === "task";
		const status =
			event.status || event.resource?.appointment?.status || "pending";
		const palette = isTask
			? STATUS_COLORS.task
			: STATUS_COLORS[status] || STATUS_COLORS.pending;
		return {
			style: {
				backgroundColor: palette.bg,
				borderLeft: `3px solid ${palette.border}`,
				borderTop: "none",
				borderRight: "none",
				borderBottom: "none",
				color: palette.text,
				borderRadius: "8px",
				boxShadow: "none",
				opacity: status === "cancelled" ? 0.65 : 1,
				textDecoration: status === "cancelled" ? "line-through" : undefined,
			},
		};
	};

	const components = {
		event: CalendarEventBlock,
		toolbar: (props) => <AgendaToolbar {...props} onCreate={openModalForTask} />,
	};

	const openActionDetail = useCallback((action) => {
		setSelectedEvent({
			title: action.title,
			resource: { type: "action", entry: action.entry, action },
		});
		setShowDetailModal(true);
	}, []);

	return (
		<div className="space-y-4 animate-in fade-in pb-24 md:pb-0">
			<div>
				<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
					Agenda
				</h1>
				<p className="text-sm text-muted mt-1">
					Citas en la rejilla · ventas y sesiones como actividad
				</p>
			</div>

			{taxPills.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-bg px-3 py-2">
					<span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warning-text shrink-0">
						<Landmark size={13} className="text-warning-icon" /> Fiscal
					</span>
					{taxPills.slice(0, 4).map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => {
								setSelectedEvent({
									title: t.title,
									resource: { type: "tax_deadline", appointment: t.appointment },
								});
								setShowDetailModal(true);
							}}
							className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-warning-border px-2.5 py-1 text-xs font-medium text-warning-text hover:bg-surface-2 max-w-[220px]">
							<span className="truncate">{t.title.replace(/^Ventana Impuestos\s*/i, "AEAT ")}</span>
							<span className="text-warning-text-light tabular-nums shrink-0">
								{format(t.start, "d MMM", { locale: es })}–{format(t.end, "d MMM", { locale: es })}
							</span>
						</button>
					))}
					{taxPills.length > 4 && (
						<span className="text-xs text-warning-text-light">+{taxPills.length - 4}</span>
					)}
				</div>
			)}

			<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
				<div className="rounded-2xl border border-edge bg-surface p-3 sm:p-4 shadow-sm overflow-hidden">
					<div
						className={[
							"agenda-calendar",
							"h-[min(72vh,720px)] min-h-[480px]",
							"[&_.rbc-calendar]:font-sans [&_.rbc-calendar]:text-fg",
							"[&_.rbc-header]:border-edge [&_.rbc-header]:py-2.5 [&_.rbc-header]:text-[11px] [&_.rbc-header]:font-bold [&_.rbc-header]:uppercase [&_.rbc-header]:tracking-wider [&_.rbc-header]:text-muted",
							"[&_.rbc-time-header]:border-edge",
							"[&_.rbc-time-content]:border-edge",
							"[&_.rbc-timeslot-group]:border-edge",
							"[&_.rbc-day-slot_.rbc-time-slot]:border-edge",
							"[&_.rbc-today]:bg-primary-soft",
							"[&_.rbc-off-range-bg]:bg-surface-2",
							"[&_.rbc-current-time-indicator]:bg-danger",
							"[&_.rbc-event]:border-0 [&_.rbc-event]:shadow-none [&_.rbc-event]:px-0",
							"[&_.rbc-event-label]:hidden",
							"[&_.rbc-addons-dnd-resizable]:overflow-hidden",
							"[&_.rbc-month-view]:border-edge",
							"[&_.rbc-month-row]:border-edge",
							"[&_.rbc-day-bg]:border-edge",
							"[&_.rbc-time-gutter_.rbc-label]:text-[11px] [&_.rbc-time-gutter_.rbc-label]:text-muted [&_.rbc-time-gutter_.rbc-label]:font-medium",
							"[&_.rbc-agenda-view]:text-sm",
						].join(" ")}>
						<DnDCalendar
							localizer={localizer}
							events={events}
							view={view}
							date={date}
							onView={setView}
							onNavigate={setDate}
							onSelectSlot={openModalForSlot}
							onSelectEvent={handleSelectEvent}
							onEventDrop={handleEventDrop}
							selectable
							draggableAccessor="draggable"
							messages={messages}
							culture="es"
							components={components}
							eventPropGetter={eventStyleGetter}
							startAccessor="start"
							endAccessor="end"
							titleAccessor="title"
							resizable={false}
							popup
							step={30}
							timeslots={2}
							min={new Date(1970, 0, 1, 8, 0, 0)}
							max={new Date(1970, 0, 1, 21, 0, 0)}
							scrollToTime={new Date(1970, 0, 1, 8, 0, 0)}
						/>
					</div>
				</div>

				<aside className="rounded-2xl border border-edge bg-surface p-4 shadow-sm xl:sticky xl:top-20">
					<div className="flex items-center justify-between gap-2 mb-3">
						<p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
							<Sparkles size={13} /> Actividad
						</p>
						<span className="text-[11px] font-medium text-muted tabular-nums">
							{weekActions.length}
						</span>
					</div>
					<p className="text-xs text-muted mb-3 leading-snug">
						Ventas y tratamientos hechos en el periodo visible. No ocupan huecos de cita.
					</p>
					{weekActions.length === 0 ? (
						<p className="text-sm text-muted py-6 text-center">
							Sin actividad registrada
						</p>
					) : (
						<ul className="space-y-2 max-h-[min(60vh,560px)] overflow-y-auto [scrollbar-width:thin]">
							{weekActions.slice(0, 40).map((a) => (
								<li key={a.id}>
									<button
										type="button"
										onClick={() => openActionDetail(a)}
										className="w-full text-left rounded-xl border border-edge bg-surface-2 hover:brightness-110 px-3 py-2.5 transition-colors">
										<div className="flex items-start gap-2">
											<span
												className={`mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-lg ${
													a.subtitle === "Venta"
														? "bg-income-soft text-income"
														: "bg-primary-soft text-primary"
												}`}>
												{a.subtitle === "Venta" ? (
													<ShoppingBag size={12} />
												) : (
													<Sparkles size={12} />
												)}
											</span>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium text-fg leading-snug">
													{a.title}
												</p>
												<p className="text-[11px] text-muted mt-0.5 flex items-center justify-between gap-2">
													<span className="capitalize">
														{format(a.date, "EEE d MMM", { locale: es })}
													</span>
													{a.amount != null && (
														<span className="tabular-nums font-semibold text-fg">
															{formatCurrency(a.amount)}
														</span>
													)}
												</p>
											</div>
										</div>
									</button>
								</li>
							))}
						</ul>
					)}
				</aside>
			</div>

			<SidePanel
				isOpen={showModal}
				onClose={() => {
					setShowModal(false);
					setSelectedEvent(null);
				}}
				title={selectedEvent ? "Editar cita o tarea" : "Nueva cita"}
				subtitle="Arrastra citas en la semana para reprogramar"
				size="md"
				footer={
					<div className="flex gap-3">
						{selectedEvent?.resource?.appointment && (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-danger hover:bg-red-50 font-bold">
								<Trash2 size={18} /> Eliminar
							</button>
						)}
						<LoadingButton
							loading={saving}
							type="button"
							onClick={handleSubmit}
							className="flex-1 btn-primary py-3">
							{saving ? "Guardando..." : "Guardar"}
						</LoadingButton>
					</div>
				}>
				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Tipo
						</label>
						<select
							value={formData.type}
							onChange={(e) =>
								setFormData({ ...formData, type: e.target.value })
							}
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
							<option value="appointment">Cita con paciente</option>
							<option value="task">Tarea personal</option>
						</select>
					</div>

					{(formData.type === "appointment" || formData.type === "task") && (
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
								Estado
							</label>
							<select
								value={formData.status}
								onChange={(e) =>
									setFormData({ ...formData, status: e.target.value })
								}
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
								{STATUS_OPTIONS.map((s) => (
									<option key={s.value} value={s.value}>
										{s.label}
									</option>
								))}
							</select>
						</div>
					)}

					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Título
						</label>
						<input
							required
							placeholder={
								formData.type === "task"
									? "Ej: Revisar pedido, Llamar a proveedor..."
									: "Ej: Dermapen - María García"
							}
							value={formData.title}
							onChange={(e) =>
								setFormData({ ...formData, title: e.target.value })
							}
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
						/>
					</div>

					{formData.type === "appointment" && (
						<>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									Cliente
								</label>
								<select
									value={formData.clientId}
									onChange={(e) =>
										setFormData({ ...formData, clientId: e.target.value })
									}
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
									<option value="">Seleccionar...</option>
									{clients.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name} {c.surname || ""}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									Tratamiento
								</label>
								<select
									value={formData.treatmentId}
									onChange={(e) =>
										setFormData({ ...formData, treatmentId: e.target.value })
									}
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
									<option value="">Opcional</option>
									{treatments.map((t) => (
										<option key={t.id} value={t.id}>
											{t.name}
										</option>
									))}
								</select>
							</div>
						</>
					)}

					{formData.type === "task" && (
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={formData.allDay}
								onChange={(e) =>
									setFormData({ ...formData, allDay: e.target.checked })
								}
								className="rounded border-gray-300 text-rose-700 focus:ring-rose-500"
							/>
							<span className="text-sm font-bold text-gray-700">Todo el día</span>
						</label>
					)}

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
								Fecha
							</label>
							<input
								required
								type="date"
								value={formData.startAt}
								onChange={(e) =>
									setFormData({ ...formData, startAt: e.target.value })
								}
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							/>
						</div>
						{!(formData.type === "task" && formData.allDay) && (
							<>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
										Hora inicio
									</label>
									<input
										required
										type="time"
										value={formData.startTime}
										onChange={(e) =>
											setFormData({ ...formData, startTime: e.target.value })
										}
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									/>
								</div>
								<div className="col-span-2">
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
										Hora fin
									</label>
									<input
										required
										type="time"
										value={formData.endTime}
										onChange={(e) =>
											setFormData({ ...formData, endTime: e.target.value })
										}
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									/>
								</div>
							</>
						)}
					</div>

					<div>
						<label className="text-[11px] font-black text-muted uppercase tracking-widest mb-2 block">
							Notas
						</label>
						<textarea
							rows="2"
							placeholder="Opcional"
							value={formData.notes}
							onChange={(e) =>
								setFormData({ ...formData, notes: e.target.value })
							}
							className="input-field resize-none"
						/>
					</div>
				</form>
			</SidePanel>

			<ConfirmModal
				isOpen={showDeleteConfirm}
				title="Eliminar cita"
				message={`Estás a punto de archivar esta cita${
					selectedEvent?.resource?.appointment?.title
						? ` («${selectedEvent.resource.appointment.title}»)`
						: ""
				}.\n\nDejará de mostrarse en la agenda.\n\n¿Confirmas?`}
				onConfirm={handleDeleteAppointment}
				onCancel={() => setShowDeleteConfirm(false)}
				isDestructive
				confirmLabel="Eliminar cita"
			/>

			<SidePanel
				isOpen={showDetailModal}
				onClose={() => {
					setShowDetailModal(false);
					setSelectedEvent(null);
				}}
				title={
					selectedEvent?.resource?.type === "action"
						? "Actividad registrada"
						: selectedEvent?.resource?.type === "tax_deadline"
							? "Ventana fiscal AEAT"
							: selectedEvent?.resource?.appointment?.type === "task"
								? "Detalle de tarea"
								: "Detalle de cita"
				}
				size="md"
				footer={
					selectedEvent?.resource?.type === "appointment" ? (
						<div className="flex flex-col gap-2 w-full">
							<div className="grid grid-cols-2 gap-2">
								{[
									{ s: "confirmed", l: "Confirmada" },
									{ s: "done", l: "Realizada" },
									{ s: "pending", l: "Pendiente" },
									{ s: "cancelled", l: "Cancelar" },
								].map(({ s, l }) => (
									<button
										key={s}
										type="button"
										disabled={saving}
										onClick={() => handleQuickStatus(s)}
										className={`text-xs font-semibold py-2 rounded-xl border transition-colors ${
											selectedEvent?.resource?.appointment?.status === s
												? "border-slate-900 bg-slate-900 text-white"
												: "border-slate-200 text-slate-700 hover:bg-slate-50"
										}`}>
										{selectedEvent?.resource?.appointment?.status === s ? (
											<span className="inline-flex items-center gap-1">
												<Check size={12} /> {l}
											</span>
										) : (
											l
										)}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={openEditFromDetail}
								className="w-full btn-ghost py-3 inline-flex items-center justify-center gap-2">
								<Edit2 size={18} /> Editar completa
							</button>
						</div>
					) : null
				}>
				{selectedEvent?.resource?.type === "action" && (
					<SessionDetail
						entry={selectedEvent.resource.entry}
						clients={clients}
						headline={selectedEvent.resource.action?.title}
					/>
				)}
				{selectedEvent?.resource?.type === "tax_deadline" && (
					<div className="space-y-3 text-sm text-fg">
						<p className="font-bold">
							{selectedEvent.resource.appointment?.title}
						</p>
						<p className="text-muted whitespace-pre-wrap">
							{selectedEvent.resource.appointment?.notes ||
								"Plazo de presentación de impuestos. No cuenta como cita clínica."}
						</p>
						<p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">
							Aviso compacto del módulo Fiscalidad. Detalle completo en Finanzas →
							Fiscalidad.
						</p>
					</div>
				)}
				{selectedEvent?.resource?.type === "appointment" && (
					<AppointmentDetail
						appointment={selectedEvent.resource.appointment}
						clients={clients}
						treatments={treatments}
					/>
				)}
			</SidePanel>
		</div>
	);
};

function SessionDetail({ entry, clients, headline }) {
	const client = clients.find((c) => c.id === entry.client_id);
	const clientName = client
		? `${client.name} ${client.surname || ""}`.trim()
		: "—";
	const treatmentName = entry.description?.split("(")[0]?.trim() || "Sesión";

	return (
		<div className="space-y-4">
			{headline && (
				<p className="text-sm font-semibold text-slate-800 leading-snug">{headline}</p>
			)}
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Concepto
				</span>
				<p className="font-bold text-gray-800 mt-1">{treatmentName}</p>
			</div>
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Cliente
				</span>
				<p className="font-bold text-gray-800 mt-1">{clientName}</p>
			</div>
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Fecha
				</span>
				<p className="font-bold text-gray-800 mt-1">
					{entry.date
						? format(new Date(entry.date + "T12:00:00"), "EEEE d 'de' MMMM yyyy", {
								locale: es,
							})
						: "—"}
				</p>
			</div>
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Importe
				</span>
				<p className="font-bold text-rose-700 mt-1 text-lg">
					{formatCurrency(entry.amount ?? 0)}
				</p>
			</div>
			{entry.description && (
				<div>
					<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
						Descripción
					</span>
					<p className="font-medium text-gray-700 mt-1 text-sm">{entry.description}</p>
				</div>
			)}
		</div>
	);
}

function AppointmentDetail({ appointment, clients, treatments }) {
	const client = clients.find((c) => c.id === appointment.client_id);
	const clientName = client
		? `${client.name} ${client.surname || ""}`.trim()
		: null;
	const treatment = treatments.find((t) => t.id === appointment.treatment_id);

	const start = appointment.start_at ? new Date(appointment.start_at) : null;
	const end = appointment.end_at ? new Date(appointment.end_at) : null;

	const formatRange = () => {
		if (!start) return "—";
		if (appointment.all_day) {
			return format(start, "EEEE d 'de' MMMM yyyy", { locale: es });
		}
		if (end) {
			return `${format(start, "d MMM yyyy, HH:mm", { locale: es })} – ${format(end, "HH:mm", { locale: es })}`;
		}
		return format(start, "d MMM yyyy, HH:mm", { locale: es });
	};

	return (
		<div className="space-y-4">
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Título
				</span>
				<p className="font-bold text-gray-800 mt-1">{appointment.title || "—"}</p>
			</div>
			{appointment.type === "appointment" && clientName && (
				<div>
					<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
						Cliente
					</span>
					<p className="font-bold text-gray-800 mt-1">{clientName}</p>
				</div>
			)}
			{treatment && (
				<div>
					<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
						Tratamiento
					</span>
					<p className="font-bold text-gray-800 mt-1">{treatment.name}</p>
				</div>
			)}
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					{appointment.all_day ? "Fecha" : "Fecha y hora"}
				</span>
				<p className="font-bold text-gray-800 mt-1">{formatRange()}</p>
			</div>
			{appointment.notes && (
				<div>
					<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
						Notas
					</span>
					<p className="font-medium text-gray-700 mt-1 text-sm whitespace-pre-wrap">
						{appointment.notes}
					</p>
				</div>
			)}
		</div>
	);
};
