import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type DnsRecord = {
	record?: string;
	type?: string;
	name?: string;
	value?: string;
	ttl?: string;
	status?: string;
	priority?: number;
};

function mapDnsRecords(records: DnsRecord[] | undefined) {
	return (records || []).map((r) => ({
		record: r.record || null,
		type: r.type || null,
		name: r.name || null,
		value: r.value || null,
		ttl: r.ttl || null,
		status: r.status || "pending",
		priority: r.priority ?? null,
	}));
}

function mapResendStatus(status: string | undefined): string {
	const s = (status || "").toLowerCase();
	if (s === "verified") return "verified";
	if (s === "failed" || s === "temporary_failure" || s === "permanent_failure") {
		return "failed";
	}
	if (s === "not_started" || s === "pending" || s === "processing") return "pending";
	return "pending";
}

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
		const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

		const authHeader = req.headers.get("Authorization");
		if (!authHeader) {
			return jsonResponse({ error: "Unauthorized" }, { status: 401 });
		}

		const userClient = createClient(supabaseUrl, anonKey, {
			global: { headers: { Authorization: authHeader } },
		});
		const {
			data: { user },
			error: userErr,
		} = await userClient.auth.getUser();
		if (userErr || !user) {
			return jsonResponse({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const action = body.action as string;
		const clinicId = body.clinic_id as string;
		const domainRaw = (body.domain as string | undefined)?.trim().toLowerCase();

		if (!clinicId || !["connect", "verify"].includes(action)) {
			return jsonResponse({ error: "action y clinic_id requeridos" }, { status: 400 });
		}

		const admin = createClient(supabaseUrl, serviceKey);

		// Autorización: admin de clínica o superadmin
		const { data: profile } = await admin
			.from("profiles")
			.select("clinic_id")
			.eq("id", user.id)
			.maybeSingle();

		const isSuper = user.app_metadata?.role === "superadmin";
		const { data: mem } = await admin
			.from("user_clinic_memberships")
			.select("role")
			.eq("user_id", user.id)
			.eq("clinic_id", clinicId)
			.maybeSingle();

		const allowed =
			isSuper ||
			(profile?.clinic_id === clinicId && mem?.role === "admin");
		if (!allowed) {
			return jsonResponse({ error: "Forbidden" }, { status: 403 });
		}

		const { data: clinic, error: cErr } = await admin
			.from("clinics")
			.select(
				"id, name, active_modules, custom_email_domain, resend_domain_id, email_domain_status, email_dns_records",
			)
			.eq("id", clinicId)
			.maybeSingle();

		if (cErr || !clinic) {
			return jsonResponse({ error: "Clínica no encontrada" }, { status: 404 });
		}

		const modules: string[] = clinic.active_modules || [];
		if (!modules.includes("custom_email_domain") && !isSuper) {
			return jsonResponse(
				{ error: "Módulo custom_email_domain no activo" },
				{ status: 403 },
			);
		}

		if (action === "connect") {
			const domain = domainRaw || clinic.custom_email_domain;
			if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
				return jsonResponse({ error: "Dominio inválido" }, { status: 400 });
			}

			const res = await fetch("https://api.resend.com/domains", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${resendKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: domain }),
			});
			const json = await res.json().catch(() => ({}));

			// Si ya existe, intentar listar
			if (!res.ok) {
				const msg = String(json?.message || json?.error || `HTTP ${res.status}`);
				if (msg.toLowerCase().includes("already") && clinic.resend_domain_id) {
					// caer a verify path
				} else if (msg.toLowerCase().includes("already")) {
					const listRes = await fetch("https://api.resend.com/domains", {
						headers: { Authorization: `Bearer ${resendKey}` },
					});
					const listJson = await listRes.json().catch(() => ({}));
					const found = (listJson?.data || []).find(
						(d: { name?: string }) => d.name?.toLowerCase() === domain,
					);
					if (found?.id) {
						const getRes = await fetch(`https://api.resend.com/domains/${found.id}`, {
							headers: { Authorization: `Bearer ${resendKey}` },
						});
						const getJson = await getRes.json().catch(() => ({}));
						const dns = mapDnsRecords(getJson?.records || found.records);
						const status = mapResendStatus(getJson?.status || found.status);
						await admin
							.from("clinics")
							.update({
								custom_email_domain: domain,
								resend_domain_id: found.id,
								email_domain_status: status,
								email_dns_records: dns,
							})
							.eq("id", clinicId);
						return jsonResponse({
							ok: true,
							domain,
							resend_domain_id: found.id,
							email_domain_status: status,
							email_dns_records: dns,
						});
					}
				}
				await admin
					.from("clinics")
					.update({
						custom_email_domain: domain,
						email_domain_status: "failed",
					})
					.eq("id", clinicId);
				return jsonResponse({ error: msg }, { status: 400 });
			}

			const dns = mapDnsRecords(json.records);
			const status = mapResendStatus(json.status);
			await admin
				.from("clinics")
				.update({
					custom_email_domain: domain,
					resend_domain_id: json.id,
					email_domain_status: status === "verified" ? "verified" : "pending",
					email_dns_records: dns,
				})
				.eq("id", clinicId);

			return jsonResponse({
				ok: true,
				domain,
				resend_domain_id: json.id,
				email_domain_status: status === "verified" ? "verified" : "pending",
				email_dns_records: dns,
			});
		}

		// verify
		const domainId = clinic.resend_domain_id;
		if (!domainId) {
			return jsonResponse({ error: "No hay dominio conectado" }, { status: 400 });
		}

		// Pedir verificación a Resend
		await fetch(`https://api.resend.com/domains/${domainId}/verify`, {
			method: "POST",
			headers: { Authorization: `Bearer ${resendKey}` },
		}).catch(() => null);

		const getRes = await fetch(`https://api.resend.com/domains/${domainId}`, {
			headers: { Authorization: `Bearer ${resendKey}` },
		});
		const getJson = await getRes.json().catch(() => ({}));
		if (!getRes.ok) {
			return jsonResponse(
				{ error: getJson?.message || `HTTP ${getRes.status}` },
				{ status: 400 },
			);
		}

		const dns = mapDnsRecords(getJson.records);
		const status = mapResendStatus(getJson.status);
		await admin
			.from("clinics")
			.update({
				email_domain_status: status,
				email_dns_records: dns,
			})
			.eq("id", clinicId);

		return jsonResponse({
			ok: true,
			email_domain_status: status,
			email_dns_records: dns,
		});
	} catch (e) {
		console.error(e);
		return jsonResponse(
			{ error: e instanceof Error ? e.message : String(e) },
			{ status: 500 },
		);
	}
});
