import { supabase } from "./supabase";

const BUCKET = "recibos";

/**
 * Path para el justificante de un gasto.
 */
export const getReceiptPath = (userId, expenseId, filename = "receipt.jpg") => {
	const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() || "jpg" : "jpg";
	return `receipts/${userId}/${expenseId}.${ext}`;
};

/**
 * Sube el justificante (foto/PDF) y devuelve la ruta para guardar en receipt_url.
 */
export const uploadReceipt = async (userId, expenseId, file) => {
	const path = getReceiptPath(userId, expenseId, file.name);
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: file.type,
		upsert: true,
	});
	if (error) throw error;
	return path;
};

/**
 * Devuelve la URL pública del justificante (o firmada si el bucket es privado).
 */
export const getReceiptUrl = (path) => {
	if (!path) return null;
	try {
		const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
		return data?.publicUrl ?? null;
	} catch (error) {
		console.error("Error obteniendo URL pública:", error);
		return null;
	}
};

/**
 * Genera URL firmada (válida 1h) para buckets privados.
 * Si falla, intenta con URL pública como fallback.
 */
export const getReceiptSignedUrl = async (path, expirySeconds = 3600) => {
	if (!path) return null;
	try {
		const { data, error } = await supabase.storage
			.from(BUCKET)
			.createSignedUrl(path, expirySeconds);
		
		if (error) {
			console.warn("Error obteniendo URL firmada, intentando URL pública:", error);
			// Fallback a URL pública
			return getReceiptUrl(path);
		}
		
		return data?.signedUrl ?? null;
	} catch (error) {
		console.error("Error en getReceiptSignedUrl:", error);
		// Fallback a URL pública
		return getReceiptUrl(path);
	}
};
