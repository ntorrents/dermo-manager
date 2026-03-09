import { supabase } from "./supabase";

const BUCKET = "signed-consents";
const SIGNED_URL_EXPIRY = 3600;

/**
 * Genera la ruta en storage: userId/clientId/uuid.pdf
 */
const getStoragePath = (userId, clientId) => {
	const uuid = crypto.randomUUID();
	return `${userId}/${clientId}/${uuid}.pdf`;
};

/**
 * Sube un PDF de consentimiento firmado y crea el registro en signed_consents.
 * @param {{ userId: string, clientId: string, treatmentId?: string, treatmentName: string, file: File }}
 */
export const uploadSignedConsent = async ({
	userId,
	clientId,
	treatmentId,
	treatmentName,
	file,
}) => {
	const path = getStoragePath(userId, clientId);

	const { error: uploadError } = await supabase.storage
		.from(BUCKET)
		.upload(path, file, {
			contentType: "application/pdf",
			upsert: false,
		});

	if (uploadError) throw uploadError;

	const { data, error } = await supabase
		.from("signed_consents")
		.insert([
			{
				user_id: userId,
				client_id: clientId,
				treatment_id: treatmentId || null,
				treatment_name: treatmentName,
				storage_path: path,
			},
		])
		.select()
		.single();

	if (error) throw error;
	return data;
};

/**
 * Lista los consentimientos firmados de un cliente (ordenados por fecha desc).
 */
export const listSignedConsentsByClient = async (clientId) => {
	if (!clientId) return [];
	const { data, error } = await supabase
		.from("signed_consents")
		.select("id, treatment_name, storage_path, uploaded_at, treatment_id")
		.eq("client_id", clientId)
		.order("uploaded_at", { ascending: false });
	if (error) throw error;
	return data || [];
};

/**
 * Obtiene una URL firmada para descargar el PDF.
 */
export const getSignedConsentDownloadUrl = async (storagePath) => {
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
	if (error) throw error;
	return data?.signedUrl || null;
};

/**
 * Elimina un consentimiento firmado (Storage + BD).
 */
export const deleteSignedConsent = async (id) => {
	const { data: row, error: fetchError } = await supabase
		.from("signed_consents")
		.select("storage_path")
		.eq("id", id)
		.single();
	if (fetchError || !row) throw fetchError || new Error("Consentimiento no encontrado");

	const { error: storageError } = await supabase.storage
		.from(BUCKET)
		.remove([row.storage_path]);
	if (storageError) throw storageError;

	const { error } = await supabase.from("signed_consents").delete().eq("id", id);
	if (error) throw error;
};
