import { supabase } from "./supabase";

const BUCKET = "recibos";

/**
 * Path para el justificante de un gasto.
 * Si se proporciona invoiceKey (NIF + número factura), usa ese como identificador único
 * para que múltiples gastos de la misma factura compartan el mismo archivo.
 */
export const getReceiptPath = (userId, expenseId, filename = "receipt.jpg", invoiceKey = null) => {
	const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() || "jpg" : "jpg";
	
	// Si hay invoiceKey (NIF + número factura), usar ese como identificador único
	// Esto permite que múltiples gastos de la misma factura compartan el mismo archivo
	if (invoiceKey) {
		// Normalizar el invoiceKey (eliminar espacios, caracteres especiales)
		const normalizedKey = invoiceKey.replace(/[^a-zA-Z0-9]/g, "_");
		return `receipts/${userId}/invoice_${normalizedKey}.${ext}`;
	}
	
	// Si no hay invoiceKey, usar el expenseId (comportamiento anterior)
	return `receipts/${userId}/${expenseId}.${ext}`;
};

/**
 * Sube el justificante (foto/PDF) y devuelve la ruta para guardar en receipt_url.
 * @param {string} userId - ID del usuario
 * @param {string} expenseId - ID del gasto (o null si es compra múltiple)
 * @param {File} file - Archivo a subir
 * @param {string} invoiceKey - Clave única de factura (NIF + número factura) para compartir archivo entre múltiples gastos
 */
export const uploadReceipt = async (userId, expenseId, file, invoiceKey = null) => {
	const path = getReceiptPath(userId, expenseId, file.name, invoiceKey);
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: file.type,
		upsert: true, // Si ya existe, lo sobrescribe (útil para actualizar facturas)
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
