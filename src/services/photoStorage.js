import { supabase } from "./supabase";
import { compressImage } from "../utils/imageCompression";

const BUCKET = "session-photos";
const SIGNED_URL_EXPIRY = 3600;

/**
 * Genera el path de almacenamiento para una foto.
 */
const getStoragePath = (userId, clientId, entryId, type) => {
	const ts = Date.now();
	return `${userId}/${clientId}/${entryId}/${type}_${ts}.jpg`;
};

/**
 * Sube una foto comprimida y crea el registro en session_photos.
 */
export const uploadSessionPhoto = async ({
	userId,
	clientId,
	financeEntryId,
	type,
	file,
}) => {
	const compressed = await compressImage(file);
	const path = getStoragePath(userId, clientId, financeEntryId, type);

	const { error: uploadError } = await supabase.storage
		.from(BUCKET)
		.upload(path, compressed, {
			contentType: "image/jpeg",
			upsert: false,
		});

	if (uploadError) throw uploadError;

	const { data, error } = await supabase
		.from("session_photos")
		.insert([
			{
				user_id: userId,
				client_id: clientId,
				finance_entry_id: financeEntryId,
				type,
				storage_path: path,
			},
		])
		.select()
		.single();

	if (error) throw error;
	return data;
};

/**
 * Obtiene una URL firmada para mostrar una imagen privada.
 */
export const getSignedUrl = async (storagePath) => {
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

	if (error) throw error;
	return data?.signedUrl || null;
};

/**
 * Elimina una foto (Storage + BD).
 */
export const deleteSessionPhoto = async (photo) => {
	const { error: storageError } = await supabase.storage
		.from(BUCKET)
		.remove([photo.storage_path]);

	if (storageError) throw storageError;

	const { error } = await supabase
		.from("session_photos")
		.delete()
		.eq("id", photo.id);

	if (error) throw error;
};
