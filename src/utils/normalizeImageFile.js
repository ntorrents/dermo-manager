/**
 * Convierte HEIC/HEIF a JPEG en el cliente (Safari/iPhone).
 * Otros formatos se devuelven sin cambios.
 */
export async function normalizeImageForUpload(file) {
	if (!file || !(file instanceof Blob)) return file;

	const name = (file.name || "").toLowerCase();
	const mime = file.type || "";
	const looksHeic =
		mime === "image/heic" ||
		mime === "image/heif" ||
		name.endsWith(".heic") ||
		name.endsWith(".heif");

	if (!looksHeic) return file;

	const heic2any = (await import("heic2any")).default;
	const converted = await heic2any({
		blob: file,
		toType: "image/jpeg",
		quality: 0.85,
	});
	const blob = Array.isArray(converted) ? converted[0] : converted;
	const outName = (file.name || "foto").replace(/\.(heic|heif)$/i, ".jpg");
	return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
}

/** Acepta imagen por MIME o por extensión (p. ej. HEIC sin MIME fiable). */
export function isAcceptedImageFile(file) {
	if (!file) return false;
	const mime = (file.type || "").toLowerCase();
	if (mime.startsWith("image/")) return true;
	const n = (file.name || "").toLowerCase();
	return (
		n.endsWith(".heic") ||
		n.endsWith(".heif") ||
		n.endsWith(".webp") ||
		n.endsWith(".avif") ||
		n.endsWith(".png") ||
		n.endsWith(".jpg") ||
		n.endsWith(".jpeg") ||
		n.endsWith(".gif") ||
		n.endsWith(".bmp") ||
		n.endsWith(".tif") ||
		n.endsWith(".tiff")
	);
}
