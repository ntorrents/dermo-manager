import React, { useState, useEffect } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { getSignedUrl } from "../../services/photoStorage";

const PhotoWithSignedUrl = ({ photo, className, alt }) => {
	const [url, setUrl] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const signedUrl = await getSignedUrl(photo.storage_path);
				if (!cancelled) {
					setUrl(signedUrl);
				}
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

	if (loading)
		return (
			<div
				className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}>
				<Loader2 size={24} className="animate-spin text-gray-400" />
			</div>
		);

	if (error)
		return (
			<div
				className={`flex items-center justify-center bg-gray-100 rounded-xl text-gray-400 ${className}`}>
				<ImageIcon size={24} />
			</div>
		);

	return (
		<img
			src={url}
			alt={alt}
			className={`object-cover w-full h-full rounded-xl ${className}`}
		/>
	);
};

/**
 * Antes / Después a tamaño principal + carrusel de fotos extra de la sesión.
 */
export const BeforeAfterViewer = ({
	beforePhoto,
	afterPhoto,
	extraPhotos = [],
	sessionLabel,
}) => {
	const extras = (extraPhotos || []).filter(Boolean);
	const [activeExtraIdx, setActiveExtraIdx] = useState(0);

	useEffect(() => {
		setActiveExtraIdx(0);
	}, [beforePhoto?.id, afterPhoto?.id, extras.length]);

	const hasBefore = !!beforePhoto;
	const hasAfter = !!afterPhoto;
	const hasMain = hasBefore || hasAfter;
	if (!hasMain && extras.length === 0) return null;

	return (
		<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
			{sessionLabel && (
				<p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
					{sessionLabel}
				</p>
			)}

			{hasMain && (
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<p className="text-[10px] font-black text-gray-400 uppercase">Antes</p>
						<div className="aspect-[3/4] min-h-[120px] bg-gray-50 rounded-xl overflow-hidden">
							{hasBefore ? (
								<PhotoWithSignedUrl
									photo={beforePhoto}
									className="w-full h-full"
									alt="Antes"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-gray-300">
									<ImageIcon size={32} />
								</div>
							)}
						</div>
					</div>
					<div className="space-y-1">
						<p className="text-[10px] font-black text-gray-400 uppercase">Después</p>
						<div className="aspect-[3/4] min-h-[120px] bg-gray-50 rounded-xl overflow-hidden">
							{hasAfter ? (
								<PhotoWithSignedUrl
									photo={afterPhoto}
									className="w-full h-full"
									alt="Después"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-gray-300">
									<ImageIcon size={32} />
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{extras.length > 0 && (
				<div className="space-y-2 border-t border-gray-100 pt-3">
					<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
						Más fotos de la sesión ({extras.length})
					</p>
					<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
						{extras.map((ph, i) => (
							<button
								key={ph.id}
								type="button"
								onClick={() => setActiveExtraIdx(i)}
								aria-label={`Ver foto adicional ${i + 1}`}
								className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
									activeExtraIdx === i
										? "border-rose-500 ring-2 ring-rose-200"
										: "border-gray-200 opacity-80 hover:opacity-100"
								}`}>
								<PhotoWithSignedUrl
									photo={ph}
									className="w-full h-full !rounded-none"
									alt={`Extra ${i + 1}`}
								/>
							</button>
						))}
					</div>
					<div className="h-44 sm:h-52 bg-gray-50 rounded-xl overflow-hidden">
						<PhotoWithSignedUrl
							photo={extras[activeExtraIdx]}
							className="w-full h-full object-contain !rounded-none"
							alt="Vista ampliada"
						/>
					</div>
				</div>
			)}
		</div>
	);
};
