import { supabase } from "../../../services/supabase";

/** Procesa la cola Resend; lanza si falla. */
export async function processEmailQueue() {
	const { data, error } = await supabase.functions.invoke("process-email-queue", {
		body: {},
	});
	if (error) throw error;
	if (data?.error) throw new Error(data.error);
	return data;
}

export function parseExtraEmails(raw) {
	if (!raw || !String(raw).trim()) return [];
	const parts = String(raw)
		.split(/[\s,;]+/)
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return [...new Set(parts.filter((e) => re.test(e)))];
}
