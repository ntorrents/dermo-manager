/** Eventos de automatización de mensajes (Marketing + Integraciones). */

export const AUTOMATION_EVENTS = [
	{
		key: "pre_session",
		label: "Mensaje Pre-Sesión",
		hint: "Aviso antes de la cita (email o WhatsApp en el futuro).",
		templateKind: "email_pre_session",
		defaultName: "Pre-sesión",
		defaultSubject: "Tu cita en {{nombre_clinica}}",
	},
	{
		key: "reminder_24h",
		label: "Recordatorio 24h",
		hint: "Recordatorio el día anterior a la cita.",
		templateKind: "email_reminder",
		defaultName: "Recordatorio 24h",
		defaultSubject: "Recordatorio: tu cita mañana",
	},
	{
		key: "post_session",
		label: "Seguimiento Post-Sesión",
		hint: "Cuidados y seguimiento tras el tratamiento.",
		templateKind: "email_followup",
		defaultName: "Post-sesión",
		defaultSubject: "Cuidados tras tu sesión",
	},
	{
		key: "google_review",
		label: "Reseña Google",
		hint: "Pide una reseña en Google tras una buena experiencia.",
		templateKind: "email_google_review",
		defaultName: "Pedir reseña Google",
		defaultSubject: "¿Nos dejas tu opinión?",
	},
];

export const AUTOMATION_CHANNELS = [
	{ value: "email", label: "Email (Resend)" },
	{ value: "whatsapp", label: "WhatsApp (próximamente)" },
	{ value: "none", label: "Solo interno / webhook" },
];

export const automationEventByKey = (key) =>
	AUTOMATION_EVENTS.find((e) => e.key === key) || null;
