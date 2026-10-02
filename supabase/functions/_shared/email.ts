/** Helpers tipados para Resend (Edge Functions). */

export const BASECLINICA_EMAIL_FOOTER_HTML =
	`<div style="text-align:center; padding: 20px; font-size: 12px; color: #888;">Enviado a través de <a href="https://baseclinica.com" style="color: #6366f1; text-decoration: none; font-weight: bold;">BaseClínica</a> · Sistema Operativo Clínico</div>`;

export function applyEmailVariables(
	text: string,
	vars: Record<string, string | undefined | null> = {},
): string {
	if (!text) return "";
	const map: Record<string, string> = {};
	for (const [k, v] of Object.entries(vars)) {
		if (v != null) map[k] = String(v);
	}
	// Aliases ES ↔ EN
	const aliases: Record<string, string[]> = {
		nombre_paciente: ["client_name"],
		client_name: ["nombre_paciente"],
		fecha_cita: ["appointment_date"],
		appointment_date: ["fecha_cita"],
		nombre_clinica: ["clinic_name"],
		clinic_name: ["nombre_clinica"],
	};
	for (const [k, list] of Object.entries(aliases)) {
		if (map[k]) {
			for (const a of list) if (!map[a]) map[a] = map[k];
		}
	}
	return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? "");
}

export function withBaseClinicaFooter(html: string): string {
	const body = html || "";
	if (body.includes("baseclinica.com")) return body;
	return `${body}\n${BASECLINICA_EMAIL_FOOTER_HTML}`;
}

export type ClinicEmailConfig = {
	name?: string | null;
	sender_email_name?: string | null;
	sender_reply_to?: string | null;
	custom_email_domain?: string | null;
	email_domain_status?: string | null;
	billing_phone?: string | null;
};

export function resolveFromAddress(clinic: ClinicEmailConfig): {
	from: string;
	replyTo?: string;
} {
	const display =
		(clinic.sender_email_name || clinic.name || "Clínica").replace(/[<>]/g, "").trim() ||
		"Clínica";
	const domainOk =
		clinic.email_domain_status === "verified" &&
		Boolean(clinic.custom_email_domain?.trim());
	const domain = domainOk
		? clinic.custom_email_domain!.trim().toLowerCase()
		: "baseclinica.com";
	const from = `${display} <notificaciones@${domain}>`;
	const replyTo = clinic.sender_reply_to?.trim() || undefined;
	return { from, replyTo };
}
