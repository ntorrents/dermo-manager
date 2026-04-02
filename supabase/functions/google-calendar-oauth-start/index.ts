import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { signOAuthState } from "../_shared/oauth-state.ts";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"].join(" ");

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	try {
		const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
		const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

		if (!stateSecret || !clientId || !supabaseUrl || !anonKey) {
			return jsonResponse({ error: "Configuración del servidor incompleta" }, { status: 500 });
		}

		const authHeader = req.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return jsonResponse({ error: "No autorizado" }, { status: 401 });
		}

		const supabase = createClient(supabaseUrl, anonKey, {
			global: { headers: { Authorization: authHeader } },
		});

		const { data: { user }, error: userErr } = await supabase.auth.getUser();
		if (userErr || !user) {
			return jsonResponse({ error: "Sesión no válida" }, { status: 401 });
		}

		let body: { calendar_id?: string } = {};
		if (req.method === "POST") {
			try {
				body = await req.json();
			} catch {
				body = {};
			}
		}

		const { data: profile, error: pErr } = await supabase
			.from("profiles")
			.select("clinic_id")
			.eq("id", user.id)
			.maybeSingle();

		if (pErr || !profile?.clinic_id) {
			return jsonResponse({ error: "Perfil o clínica no encontrados" }, { status: 400 });
		}

		const state = await signOAuthState(user.id, profile.clinic_id, stateSecret);
		const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth-callback`;

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: SCOPES,
			access_type: "offline",
			prompt: "consent",
			state,
			include_granted_scopes: "true",
		});

		const authUrl =
			`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

		return jsonResponse({ authUrl, calendarId: body.calendar_id || "primary" });
	} catch (e) {
		console.error(e);
		return jsonResponse({ error: "Error al iniciar OAuth" }, { status: 500 });
	}
});
