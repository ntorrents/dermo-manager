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
				resource: { type: "session", entry: e },
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
			resource: { type: "appointment", appointment: a },
		};
	});

/**
 * Fusiona sesiones y appointments en una sola lista de eventos.
 */
export const mergeCalendarEvents = (entries, appointments, clients) => [
	...entriesToEvents(entries, clients),
	...appointmentsToEvents(appointments),
];
