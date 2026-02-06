import React, { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { uploadSessionPhoto } from "../../services/photoStorage";

export const PhotoUploadModal = ({
	isOpen,
	onClose,
	userId,
	clientId,
	sessions = [],
	onSuccess,
}) => {
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [photoType, setPhotoType] = useState("before");
	const [uploading, setUploading] = useState(false);
	const [preview, setPreview] = useState(null);
	const [selectedFile, setSelectedFile] = useState(null);
	const fileInputRef = useRef(null);

	const reset = () => {
		setSelectedEntry(null);
		setPhotoType("before");
		setPreview(null);
		setSelectedFile(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleFileSelect = (e) => {
		const file = e.target.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;
		setSelectedFile(file);
		const reader = new FileReader();
		reader.onload = () => setPreview(reader.result);
		reader.readAsDataURL(file);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!selectedFile || !selectedEntry || !userId || !clientId) return;

		setUploading(true);
		try {
			await uploadSessionPhoto({
				userId,
				clientId,
				financeEntryId: selectedEntry.id,
				type: photoType,
				file: selectedFile,
			});
			onSuccess?.();
			handleClose();
		} catch (err) {
			console.error(err);
			onSuccess?.(err);
		} finally {
			setUploading(false);
		}
	};

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
					<div className="flex gap-3">
						<label
							className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
								photoType === "before"
									? "border-rose-500 bg-rose-50 text-rose-600"
									: "border-gray-100 bg-gray-50 text-gray-500"
							}`}>
							<input
								type="radio"
								name="photoType"
								value="before"
								checked={photoType === "before"}
								onChange={() => setPhotoType("before")}
								className="sr-only"
							/>
							<Camera size={18} />
							Antes
						</label>
						<label
							className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
								photoType === "after"
									? "border-rose-500 bg-rose-50 text-rose-600"
									: "border-gray-100 bg-gray-50 text-gray-500"
							}`}>
							<input
								type="radio"
								name="photoType"
								value="after"
								checked={photoType === "after"}
								onChange={() => setPhotoType("after")}
								className="sr-only"
							/>
							<Camera size={18} />
							Después
						</label>
					</div>
				</div>

				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						Foto
					</label>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						capture="environment"
						onChange={handleFileSelect}
						required
						className="hidden"
					/>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 hover:border-rose-200 hover:bg-rose-50/30 flex items-center justify-center transition-all overflow-hidden">
						{preview ? (
							<img
								src={preview}
								alt="Vista previa"
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="flex flex-col items-center gap-2 text-gray-400">
								<Camera size={40} />
								<span className="text-sm font-bold">Seleccionar imagen</span>
							</div>
						)}
					</button>
					<p className="text-xs text-gray-400 mt-2">
						Se comprimirá a ~200KB antes de subir
					</p>
				</div>

				<button
					type="submit"
					disabled={uploading || !selectedFile || !selectedEntry}
					className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
					{uploading ? (
						<>
							<Loader2 size={20} className="animate-spin" />
							Subiendo...
						</>
					) : (
						"Guardar foto"
					)}
				</button>
			</form>
		</AdaptiveModal>
	);
};
