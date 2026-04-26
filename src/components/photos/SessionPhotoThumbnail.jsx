import React, { useState } from "react";
import { Trash2, Edit2, Loader2, ImageIcon } from "lucide-react";
import { getSignedUrl } from "../../services/photoStorage";

const TYPE_LABELS = { before: "Antes", after: "Después", extra: "Galería" };

export const SessionPhotoThumbnail = ({
	photo,
	label,
	onView,
	onEdit,
	onDelete,
	compact = false,
}) => {
	const [url, setUrl] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	React.useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const signedUrl = await getSignedUrl(photo.storage_path);
				if (!cancelled) setUrl(signedUrl);
			} catch {
				if (!cancelled) setError(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [photo.storage_path]);

	const displayLabel = label || TYPE_LABELS[photo.type] || "Foto";

	const box = compact ? "w-12 h-16" : "w-16 h-20";

	if (loading) {
		return (
			<div
				className={`relative ${box} rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group overflow-hidden cursor-pointer`}
				onClick={() => onView?.(photo)}>
				<Loader2 size={20} className="animate-spin text-gray-400" />
			</div>
		);
	}

	if (error) {
		return (
			<div
				className={`relative ${box} rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group overflow-hidden cursor-pointer border border-gray-200`}
				onClick={() => onView?.(photo)}>
				<ImageIcon size={20} className="text-gray-400" />
			</div>
		);
	}

	return (
		<div
			className={`relative ${box} rounded-lg overflow-hidden shrink-0 group cursor-pointer border border-gray-200 hover:border-rose-300 transition-colors`}
			onClick={() => onView?.(photo)}>
			<img
				src={url}
				alt={displayLabel}
				className="w-full h-full object-cover"
			/>
			<span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 text-center">
				{displayLabel}
			</span>
			<div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onEdit?.(photo);
					}}
					className="p-1.5 bg-white rounded-lg text-gray-700 hover:bg-rose-50 hover:text-rose-600 shadow"
					title="Editar">
					<Edit2 size={14} />
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onDelete?.(photo);
					}}
					className="p-1.5 bg-white rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 shadow"
					title="Eliminar">
					<Trash2 size={14} />
				</button>
			</div>
		</div>
	);
};
