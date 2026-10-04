import { toLocalYmd } from "./dateUtils";

/** Colores suaves por estado de cita (tokens CSS → contrastan en light/dark). */
export const STATUS_COLORS = {
	pending: {
		bg: "var(--cal-pending-bg)",
		border: "var(--cal-pending-border)",
		text: "var(--cal-pending-text)",
	},
	confirmed: {
		bg: "var(--cal-confirmed-bg)",
		border: "var(--cal-confirmed-border)",
		text: "var(--cal-confirmed-text)",
	},
	done: {
		bg: "var(--cal-done-bg)",
		border: "var(--cal-done-border)",
		text: "var(--cal-done-text)",
	},
	cancelled: {
		bg: "var(--cal-cancelled-bg)",
		border: "var(--cal-cancelled-border)",
		text: "var(--cal-cancelled-text)",
	},
	task: {
		bg: "var(--cal-task-bg)",
		border: "var(--cal-task-border)",
		text: "var(--cal-task-text)",
	},
};

const clientLabel = (clients, clientId) => {
	const client = (clients || []).find((c) => c.id === clientId);
	if (!client) return "";
	return `${client.name || ""} ${client.surname || ""}`.trim();
};

/**
 * Actividades registradas (ventas / sesiones) → no van a la rejilla horaria.
 * Se muestran como “acciones” junto a la agenda.
 */
export const entriesToActions = (entries = [], clients = []) =>
	(entries || [])
		.filter((e) => e.type === "income" && e.client_id)
		.map((e) => {
			const dateStr = e.date || "";
			const when = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
			const name = clientLabel(clients, e.client_id) || "cliente";
			const raw = (e.description || "").trim();
			const head = raw.split("(")[0]?.trim() || "Actividad";
			const looksLikeSale =
				/\bx\s*\d+/i.test(raw) ||
				/venta|producto|ud\.|uds/i.test(raw) ||
				Number(e.amount) > 0 && /€|eur/i.test(raw);

			const title = looksLikeSale
				? `Vendiste ${head} a ${name}`
				: `Sesión · ${head} · ${name}`;

			return {
				id: `action-${e.id}`,
				kind: "action",
				title,
				subtitle: looksLikeSale ? "Venta" : "Tratamiento",
				date: when,
				dateYmd: dateStr || toLocalYmd(when),
				amount: e.amount,
				entry: e,
			};
		})
		.sort((a, b) => b.date - a.date);

/** @deprecated usar entriesToActions; se mantiene por compat. */
export const entriesToEvents = (entries = [], clients = []) =>
	entriesToActions(entries, clients).map((a) => ({
		id: a.id,
		title: a.title,
		start: a.date,
		end: new Date(a.date.getTime() + 60 * 60 * 1000),
		draggable: false,
		resource: { type: "action", entry: a.entry, action: a },
	}));

/**
 * Solo citas y tareas clínicas (sin impuestos ni acciones de venta).
 */
export const appointmentsToEvents = (appointments = [], clients = []) =>
	(appointments || [])
		.filter((a) => a.type !== "tax_deadline")
		.map((a) => {
			const start = a.start_at ? new Date(a.start_at) : new Date();
			const end = a.end_at
				? new Date(a.end_at)
				: new Date(start.getTime() + 60 * 60 * 1000);
			const isTask = a.type === "task";
			const name = clientLabel(clients, a.client_id);
			const baseTitle = a.title || (isTask ? "Tarea" : "Cita");
			const title =
				!isTask && name && !baseTitle.toLowerCase().includes(name.toLowerCase())
					? `${baseTitle} · ${name}`
					: baseTitle;

			return {
				id: `appt-${a.id}`,
				title,
				subtitle: name && !title.includes(name) ? name : isTask ? "Tarea" : "",
				start,
				end,
				allDay: !!a.all_day,
				status: a.status || "pending",
				draggable: true,
				resource: {
					type: "appointment",
					appointment: a,
					isTask,
				},
			};
		});

export const getTaxDeadlineItems = (appointments = []) =>
	(appointments || [])
		.filter((a) => a.type === "tax_deadline")
		.map((a) => {
			const start = a.start_at ? new Date(a.start_at) : new Date();
			const end = a.end_at ? new Date(a.end_at) : start;
			return {
				id: a.id,
				title: a.title || "Ventana impuestos",
				notes: a.notes || "",
				start,
				end,
				appointment: a,
			};
		})
		.sort((a, b) => a.start - b.start);

/** Ventanas fiscales que solapan el rango visible. */
export const taxDeadlinesInRange = (appointments, rangeStart, rangeEnd) => {
	const items = getTaxDeadlineItems(appointments);
	if (!rangeStart || !rangeEnd) return items;
	const rs = rangeStart.getTime();
	const re = rangeEnd.getTime();
	return items.filter((t) => t.end.getTime() >= rs && t.start.getTime() <= re);
};

/**
 * Eventos de rejilla: solo citas/tareas.
 * Las ventas/sesiones e impuestos se gestionan aparte en la UI.
 */
export const mergeCalendarEvents = (entries, appointments, clients) =>
	appointmentsToEvents(appointments, clients);

export const actionsInRange = (entries, clients, rangeStart, rangeEnd) => {
	const all = entriesToActions(entries, clients);
	if (!rangeStart || !rangeEnd) return all;
	const rs = toLocalYmd(rangeStart);
	const re = toLocalYmd(rangeEnd);
	return all.filter((a) => a.dateYmd >= rs && a.dateYmd <= re);
};
