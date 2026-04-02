import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type GCalEvent = {
	id: string;
	etag: string;
	updated: string;
	status?: string;
	summary?: string;
	description?: string;
	start?: { dateTime?: string; date?: string };
	end?: { dateTime?: string; date?: string };
};

function ymdAddDays(ymd: string, delta: number): string {
	const d = new Date(`${ymd}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

function parseGoogleEventTimes(e: GCalEvent): { start: string; end: string; all_day: boolean } {
	if (e.start?.date) {
		const startDay = e.start.date;
		const endExclusive = e.end?.date || ymdAddDays(startDay, 1);
		const endDay = ymdAddDays(endExclusive, -1);
		return {
			start: `${startDay}T00:00:00.000Z`,
			end: `${endDay}T23:59:59.999Z`,
			all_day: true,
		};
	}
	const s = e.start?.dateTime || new Date().toISOString();
	const en = e.end?.dateTime || s;
	return {
		start: new Date(s).toISOString(),
		end: new Date(en).toISOString(),
		all_day: false,
	};
}

function rowToGoogleBody(row: Record<string, unknown>): Record<string, unknown> {
	const priv = { dermoAppointmentId: String(row.id) };
	if (row.all_day) {
		const startD = String(row.start_at).slice(0, 10);
		const endD = String(row.end_at || row.start_at).slice(0, 10);
		const endExclusive = ymdAddDays(endD, 1);
		return {
			summary: row.title,
			description: row.notes || undefined,
			start: { date: startD },
			end: { date: endExclusive },
			extendedProperties: { private: priv },
		};
	}
	return {
		summary: row.title,
		description: row.notes || undefined,
		start: { dateTime: new Date(String(row.start_at)).toISOString() },
		end: { dateTime: new Date(String(row.end_at || row.start_at)).toISOString() },
		extendedProperties: { private: priv },
	};
}

async function refreshAccessToken(refreshToken: string): Promise<{
	access_token: string;
	expires_in?: number;
}> {
	const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
	const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
	const r = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});
	const j = await r.json();
	if (!r.ok) throw new Error(j.error || "refresh_failed");
	return j;
}

async function gcalFetch(
	accessToken: string,
	method: string,
	url: string,
	body?: unknown,
	headersExtra: Record<string, string> = {},
): Promise<Response> {
	return await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			...headersExtra,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	const authHeader = req.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return jsonResponse({ error: "No autorizado" }, { status: 401 });
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
	const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
	const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

	const supabaseUser = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } },
	});
	const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
	if (authErr || !user) {
		return jsonResponse({ error: "Sesión no válida" }, { status: 401 });
	}

	const admin = createClient(supabaseUrl, serviceKey);

	const { data: conn, error: cErr } = await admin
		.from("google_calendar_connections")
		.select("*")
		.eq("user_id", user.id)
		.maybeSingle();

	if (cErr || !conn) {
		return jsonResponse({ error: "Google Calendar no conectado" }, { status: 400 });
	}

	let accessToken = conn.access_token as string | null;
	let tokenExp = conn.access_token_expires_at ?
		new Date(conn.access_token_expires_at).getTime() :
		0;
	if (!accessToken || tokenExp < Date.now() + 60_000) {
		try {
			const t = await refreshAccessToken(conn.refresh_token as string);
			accessToken = t.access_token;
			const expIso = t.expires_in ?
				new Date(Date.now() + t.expires_in * 1000).toISOString() :
				null;
			await admin.from("google_calendar_connections").update({
				access_token: accessToken,
				access_token_expires_at: expIso,
				updated_at: new Date().toISOString(),
			}).eq("user_id", user.id);
		} catch (e) {
			console.error(e);
			await admin.from("google_calendar_connections").update({
				last_error: `token: ${String(e)}`,
			}).eq("user_id", user.id);
			return jsonResponse({ error: "No se pudo renovar el token de Google" }, { status: 502 });
		}
	}

	const calId = encodeURIComponent(conn.google_calendar_id || "primary");
	const timeMin = new Date();
	timeMin.setMonth(timeMin.getMonth() - 3);
	const timeMax = new Date();
	timeMax.setMonth(timeMax.getMonth() + 18);

	const listUrlBase =
		`https://www.googleapis.com/calendar/v3/calendars/${calId}/events?singleEvents=true&orderBy=startTime&timeMin=${
			encodeURIComponent(timeMin.toISOString())
		}&timeMax=${encodeURIComponent(timeMax.toISOString())}&maxResults=2500`;

	let pageToken: string | undefined;
	let pulled = 0;
	let pushed = 0;

	try {
		// ——— Pull from Google ———
		do {
			const listUrl = pageToken ? `${listUrlBase}&pageToken=${encodeURIComponent(pageToken)}` : listUrlBase;
			const listRes = await gcalFetch(accessToken!, "GET", listUrl);
			const listJson = await listRes.json();
			if (!listRes.ok) {
				throw new Error(listJson.error?.message || "list_failed");
			}
			pageToken = listJson.nextPageToken;

			for (const ev of (listJson.items || []) as GCalEvent[]) {
				if (!ev.id || !ev.updated) continue;
				pulled++;

				if (ev.status === "cancelled") {
					await admin
						.from("appointments")
						.update({
							activo: false,
							google_event_id: null,
							google_etag: null,
							google_remote_updated: null,
						})
						.eq("google_event_id", ev.id)
						.eq("user_id", user.id);
					continue;
				}

				const remoteUpd = new Date(ev.updated).getTime();
				const dermoId = (ev as GCalEvent & { extendedProperties?: { private?: Record<string, string> } })
					.extendedProperties?.private?.dermoAppointmentId;

				let row: Record<string, unknown> | null = null;
				if (dermoId) {
					const { data } = await admin
						.from("appointments")
						.select("*")
						.eq("id", dermoId)
						.eq("user_id", user.id)
						.maybeSingle();
					row = data;
				}
				if (!row) {
					const { data } = await admin
						.from("appointments")
						.select("*")
						.eq("google_event_id", ev.id)
						.eq("user_id", user.id)
						.maybeSingle();
					row = data;
				}

				const { start, end, all_day } = parseGoogleEventTimes(ev);

				if (!row) {
					const { error: insErr } = await admin.from("appointments").insert({
						user_id: user.id,
						clinic_id: conn.clinic_id,
						title: ev.summary || "Evento",
						notes: ev.description || null,
						start_at: start,
						end_at: end,
						all_day: all_day,
						type: "task",
						status: "confirmed",
						activo: true,
						google_event_id: ev.id,
						google_etag: ev.etag,
						google_remote_updated: ev.updated,
					});
					if (insErr) console.error("insert from google", insErr);
				} else {
					const localUpd = new Date(String(row.updated_at)).getTime();
					if (remoteUpd > localUpd) {
						const { error: upErr } = await admin
							.from("appointments")
							.update({
								title: ev.summary || row.title,
								notes: ev.description ?? row.notes,
								start_at: start,
								end_at: end,
								all_day: all_day,
								google_event_id: ev.id,
								google_etag: ev.etag,
								google_remote_updated: ev.updated,
							})
							.eq("id", row.id);
						if (upErr) console.error("update from google", upErr);
					}
				}
			}
		} while (pageToken);

		// ——— Archive: eliminar en Google ———
		const { data: archived } = await admin
			.from("appointments")
			.select("id, google_event_id, google_etag")
			.eq("user_id", user.id)
			.eq("activo", false)
			.not("google_event_id", "is", null);

		for (const a of archived || []) {
			const eid = a.google_event_id as string;
			const del = await gcalFetch(
				accessToken!,
				"DELETE",
				`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eid)}`,
			);
			if (del.ok || del.status === 404 || del.status === 410) {
				await admin.from("appointments").update({
					google_event_id: null,
					google_etag: null,
					google_remote_updated: null,
				}).eq("id", a.id);
			}
		}

		// ——— Push locals ———
		const { data: locals } = await admin
			.from("appointments")
			.select("*")
			.eq("user_id", user.id)
			.eq("activo", true)
			.in("type", ["appointment", "task"]);

		for (const row of locals || []) {
			const lUpd = new Date(String(row.updated_at)).getTime();
			const gRemote = row.google_remote_updated ?
				new Date(String(row.google_remote_updated)).getTime() :
				0;

			if (!row.google_event_id) {
				const body = rowToGoogleBody(row);
				const cr = await gcalFetch(
					accessToken!,
					"POST",
					`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
					body,
				);
				const created = await cr.json();
				if (!cr.ok) {
					console.error("create google", created);
					continue;
				}
				pushed++;
				await admin
					.from("appointments")
					.update({
						google_event_id: created.id,
						google_etag: created.etag,
						google_remote_updated: created.updated,
					})
					.eq("id", row.id);
				continue;
			}

			if (lUpd <= gRemote) continue;

			const body = rowToGoogleBody(row);
			const put = await gcalFetch(
				accessToken!,
				"PUT",
				`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${
					encodeURIComponent(String(row.google_event_id))
				}`,
				body,
				row.google_etag ? { "If-Match": String(row.google_etag) } : {},
			);
			const updated = await put.json();
			if (put.status === 412) {
				const get = await gcalFetch(
					accessToken!,
					"GET",
					`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${
						encodeURIComponent(String(row.google_event_id))
					}`,
				);
				const fresh = await get.json();
				if (get.ok && fresh.updated && new Date(fresh.updated).getTime() > lUpd) continue;
				const put2 = await gcalFetch(
					accessToken!,
					"PUT",
					`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${
						encodeURIComponent(String(row.google_event_id))
					}`,
					body,
					fresh.etag ? { "If-Match": fresh.etag } : {},
				);
				const updated2 = await put2.json();
				if (put2.ok) {
					pushed++;
					await admin
						.from("appointments")
						.update({
							google_etag: updated2.etag,
							google_remote_updated: updated2.updated,
						})
						.eq("id", row.id);
				}
				continue;
			}
			if (!put.ok) {
				console.error("put google", updated);
				continue;
			}
			pushed++;
			await admin
				.from("appointments")
				.update({
					google_etag: updated.etag,
					google_remote_updated: updated.updated,
				})
				.eq("id", row.id);
		}

		await admin.from("google_calendar_connections").update({
			last_full_sync_at: new Date().toISOString(),
			last_error: null,
			updated_at: new Date().toISOString(),
		}).eq("user_id", user.id);

		return jsonResponse({ ok: true, pulled, pushed });
	} catch (e) {
		console.error(e);
		await admin.from("google_calendar_connections").update({
			last_error: String(e),
		}).eq("user_id", user.id);
		return jsonResponse({ error: String(e) }, { status: 500 });
	}
});
