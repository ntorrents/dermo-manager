/**
 * Convierte finance_entries (sesiones) a eventos del calendario.
 */
export const entriesToEvents = (entries = [], clients = []) =>
	(entries || [])
		.filter((e) => e.type === "income" && e.client_id)
		.map((e) => {
			const dateStr = e.date || "";
			const start = new Date(`${dateStr}T10:00:00`);
			const end = new Date(start.getTime() + 60 * 60 * 1000);
			const client = clients.find((c) => c.id === e.client_id);
			const clientName = client ? `${client.name} ${client.surname || ""}`.trim() : "";
			const treatmentName = e.description?.split("(")[0]?.trim() || "Sesión";
			const title = clientName ? `${treatmentName} - ${clientName}` : treatmentName;
		return {
			id: `entry-${e.id}`,
			title,
			start,
			end,
			draggable: false,
			resource: { type: "session", entry: e },
		};
		});

/** Colores por estado de cita */
export const STATUS_COLORS = {
	pending: "#64748b",
	confirmed: "#3b82f6",
	done: "#22c55e",
	cancelled: "#ef4444",
};

/**
 * Convierte appointments a eventos del calendario.
 */
export const appointmentsToEvents = (appointments = []) =>
	(appointments || []).map((a) => {
		const start = a.start_at ? new Date(a.start_at) : new Date();
		const end = a.end_at ? new Date(a.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
		return {
			id: `appt-${a.id}`,
			title: a.title,
			start,
			end,
			allDay: !!a.all_day,
			status: a.status || "pending",
			draggable: true,
			resource: { type: "appointment", appointment: a },
		};
	});

/**
 * Fusiona sesiones y citas/tareas en una sola lista de eventos.
 * El diario de visitas del paciente no se muestra aquí (solo en la ficha de cliente).
 */
export const mergeCalendarEvents = (entries, appointments, clients) => [
	...entriesToEvents(entries, clients),
	...appointmentsToEvents(appointments),
];
