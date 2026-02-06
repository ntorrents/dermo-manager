import imageCompression from "browser-image-compression";

const MAX_SIZE_MB = 0.3;
const MAX_WIDTH_OR_HEIGHT = 1920;
const INITIAL_QUALITY = 0.8;

/**
 * Comprime una imagen antes de subirla.
 * Objetivo: WebP/JPEG, max 1920px, ~200-300KB.
 */
export const compressImage = async (file) => {
	const options = {
		maxSizeMB: MAX_SIZE_MB,
		maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
		initialQuality: INITIAL_QUALITY,
		useWebWorker: true,
		fileType: "image/jpeg",
	};
	try {
		const compressed = await imageCompression(file, options);
		return compressed;
	} catch (err) {
		console.error("Error comprimiendo imagen:", err);
		throw err;
	}
};
