import React, { useState, useRef } from "react";
import { Camera, Loader2, Images } from "lucide-react";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { uploadSessionPhoto } from "../../services/photoStorage";
import { isAcceptedImageFile, normalizeImageForUpload } from "../../utils/normalizeImageFile";

const fileToDataUrl = (file) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});

export const PhotoUploadModal = ({
	isOpen,
	onClose,
	userId,
	clinicId,
	clientId,
	sessions = [],
	onSuccess,
	initialSession = null,
	initialPhotoType = "before",
}) => {
	const [selectedEntry, setSelectedEntry] = useState(initialSession);
	const [photoType, setPhotoType] = useState(initialPhotoType);
	const [uploading, setUploading] = useState(false);
	const [previewUrls, setPreviewUrls] = useState([]);
	const [selectedFiles, setSelectedFiles] = useState([]);
	const fileInputRef = useRef(null);

	React.useEffect(() => {
		if (isOpen) {
			setSelectedEntry(initialSession);
			setPhotoType(initialPhotoType);
			setPreviewUrls([]);
			setSelectedFiles([]);
		}
	}, [isOpen, initialSession?.id, initialPhotoType]);

	const reset = () => {
		setSelectedEntry(initialSession);
		setPhotoType(initialPhotoType);
		setPreviewUrls([]);
		setSelectedFiles([]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleFileSelect = async (e) => {
		const list = e.target.files;
		if (!list?.length) return;
		const picked = Array.from(list).filter(isAcceptedImageFile);
		if (!picked.length) return;

		const maxFiles = photoType === "extra" ? 12 : 1;
		const slice = picked.slice(0, maxFiles);
		const normalized = await Promise.all(slice.map((f) => normalizeImageForUpload(f)));

		if (photoType === "extra") {
			setSelectedFiles(normalized);
			const urls = await Promise.all(normalized.map((f) => fileToDataUrl(f)));
			setPreviewUrls(urls);
		} else {
			setSelectedFiles([normalized[0]]);
			setPreviewUrls([await fileToDataUrl(normalized[0])]);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!selectedFiles.length || !selectedEntry || !userId || !clientId || !clinicId) return;

		setUploading(true);
		try {
			for (const file of selectedFiles) {
				await uploadSessionPhoto({
					userId,
					clinicId,
					clientId,
					financeEntryId: selectedEntry.id,
					type: photoType,
					file,
				});
			}
			onSuccess?.();
			handleClose();
		} catch (err) {
			console.error(err);
			onSuccess?.(err);
		} finally {
			setUploading(false);
		}
	};

	const isExtra = photoType === "extra";

	return (
		<AdaptiveModal
			isOpen={isOpen}
			onClose={handleClose}
			title="Añadir foto"
			maxWidth="max-w-md">
			<form onSubmit={handleSubmit} className="space-y-6">
				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						Sesión
					</label>
					<select
						required
						value={selectedEntry?.id || ""}
						onChange={(e) => {
							const entry = sessions.find((s) => s.id === e.target.value);
							setSelectedEntry(entry || null);
						}}
						className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-rose-100">
						<option value="">Seleccionar sesión...</option>
						{sessions.map((s) => (
							<option key={s.id} value={s.id}>
								{s.description?.split("(")[0] || "Sesión"} — {s.date}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						Tipo
					</label>
					<div className="grid grid-cols-3 gap-2">
						{[
							{ v: "before", label: "Antes", Icon: Camera },
							{ v: "after", label: "Después", Icon: Camera },
							{ v: "extra", label: "Galería", Icon: Images },
						].map(({ v, label, Icon: I }) => (
							<label
								key={v}
								className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
									photoType === v
										? "border-rose-500 bg-rose-50 text-rose-600"
										: "border-gray-100 bg-gray-50 text-gray-500"
								}`}>
								<input
									type="radio"
									name="photoType"
									value={v}
									checked={photoType === v}
									onChange={() => {
										setPhotoType(v);
										setSelectedFiles([]);
										setPreviewUrls([]);
										if (fileInputRef.current) fileInputRef.current.value = "";
									}}
									className="sr-only"
								/>
								<I size={16} />
								<span className="text-[11px] font-bold leading-tight">{label}</span>
							</label>
						))}
					</div>
					{isExtra && (
						<p className="text-[10px] text-gray-400 mt-2">
							Hasta 12 imágenes por lote. Se comprimen más que antes/después.
						</p>
					)}
				</div>

				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						{isExtra ? "Imágenes" : "Foto"}
					</label>
					<input
						key={photoType}
						ref={fileInputRef}
						type="file"
						accept="image/*,.heic,.heif,.webp,.avif"
						multiple={isExtra}
						capture={isExtra ? undefined : "environment"}
						onChange={handleFileSelect}
						required={false}
						className="hidden"
					/>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="w-full min-h-[140px] rounded-2xl border-2 border-dashed border-gray-200 hover:border-rose-200 hover:bg-rose-50/30 flex flex-col items-center justify-center transition-all overflow-hidden p-2">
						{previewUrls.length > 0 ? (
							<div
								className={`grid gap-2 w-full ${
									isExtra ? "grid-cols-3 max-h-48 overflow-y-auto" : "grid-cols-1"
								}`}>
								{previewUrls.map((src, i) => (
									<img
										key={i}
										src={src}
										alt=""
										className="w-full h-24 object-cover rounded-lg"
									/>
								))}
							</div>
						) : (
							<div className="flex flex-col items-center gap-2 text-gray-400 py-6">
								<Camera size={40} />
								<span className="text-sm font-bold">
									{isExtra ? "Seleccionar imágenes" : "Seleccionar imagen"}
								</span>
								<span className="text-[10px] text-center px-2">
									JPG, PNG, WebP, HEIC/HEIF y otros formatos habituales
								</span>
							</div>
						)}
					</button>
					<p className="text-xs text-gray-400 mt-2">
						{isExtra
							? "Cada imagen se optimiza (~100–150 KB) antes de subir."
							: "Se comprimirá a ~200–300 KB antes de subir."}
					</p>
				</div>

				<button
					type="submit"
					disabled={uploading || !selectedFiles.length || !selectedEntry}
					className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
					{uploading ? (
						<>
							<Loader2 size={20} className="animate-spin" />
							Subiendo...
						</>
					) : (
						`Guardar ${selectedFiles.length > 1 ? `(${selectedFiles.length})` : "foto"}`
					)}
				</button>
			</form>
		</AdaptiveModal>
	);
};
