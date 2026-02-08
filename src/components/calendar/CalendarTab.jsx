import React, { useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addHours } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { supabase } from "../../services/supabase";
import { mergeCalendarEvents } from "../../utils/calendarUtils";
import { formatCurrency } from "../../utils/format";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { LoadingButton } from "../ui/LoadingButton";
import "react-big-calendar/lib/css/react-big-calendar.css";

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
		clientId: "",
		treatmentId: "",
		notes: "",
	});

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
			clientId: "",
			treatmentId: "",
			notes: "",
		});
		setShowModal(true);
	};

	const handleSelectEvent = (event) => {
		setSelectedEvent(event);
		setShowDetailModal(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);
		try {
			let startAt, endAt, all_day = false;
			if (formData.type === "task" && formData.allDay) {
				startAt = new Date(`${formData.startAt}T00:00:00`);
				endAt = new Date(`${formData.startAt}T23:59:59`);
				all_day = true;
			} else {
				startAt = new Date(`${formData.startAt}T${formData.startTime}`);
				endAt = new Date(`${formData.startAt}T${formData.endTime}`);
			}

			const payload = {
				user_id: user.id,
				title: formData.title || (formData.type === "task" ? "Tarea" : "Cita"),
				start_at: startAt.toISOString(),
				end_at: endAt.toISOString(),
				type: formData.type,
				all_day,
				client_id: formData.clientId || null,
				treatment_id: formData.treatmentId || null,
				notes: formData.notes || null,
			};

			const { error } = await supabase.from("appointments").insert([payload]);
			if (error) throw error;
			showToast(formData.type === "task" ? "Tarea creada" : "Cita creada");
			setShowModal(false);
			onRefresh?.();
		} catch (err) {
			console.error(err);
			showToast("Error al guardar", "error");
		} finally {
			setSaving(false);
		}
	};

	const eventStyleGetter = (event) => {
		const isSession = event.resource?.type === "session";
		return {
			style: {
				backgroundColor: isSession ? "#f43f5e" : "#1e293b",
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
					<Calendar
						localizer={localizer}
						events={events}
						view={view}
						date={date}
						onView={setView}
						onNavigate={setDate}
						onSelectSlot={openModalForSlot}
						onSelectEvent={handleSelectEvent}
						selectable
						messages={messages}
						culture="es"
						eventPropGetter={eventStyleGetter}
						startAccessor="start"
						endAccessor="end"
						titleAccessor="title"
					/>
				</div>
			</div>

			<AdaptiveModal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Nueva cita o tarea"
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

					<LoadingButton
						loading={saving}
						type="submit"
						className="w-full bg-primary text-white font-black py-4 rounded-xl">
						{saving ? "Guardando..." : "Guardar"}
					</LoadingButton>
				</form>
			</AdaptiveModal>

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
					<AppointmentDetail
						appointment={selectedEvent.resource.appointment}
						clients={clients}
						treatments={treatments}
					/>
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
