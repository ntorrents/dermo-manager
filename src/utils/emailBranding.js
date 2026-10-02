/** Branding institucional BaseClínica (no editable por clínicas). */

export const BASECLINICA_EMAIL_FOOTER_HTML = `<div style="text-align:center; padding: 20px; font-size: 12px; color: #888;">Enviado a través de <a href="https://baseclinica.com" style="color: #6366f1; text-decoration: none; font-weight: bold;">BaseClínica</a> · Sistema Operativo Clínico</div>`;

export const EMAIL_TEMPLATE_VARS = [
	{ key: "nombre_paciente", label: "Nombre paciente", aliases: ["client_name"] },
	{ key: "fecha_cita", label: "Fecha cita", aliases: ["appointment_date"] },
	{ key: "nombre_clinica", label: "Nombre clínica", aliases: ["clinic_name"] },
	{ key: "treatment_name", label: "Tratamiento", aliases: [] },
];

export const applyEmailVariables = (text, vars = {}) => {
	if (!text) return "";
	const map = { ...vars };
	for (const def of EMAIL_TEMPLATE_VARS) {
		const primary = map[def.key];
		if (primary != null) {
			for (const a of def.aliases) {
				if (map[a] == null) map[a] = primary;
			}
		}
		for (const a of def.aliases) {
			if (map[a] != null && map[def.key] == null) map[def.key] = map[a];
		}
	}
	return String(text).replace(/\{\{(\w+)\}\}/g, (_, key) =>
		map[key] != null ? String(map[key]) : "",
	);
};

export const withBaseClinicaFooter = (html) => {
	const body = html || "";
	if (body.includes("baseclinica.com")) return body;
	return `${body}\n${BASECLINICA_EMAIL_FOOTER_HTML}`;
};
