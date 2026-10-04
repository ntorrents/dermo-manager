/**
 * Worker: dispara automatizaciones Pre-sesión y Recordatorio 24h
 * según citas de agenda → encola en queued_emails → procesa con Resend.
 *
 * Auth: Authorization Bearer SERVICE_ROLE o header x-cron-secret = CRON_SECRET.
 *
 * Ventanas (cron horario):
 * - reminder_24h: cita en [now+23h, now+25h]
 * - pre_session:  cita en [now+90m, now+150m] (~2h antes)
 *
 * Solo envía si clinic_message_automations.is_active=true, channel=email
 * y hay plantilla. Si está desactivado → no encola nada.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type EventKey = "reminder_24h" | "pre_session";

const EVENT_WINDOWS: Record<
	EventKey,
	{ fromMs: number; toMs: number }
> = {
	reminder_24h: { fromMs: 23 * 60 * 60 * 1000, toMs: 25 * 60 * 60 * 1000 },
	pre_session: { fromMs: 90 * 60 * 1000, toMs: 150 * 60 * 1000 },
};

function formatFechaCita(iso: string): string {
	try {
		return new Date(iso).toLocaleString("es-ES", {
			timeZone: "Europe/Madrid",
			weekday: "short",
			day: "numeric",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	if (req.method !== "POST" && req.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const cronSecret = Deno.env.get("CRON_SECRET") || "";
		if (!supabaseUrl || !serviceKey) {
			return jsonResponse({ error: "Missing Supabase env" }, { status: 500 });
		}

		const authHeader = req.headers.get("Authorization") || "";
		const headerCron = req.headers.get("x-cron-secret") || "";
		const isService =
			authHeader === `Bearer ${serviceKey}` ||
			(Boolean(cronSecret) && headerCron === cronSecret);

		if (!isService) {
			return jsonResponse({ error: "Unauthorized" }, { status: 401 });
		}

		const admin = createClient(supabaseUrl, serviceKey);
		const now = Date.now();
		const summary = {
			scanned: 0,
			queued: 0,
			skipped: 0,
			failed: 0,
			byEvent: {} as Record<string, { queued: number; skipped: number }>,
		};

		const { data: automations, error: autoErr } = await admin
			.from("clinic_message_automations")
			.select("id, clinic_id, event_key, channel, template_id, is_active")
			.eq("is_active", true)
			.eq("channel", "email")
			.in("event_key", ["reminder_24h", "pre_session"]);

		if (autoErr) {
			return jsonResponse({ error: autoErr.message }, { status: 500 });
		}

		const active = (automations || []).filter((a) => a.template_id);
		if (active.length === 0) {
			return jsonResponse({
				ok: true,
				message: "Ninguna automatización email activa (reminder_24h / pre_session)",
				...summary,
			});
		}

		const templateIds = [...new Set(active.map((a) => a.template_id))];
		const { data: templates } = await admin
			.from("marketing_templates")
			.select("id, subject, body_html, name, is_active")
			.in("id", templateIds);

		const tplById = new Map((templates || []).map((t) => [t.id, t]));

		const clinicIds = [...new Set(active.map((a) => a.clinic_id))];
		const { data: clinics } = await admin
			.from("clinics")
			.select("id, name")
			.in("id", clinicIds);
		const clinicName = new Map((clinics || []).map((c) => [c.id, c.name]));

		for (const auto of active) {
			const eventKey = auto.event_key as EventKey;
			const win = EVENT_WINDOWS[eventKey];
			if (!win) continue;

			if (!summary.byEvent[eventKey]) {
				summary.byEvent[eventKey] = { queued: 0, skipped: 0 };
			}

			const tpl = tplById.get(auto.template_id);
			if (!tpl || tpl.is_active === false) {
				summary.skipped++;
				summary.byEvent[eventKey].skipped++;
				continue;
			}

			const fromIso = new Date(now + win.fromMs).toISOString();
			const toIso = new Date(now + win.toMs).toISOString();

			const { data: appts, error: apptErr } = await admin
				.from("appointments")
				.select(
					"id, clinic_id, client_id, treatment_id, title, start_at, status, type, activo",
				)
				.eq("clinic_id", auto.clinic_id)
				.eq("activo", true)
				.eq("type", "appointment")
				.neq("status", "cancelled")
				.gte("start_at", fromIso)
				.lte("start_at", toIso);

			if (apptErr) {
				console.error("appointments query", apptErr);
				summary.failed++;
				continue;
			}

			for (const appt of appts || []) {
				summary.scanned++;
				if (!appt.client_id) {
					summary.skipped++;
					summary.byEvent[eventKey].skipped++;
					continue;
				}

				const { data: existing } = await admin
					.from("automation_dispatch_log")
					.select("id")
					.eq("clinic_id", auto.clinic_id)
					.eq("event_key", eventKey)
					.eq("appointment_id", appt.id)
					.maybeSingle();

				if (existing) {
					summary.skipped++;
					summary.byEvent[eventKey].skipped++;
					continue;
				}

				const { data: client } = await admin
					.from("clients")
					.select("id, name, surname, email, activo")
					.eq("id", appt.client_id)
					.maybeSingle();

				const email = (client?.email || "").trim().toLowerCase();
				if (!client || client.activo === false || !email || !email.includes("@")) {
					await admin.from("automation_dispatch_log").insert([
						{
							clinic_id: auto.clinic_id,
							event_key: eventKey,
							appointment_id: appt.id,
							client_id: appt.client_id,
							status: "skipped",
							skip_reason: "sin_email",
						},
					]);
					summary.skipped++;
					summary.byEvent[eventKey].skipped++;
					continue;
				}

				let treatmentName = appt.title || "";
				if (appt.treatment_id) {
					const { data: tr } = await admin
						.from("treatments")
						.select("name")
						.eq("id", appt.treatment_id)
						.maybeSingle();
					if (tr?.name) treatmentName = tr.name;
				}

				const fullName = [client.name, client.surname].filter(Boolean).join(" ");
				const cName = clinicName.get(auto.clinic_id) || "Clínica";
				const fecha = formatFechaCita(appt.start_at);

				const { data: queued, error: qErr } = await admin
					.from("queued_emails")
					.insert([
						{
							clinic_id: auto.clinic_id,
							campaign_id: null,
							client_id: client.id,
							to_email: email,
							to_name: fullName || client.name || email.split("@")[0],
							subject: tpl.subject || tpl.name || "Recordatorio de cita",
							body_html: tpl.body_html || "",
							variables: {
								nombre_paciente: fullName || client.name || "Cliente",
								client_name: fullName || client.name || "Cliente",
								nombre_clinica: cName,
								clinic_name: cName,
								fecha_cita: fecha,
								appointment_date: fecha,
								treatment_name: treatmentName,
							},
							status: "queued",
						},
					])
					.select("id")
					.single();

				if (qErr) {
					console.error("queue email", qErr);
					await admin.from("automation_dispatch_log").insert([
						{
							clinic_id: auto.clinic_id,
							event_key: eventKey,
							appointment_id: appt.id,
							client_id: client.id,
							status: "failed",
							skip_reason: qErr.message,
						},
					]);
					summary.failed++;
					continue;
				}

				await admin.from("automation_dispatch_log").insert([
					{
						clinic_id: auto.clinic_id,
						event_key: eventKey,
						appointment_id: appt.id,
						client_id: client.id,
						queued_email_id: queued?.id || null,
						status: "queued",
					},
				]);
				summary.queued++;
				summary.byEvent[eventKey].queued++;
			}
		}

		// Procesar cola Resend (mismo proyecto)
		let processResult: unknown = null;
		if (summary.queued > 0) {
			try {
				const res = await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${serviceKey}`,
						"Content-Type": "application/json",
					},
					body: "{}",
				});
				processResult = await res.json().catch(() => ({ status: res.status }));
			} catch (e) {
				processResult = {
					error: e instanceof Error ? e.message : "process-email-queue failed",
				};
			}
		}

		return jsonResponse({
			ok: true,
			...summary,
			processResult,
		});
	} catch (e) {
		console.error("dispatch-appointment-automations", e);
		return jsonResponse(
			{ error: e instanceof Error ? e.message : "Error interno" },
			{ status: 500 },
		);
	}
});
