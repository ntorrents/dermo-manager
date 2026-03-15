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

/** Color para avisos de seguimiento en la agenda */
export const SEGUIMIENTO_COLOR = "#d97706";

/**
 * Convierte seguimientos (con fecha_proximo_contacto) en eventos de calendario.
 * Se muestran como evento de día completo a las 09:00 para ordenar en la agenda.
 */
export const seguimientosToEvents = (seguimientos = [], clients = []) =>
	(seguimientos || [])
		.filter((s) => s.fecha_proximo_contacto)
		.map((s) => {
			const dateStr = s.fecha_proximo_contacto;
			const start = new Date(`${dateStr}T09:00:00`);
			const end = new Date(start.getTime() + 30 * 60 * 1000);
			const client = clients.find((c) => c.id === s.client_id);
			const clientName = client ? `${client.name} ${client.surname || ""}`.trim() : "Cliente";
			const title =
				s.tratamientos_interes?.trim() ?
					`Seguimiento: ${clientName} — ${s.tratamientos_interes.trim()}`
				: `Seguimiento: ${clientName}`;
			return {
				id: `seg-${s.id}`,
				title,
				start,
				end,
				allDay: false,
				draggable: false,
				resource: { type: "seguimiento", seguimiento: s, client },
			};
		});

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
 * Fusiona sesiones, appointments y seguimientos en una sola lista de eventos.
 */
export const mergeCalendarEvents = (entries, appointments, clients, seguimientos = []) => [
	...entriesToEvents(entries, clients),
	...appointmentsToEvents(appointments),
	...seguimientosToEvents(seguimientos, clients),
];
