import { supabase } from "./supabase";

const BUCKET = "company-assets";

/**
 * Sube una imagen al bucket company-assets (público; mismo que logo.svg) en la carpeta del usuario.
 * Ruta: {userId}/logo/... o {userId}/signature/... para mantener orden.
 * @returns {Promise<string>} URL pública del archivo
 */
export const uploadProfileAsset = async (userId, file, subfolder = "signature") => {
	if (!userId || !file) throw new Error("Falta usuario o archivo");
	const ext = file.name.includes(".")
		? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "png"
		: "png";
	const path = `${userId}/${subfolder}/${Date.now()}.${ext}`;
	const mimeFromExt =
		ext === "jpg" || ext === "jpeg"
			? "image/jpeg"
			: ext === "webp"
				? "image/webp"
				: ext === "gif"
					? "image/gif"
					: ext === "svg"
						? "image/svg+xml"
						: "image/png";
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		// Forzar MIME para que al hacer fetch no llegue application/octet-stream (y falle el PDF)
		contentType: file.type && file.type.startsWith("image/") ? file.type : mimeFromExt,
		upsert: true,
	});
	if (error) throw error;
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
	return data?.publicUrl || null;
};
