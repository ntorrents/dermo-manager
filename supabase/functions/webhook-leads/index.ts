/**
 * Webhook de entrada de leads (formularios web → ERP).
 *
 * POST /functions/v1/webhook-leads?clinic_id=<uuid>
 * Auth (cualquiera de estas):
 *   - Header x-webhook-secret
 *   - Header Authorization: Bearer <token>
 *   - Body JSON: { "token": "..." } o { "secret": "..." }
 * Clínica (cualquiera):
 *   - Query clinic_id / tenant
 *   - Header x-clinic-id
 *   - Body clinic_id
 * Body JSON:
 *   { "name": string, "phone"?: string, "email"?: string,
 *     "message"?: string, "interest"?: string }
 *
 * Inserta un client con is_lead=true (service role).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		if (!supabaseUrl || !serviceKey) {
			return jsonResponse({ error: "Missing Supabase env" }, { status: 500 });
		}

		const url = new URL(req.url);
		const body = await req.json().catch(() => ({}));

		const clinicId = (
			req.headers.get("x-clinic-id") ||
			url.searchParams.get("clinic_id") ||
			url.searchParams.get("tenant") ||
			body.clinic_id ||
			""
		)
			.toString()
			.trim();

		const authHeader = (req.headers.get("authorization") || "").trim();
		const bearer = authHeader.toLowerCase().startsWith("bearer ")
			? authHeader.slice(7).trim()
			: "";
		const secret = (
			req.headers.get("x-webhook-secret") ||
			bearer ||
			body.token ||
			body.secret ||
			""
		)
			.toString()
			.trim();

		if (!clinicId || !secret) {
			return jsonResponse(
				{
					error:
						"Se requiere clinic_id (query/header/body) y token (x-webhook-secret, Bearer o body.token)",
				},
				{ status: 401 },
			);
		}

		const name = String(body.name || body.nombre || "").trim();
		const phone = String(body.phone || body.telefono || body.tel || "").trim() || null;
		const email = String(body.email || body.correo || "").trim() || null;
		const message =
			String(body.message || body.mensaje || body.notes || "").trim() || null;
		const interest =
			String(body.interest || body.interés || body.tratamiento || "").trim() ||
			null;

		if (!name) {
			return jsonResponse({ error: "name es obligatorio" }, { status: 400 });
		}

		const admin = createClient(supabaseUrl, serviceKey);

		const { data: clinic, error: clinicErr } = await admin
			.from("clinics")
			.select("id, leads_webhook_secret, active_modules, active")
			.eq("id", clinicId)
			.maybeSingle();

		if (clinicErr || !clinic) {
			return jsonResponse({ error: "Clínica no encontrada" }, { status: 404 });
		}

		if (clinic.active === false) {
			return jsonResponse({ error: "Clínica inactiva" }, { status: 403 });
		}

		const modules = Array.isArray(clinic.active_modules)
			? clinic.active_modules
			: [];
		if (!modules.includes("web_leads")) {
			return jsonResponse(
				{ error: "Módulo Captación Web (Leads) no activo en esta clínica" },
				{ status: 403 },
			);
		}

		const expected = String(clinic.leads_webhook_secret || "").trim();
		if (!expected || expected !== secret) {
			return jsonResponse({ error: "Webhook no autorizado" }, { status: 401 });
		}

		// user_id obligatorio en clients: tomar un miembro de la clínica
		const { data: member } = await admin
			.from("user_clinic_memberships")
			.select("user_id")
			.eq("clinic_id", clinicId)
			.limit(1)
			.maybeSingle();

		let ownerId = member?.user_id as string | undefined;
		if (!ownerId) {
			const { data: profile } = await admin
				.from("profiles")
				.select("id")
				.eq("clinic_id", clinicId)
				.limit(1)
				.maybeSingle();
			ownerId = profile?.id;
		}

		if (!ownerId) {
			return jsonResponse(
				{ error: "No hay usuario propietario en la clínica para asignar el lead" },
				{ status: 422 },
			);
		}

		const now = new Date().toISOString();
		const { data: lead, error: insertErr } = await admin
			.from("clients")
			.insert([
				{
					user_id: ownerId,
					clinic_id: clinicId,
					name,
					phone,
					email,
					notes: message,
					activo: true,
					is_lead: true,
					lead_interest: interest,
					lead_message: message,
					lead_source: "webhook",
					lead_entered_at: now,
					origin: "webhook",
				},
			])
			.select("id, name, phone, email, lead_interest, lead_entered_at")
			.single();

		if (insertErr) {
			console.error("webhook-leads insert", insertErr);
			return jsonResponse({ error: insertErr.message }, { status: 500 });
		}

		return jsonResponse({ ok: true, lead }, { status: 201 });
	} catch (e) {
		console.error("webhook-leads", e);
		return jsonResponse(
			{ error: e instanceof Error ? e.message : "Error interno" },
			{ status: 500 },
		);
	}
});
