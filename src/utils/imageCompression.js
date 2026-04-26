import imageCompression from "browser-image-compression";

const PRESETS = {
	default: {
		maxSizeMB: 0.3,
		maxWidthOrHeight: 1920,
		initialQuality: 0.8,
	},
	/** Miniaturas de galería de sesión: más ligeras que antes/después */
	extra: {
		maxSizeMB: 0.14,
		maxWidthOrHeight: 1200,
		initialQuality: 0.72,
	},
};

/**
 * Comprime una imagen antes de subirla (JPEG).
 * @param {"default"|"extra"} variant - "extra" = galería sesión, menor peso
 */
export const compressImage = async (file, variant = "default") => {
	const p = PRESETS[variant] || PRESETS.default;
	const options = {
		maxSizeMB: p.maxSizeMB,
		maxWidthOrHeight: p.maxWidthOrHeight,
		initialQuality: p.initialQuality,
		useWebWorker: true,
		fileType: "image/jpeg",
	};
	try {
		return await imageCompression(file, options);
	} catch (err) {
		console.error("Error comprimiendo imagen:", err);
		throw err;
	}
};
