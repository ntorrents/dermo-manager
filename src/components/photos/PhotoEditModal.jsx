import React, { useState, useRef } from "react";
import { Loader2, Camera } from "lucide-react";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { LoadingButton } from "../ui/LoadingButton";
import {
	updateSessionPhoto,
	replaceSessionPhotoFile,
} from "../../services/photoStorage";
import { isAcceptedImageFile, normalizeImageForUpload } from "../../utils/normalizeImageFile";

export const PhotoEditModal = ({
	isOpen,
	onClose,
	photo,
	userId,
	clientId,
	sessions = [],
	onSuccess,
}) => {
	const [type, setType] = useState(photo?.type || "before");
	const [financeEntryId, setFinanceEntryId] = useState(
		photo?.finance_entry_id || ""
	);
	const [replacementFile, setReplacementFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [saving, setSaving] = useState(false);
	const fileInputRef = useRef(null);

	React.useEffect(() => {
		if (photo) {
			setType(photo.type);
			setFinanceEntryId(photo.finance_entry_id || "");
			setReplacementFile(null);
			setPreview(null);
		}
	}, [photo, isOpen]);

	const handleFileSelect = async (e) => {
		const file = e.target.files?.[0];
		if (!file || !isAcceptedImageFile(file)) return;
		const normalized = await normalizeImageForUpload(file);
		setReplacementFile(normalized);
		const reader = new FileReader();
		reader.onload = () => setPreview(reader.result);
		reader.readAsDataURL(normalized);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!photo || !userId || !clientId) return;

		setSaving(true);
		try {
			const typeChanged = type !== photo.type;
			const sessionChanged =
				financeEntryId && financeEntryId !== photo.finance_entry_id;

			if (typeChanged || sessionChanged) {
				await updateSessionPhoto(photo.id, {
					...(typeChanged && { type }),
					...(sessionChanged && { financeEntryId }),
				});
			}

			if (replacementFile) {
				await replaceSessionPhotoFile(photo, {
					userId,
					clientId,
					file: replacementFile,
					type,
					financeEntryId: financeEntryId || photo.finance_entry_id,
				});
			}

			onSuccess?.();
			onClose();
		} catch (err) {
			console.error(err);
			onSuccess?.(err);
		} finally {
			setSaving(false);
		}
	};

	if (!photo) return null;

	return (
		<AdaptiveModal
			isOpen={isOpen}
			onClose={onClose}
			title="Editar foto"
			maxWidth="max-w-md">
			<form onSubmit={handleSubmit} className="space-y-6">
				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						Tipo
					</label>
					<div className="grid grid-cols-3 gap-2">
						{["before", "after", "extra"].map((t) => (
							<label
								key={t}
								className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
									type === t
										? "border-rose-500 bg-rose-50 text-rose-600"
										: "border-gray-100 bg-gray-50 text-gray-500"
								}`}>
								<input
									type="radio"
									name="editType"
									value={t}
									checked={type === t}
									onChange={() => setType(t)}
									className="sr-only"
								/>
								<Camera size={16} />
								<span className="text-[11px] font-bold">
									{t === "before" ? "Antes" : t === "after" ? "Después" : "Galería"}
								</span>
							</label>
						))}
					</div>
				</div>

				<div>
					<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
						Sesión
					</label>
					<select
						value={financeEntryId}
						onChange={(e) => setFinanceEntryId(e.target.value)}
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
						Reemplazar imagen
					</label>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*,.heic,.heif,.webp,.avif"
						onChange={handleFileSelect}
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
								<span className="text-sm font-bold">
									{replacementFile ? replacementFile.name : "Seleccionar otra imagen"}
								</span>
							</div>
						)}
					</button>
					<p className="text-xs text-gray-400 mt-2">
						Opcional. Dejar vacío para conservar la imagen actual.
					</p>
				</div>

				<LoadingButton
					loading={saving}
					type="submit"
					className="w-full bg-primary text-white font-black py-4 rounded-xl">
					{saving ? "Guardando..." : "Guardar cambios"}
				</LoadingButton>
			</form>
		</AdaptiveModal>
	);
};
