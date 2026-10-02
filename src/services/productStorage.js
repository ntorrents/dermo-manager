import { supabase } from "./supabase";

const BUCKET = "product-images";

/**
 * Sube imagen de producto. Ruta: {userId}/{clinicId}/{productId|tmp}/{ts}.ext
 * @returns {{ publicUrl: string, path: string }}
 */
export const uploadProductImage = async (userId, clinicId, file, productId = "tmp") => {
	if (!userId || !clinicId || !file) throw new Error("Faltan datos para subir imagen");
	const ext = file.name.includes(".")
		? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
		: "jpg";
	const path = `${userId}/${clinicId}/${productId}/${Date.now()}.${ext}`;
	const mime =
		file.type && file.type.startsWith("image/")
			? file.type
			: ext === "png"
				? "image/png"
				: ext === "webp"
					? "image/webp"
					: "image/jpeg";
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: mime,
		upsert: true,
	});
	if (error) throw error;
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
	return { publicUrl: data?.publicUrl || null, path };
};

export const removeProductImage = async (storagePath) => {
	if (!storagePath) return;
	await supabase.storage.from(BUCKET).remove([storagePath]);
};
