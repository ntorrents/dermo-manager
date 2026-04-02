import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseOAuthState } from "../_shared/oauth-state.ts";

Deno.serve(async (req) => {
	const url = new URL(req.url);
	const appSite = Deno.env.get("APP_SITE_URL") || "http://localhost:5173";

	const redirectWith = (query: string) =>
		new Response(null, {
			status: 302,
			headers: { Location: `${appSite.replace(/\/$/, "")}/?${query}` },
		});

	const err = url.searchParams.get("error");
	if (err) {
		return redirectWith(`google_calendar=error&message=${encodeURIComponent(err)}`);
	}

	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (!code || !state) {
		return redirectWith("google_calendar=error&message=missing_code");
	}

	const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
	const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
	const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

	if (!stateSecret || !clientId || !clientSecret || !supabaseUrl || !serviceKey) {
		return redirectWith("google_calendar=error&message=server_config");
	}

	const parsed = await parseOAuthState(state, stateSecret);
	if (!parsed) {
		return redirectWith("google_calendar=error&message=invalid_state");
	}

	const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth-callback`;

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}),
	});

	const tokenJson = await tokenRes.json().catch(() => ({}));
	if (!tokenRes.ok || !tokenJson.refresh_token) {
		console.error("token exchange", tokenJson);
		return redirectWith(
			`google_calendar=error&message=${encodeURIComponent(tokenJson.error || "token_exchange")}`,
		);
	}

	const admin = createClient(supabaseUrl, serviceKey);
	const expiresAt = tokenJson.expires_in ?
		new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString() :
		null;

	const { error: upsertErr } = await admin.from("google_calendar_connections").upsert(
		{
			user_id: parsed.sub,
			clinic_id: parsed.clinicId,
			google_calendar_id: "primary",
			refresh_token: tokenJson.refresh_token,
			access_token: tokenJson.access_token ?? null,
			access_token_expires_at: expiresAt,
			last_error: null,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "user_id" },
	);

	if (upsertErr) {
		console.error(upsertErr);
		return redirectWith("google_calendar=error&message=db_save");
	}

	return redirectWith("google_calendar=connected");
});
