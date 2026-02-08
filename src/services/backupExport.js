import { supabase } from "./supabase";

/**
 * Exporta todos los datos del usuario en un único JSON.
 * No incluye archivos de fotos (solo metadatos de session_photos).
 */
export const exportUserBackup = async (userId) => {
	if (!userId) throw new Error("Usuario no identificado");

	const [
		{ data: profile },
		{ data: clients },
		{ data: treatments },
		{ data: inventory },
		{ data: inventoryBatches },
		{ data: financeEntries },
		{ data: recurringConfig },
		{ data: appointments },
		{ data: sessionPhotos },
	] = await Promise.all([
		supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
		supabase.from("clients").select("*").eq("user_id", userId).order("name"),
		supabase.from("treatments").select("*").eq("user_id", userId).order("name"),
		supabase.from("inventory").select("*").eq("user_id", userId).order("name"),
		supabase.from("inventory_batches").select("*").eq("user_id", userId),
		supabase.from("finance_entries").select("*").eq("user_id", userId).order("date", { ascending: false }),
		supabase.from("recurring_config").select("*").eq("user_id", userId),
		supabase.from("appointments").select("*").eq("user_id", userId).order("start_at", { ascending: true }),
		supabase.from("session_photos").select("id, client_id, finance_entry_id, type, storage_path, created_at").eq("user_id", userId),
	]);

	const backup = {
		exportedAt: new Date().toISOString(),
		userId,
		version: "1.0",
		data: {
			profile: profile || null,
			clients: clients || [],
			treatments: treatments || [],
			inventory: inventory || [],
			inventory_batches: inventoryBatches || [],
			finance_entries: financeEntries || [],
			recurring_config: recurringConfig || [],
			appointments: appointments || [],
			session_photos: sessionPhotos || [],
		},
	};

	return backup;
};

/**
 * Descarga el backup como archivo JSON.
 */
export const downloadBackup = (backup, filename) => {
	const json = JSON.stringify(backup, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename || `dermomanager-backup-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
};
