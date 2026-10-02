import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
	applyEmailVariables,
	resolveFromAddress,
	withBaseClinicaFooter,
} from "../_shared/email.ts";

const BATCH = 25;

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	try {
		const resendKey = Deno.env.get("resend_api_key") || Deno.env.get("RESEND_API_KEY");
		if (!resendKey) {
			return jsonResponse({ error: "Missing resend_api_key secret" }, { status: 500 });
		}

		const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
		const admin = createClient(supabaseUrl, serviceKey);

		// Auth opcional: cron/service o usuario autenticado admin
		const authHeader = req.headers.get("Authorization") || "";
		const isService =
			authHeader.includes(serviceKey) ||
			req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");

		if (!isService) {
			const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
				global: { headers: { Authorization: authHeader } },
			});
			const { data: userData } = await userClient.auth.getUser();
			if (!userData?.user) {
				return jsonResponse({ error: "Unauthorized" }, { status: 401 });
			}
		}

		const { data: rows, error: qErr } = await admin
			.from("queued_emails")
			.select(
				"id, clinic_id, campaign_id, to_email, to_name, subject, body_html, variables, attempts",
			)
			.eq("status", "queued")
			.order("created_at", { ascending: true })
			.limit(BATCH);

		if (qErr) {
			return jsonResponse({ error: qErr.message }, { status: 500 });
		}

		const results: Array<{ id: string; ok: boolean; error?: string }> = [];

		for (const row of rows || []) {
			await admin
				.from("queued_emails")
				.update({
					status: "processing",
					attempts: (row.attempts || 0) + 1,
					updated_at: new Date().toISOString(),
				})
				.eq("id", row.id);

			const { data: clinic } = await admin
				.from("clinics")
				.select(
					"name, sender_email_name, sender_reply_to, custom_email_domain, email_domain_status",
				)
				.eq("id", row.clinic_id)
				.maybeSingle();

			const vars = (row.variables || {}) as Record<string, string>;
			if (clinic?.name && !vars.nombre_clinica) {
				vars.nombre_clinica = clinic.name;
				vars.clinic_name = clinic.name;
			}

			const subject = applyEmailVariables(row.subject, vars);
			const body = withBaseClinicaFooter(applyEmailVariables(row.body_html, vars));
			const { from, replyTo } = resolveFromAddress(clinic || {});

			const payload: Record<string, unknown> = {
				from,
				to: [row.to_email],
				subject,
				html: body,
			};
			if (replyTo) payload.reply_to = replyTo;

			try {
				const res = await fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${resendKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok) {
					const msg = json?.message || json?.error || `Resend HTTP ${res.status}`;
					await admin
						.from("queued_emails")
						.update({
							status: "failed",
							error: String(msg),
							updated_at: new Date().toISOString(),
						})
						.eq("id", row.id);
					results.push({ id: row.id, ok: false, error: String(msg) });
					continue;
				}

				await admin
					.from("queued_emails")
					.update({
						status: "sent",
						provider_message_id: json?.id || null,
						sent_at: new Date().toISOString(),
						error: null,
						updated_at: new Date().toISOString(),
					})
					.eq("id", row.id);

				if (row.campaign_id) {
					await admin
						.from("marketing_sends")
						.update({ status: "sent" })
						.eq("campaign_id", row.campaign_id)
						.eq("to_email", row.to_email);
				}

				results.push({ id: row.id, ok: true });
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				await admin
					.from("queued_emails")
					.update({
						status: "failed",
						error: msg,
						updated_at: new Date().toISOString(),
					})
					.eq("id", row.id);
				results.push({ id: row.id, ok: false, error: msg });
			}
		}

		// Marcar campañas completadas si no quedan queued
		const campaignIds = [
			...new Set((rows || []).map((r) => r.campaign_id).filter(Boolean)),
		] as string[];
		for (const cid of campaignIds) {
			const { count } = await admin
				.from("queued_emails")
				.select("id", { count: "exact", head: true })
				.eq("campaign_id", cid)
				.in("status", ["queued", "processing"]);
			if (!count) {
				await admin
					.from("marketing_campaigns")
					.update({ status: "sent", sent_at: new Date().toISOString() })
					.eq("id", cid);
			}
		}

		return jsonResponse({
			processed: results.length,
			sent: results.filter((r) => r.ok).length,
			failed: results.filter((r) => !r.ok).length,
			results,
		});
	} catch (e) {
		console.error(e);
		return jsonResponse(
			{ error: e instanceof Error ? e.message : String(e) },
			{ status: 500 },
		);
	}
});
