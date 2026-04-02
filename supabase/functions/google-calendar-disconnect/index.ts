import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

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

	const { error } = await admin.from("google_calendar_connections").delete().eq("user_id", user.id);

	if (error) {
		return jsonResponse({ error: error.message }, { status: 500 });
	}

	await admin
		.from("appointments")
		.update({
			google_event_id: null,
			google_etag: null,
			google_remote_updated: null,
		})
		.eq("user_id", user.id);

	return jsonResponse({ ok: true });
});
