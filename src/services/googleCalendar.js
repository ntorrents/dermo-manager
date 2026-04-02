import { supabase } from "./supabase";

/**
 * Inicia OAuth: devuelve URL a la que hay que redirigir (o asignar a location.href).
 */
export async function startGoogleCalendarLink() {
	const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
		body: { calendar_id: "primary" },
	});
	if (error) throw error;
	if (!data?.authUrl) throw new Error(data?.error || "No se pudo iniciar la conexión");
	return data.authUrl;
}

export async function syncGoogleCalendar() {
	const { data, error } = await supabase.functions.invoke("google-calendar-sync", { body: {} });
	if (error) throw error;
	if (!data?.ok) throw new Error(data?.error || "Error en la sincronización");
	return { pulled: data.pulled, pushed: data.pushed };
}

export async function disconnectGoogleCalendar() {
	const { data, error } = await supabase.functions.invoke("google-calendar-disconnect", { body: {} });
	if (error) throw error;
	if (!data?.ok) throw new Error(data?.error || "No se pudo desconectar");
	return true;
}

export async function fetchGoogleCalendarLinkStatus() {
	const { data, error } = await supabase.rpc("google_calendar_link_status");
	if (error) throw error;
	return data;
}
