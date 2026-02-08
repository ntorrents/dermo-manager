import React, { useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addHours } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { mergeCalendarEvents, STATUS_COLORS } from "../../utils/calendarUtils";
import { formatCurrency } from "../../utils/format";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { LoadingButton } from "../ui/LoadingButton";
import { ConfirmModal } from "../ui/ConfirmModal";
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
	agenda: "Agenda",
	noEventsInRange: "No hay eventos en este rango",
};

const STATUS_OPTIONS = [
	{ value: "pending", label: "Pendiente", color: STATUS_COLORS.pending },
	{ value: "confirmed", label: "Confirmada", color: STATUS_COLORS.confirmed },
	{ value: "done", label: "Realizada", color: STATUS_COLORS.done },
	{ value: "cancelled", label: "Cancelada", color: STATUS_COLORS.cancelled },
];

const DnDCalendar = withDragAndDrop(Calendar);

export const CalendarTab = ({
	user,
	entries = [],
	appointments = [],
	clients = [],
	treatments = [],
	showToast,
	onRefresh,
}) => {
	const [view, setView] = useState("month");
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

	const events = useMemo(
		() => mergeCalendarEvents(entries, appointments, clients),
		[entries, appointments, clients]
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
			status: "pending",
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
			type: "task",
			allDay: false,
			status: "pending",
			clientId: "",
			treatmentId: "",
			notes: "",
		});
		setShowModal(true);
	};

	const handleSelectEvent = (event) => {
		if (event.resource?.type === "session") {
			setSelectedEvent(event);
			setShowDetailModal(true);
			return;
		}
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
		let startAt, endAt, all_day = false;
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
		e.preventDefault();
		setSaving(true);
		try {
			const payload = getPayload();
			const appointmentId = selectedEvent?.resource?.appointment?.id;

			if (appointmentId) {
				const { error } = await supabase
					.from("appointments")
					.update(payload)
					.eq("id", appointmentId);
				if (error) throw error;
				showToast("Cita actualizada");
			} else {
				const { error } = await supabase
					.from("appointments")
					.insert([payload]);
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
				.delete()
				.eq("id", appointmentId);
			if (error) throw error;
			showToast("Cita eliminada");
			setShowModal(false);
			setShowDeleteConfirm(false);
			setSelectedEvent(null);
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("Error al eliminar", "error");
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
		const isSession = event.resource?.type === "session";
		if (isSession) {
			return { style: { backgroundColor: "#f43f5e" } };
		}
		const status = event.status || event.resource?.appointment?.status || "pending";
		const bg = STATUS_COLORS[status] || STATUS_COLORS.pending;
		return {
			style: {
				backgroundColor: bg,
				textDecoration: status === "cancelled" ? "line-through" : undefined,
				opacity: status === "cancelled" ? 0.8 : 1,
			},
		};
	};


	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h2 className="text-2xl xl:text-3xl font-black text-gray-800 tracking-tight">
					Agenda
				</h2>
				<button
					onClick={openModalForTask}
					className="bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all">
					<Plus size={18} /> Nueva cita / Tarea
				</button>
			</div>

			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
				<div className="h-[500px] xl:h-[600px] [&_.rbc-calendar]:font-sans [&_.rbc-toolbar]:flex-wrap [&_.rbc-toolbar]:gap-2 [&_.rbc-toolbar]:mb-4 [&_.rbc-toolbar_label]:font-black [&_.rbc-toolbar_button]:rounded-xl [&_.rbc-toolbar_button]:px-4 [&_.rbc-toolbar_button]:py-2 [&_.rbc-toolbar_button]:font-bold [&_.rbc-today]:bg-rose-50/50 [&_.rbc-event]:rounded-lg [&_.rbc-event]:py-1 [&_.rbc-event]:px-2 [&_.rbc-event-content]:font-bold [&_.rbc-event-content]:text-sm">
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
						eventPropGetter={eventStyleGetter}
						startAccessor="start"
						endAccessor="end"
						titleAccessor="title"
						resizable={false}
					/>
				</div>
			</div>

			<AdaptiveModal
				isOpen={showModal}
				onClose={() => {
					setShowModal(false);
					setSelectedEvent(null);
				}}
				title={selectedEvent ? "Editar cita o tarea" : "Nueva cita o tarea"}
				maxWidth="max-w-md">
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
								className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
							/>
							<span className="text-sm font-bold text-gray-700">
								Todo el día
							</span>
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
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Notas
						</label>
						<textarea
							rows="2"
							placeholder="Opcional"
							value={formData.notes}
							onChange={(e) =>
								setFormData({ ...formData, notes: e.target.value })
							}
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none resize-none"
						/>
					</div>

					<div className="flex gap-3">
						{selectedEvent?.resource?.appointment && (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold">
								<Trash2 size={18} /> Eliminar
							</button>
						)}
						<LoadingButton
							loading={saving}
							type="submit"
							className="flex-1 bg-primary text-white font-black py-4 rounded-xl">
							{saving ? "Guardando..." : "Guardar"}
						</LoadingButton>
					</div>
				</form>
			</AdaptiveModal>

			<ConfirmModal
				isOpen={showDeleteConfirm}
				title="Eliminar cita"
				message="¿Estás seguro de que quieres eliminar esta cita?"
				onConfirm={handleDeleteAppointment}
				onCancel={() => setShowDeleteConfirm(false)}
				isDestructive
			/>

			<AdaptiveModal
				isOpen={showDetailModal}
				onClose={() => {
					setShowDetailModal(false);
					setSelectedEvent(null);
				}}
				title={
					selectedEvent?.resource?.type === "session"
						? "Detalle de sesión"
						: selectedEvent?.resource?.appointment?.type === "task"
							? "Detalle de tarea"
							: "Detalle de cita"
				}
				maxWidth="max-w-md">
				{selectedEvent?.resource?.type === "session" && (
					<SessionDetail
						entry={selectedEvent.resource.entry}
						clients={clients}
					/>
				)}
				{selectedEvent?.resource?.type === "appointment" && (
					<>
						<AppointmentDetail
							appointment={selectedEvent.resource.appointment}
							clients={clients}
							treatments={treatments}
						/>
						<div className="pt-4 border-t border-gray-100 mt-4">
							<button
								type="button"
								onClick={openEditFromDetail}
								className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors">
								<Edit2 size={18} /> Editar
							</button>
						</div>
					</>
				)}
			</AdaptiveModal>
		</div>
	);
};

function SessionDetail({ entry, clients }) {
	const client = clients.find((c) => c.id === entry.client_id);
	const clientName = client
		? `${client.name} ${client.surname || ""}`.trim()
		: "—";
	const treatmentName = entry.description?.split("(")[0]?.trim() || "Sesión";

	return (
		<div className="space-y-4">
			<div>
				<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
					Tratamiento
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
				<p className="font-bold text-rose-600 mt-1 text-lg">
					{formatCurrency(entry.amount ?? 0)}
				</p>
			</div>
			{entry.description && (
				<div>
					<span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
						Descripción
					</span>
					<p className="font-medium text-gray-700 mt-1 text-sm">
						{entry.description}
					</p>
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
}
