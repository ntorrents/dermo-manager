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
 * Muestra fotos Antes/Después side-by-side para una sesión.
 */
export const BeforeAfterViewer = ({ beforePhoto, afterPhoto, sessionLabel }) => {
	const hasBefore = !!beforePhoto;
	const hasAfter = !!afterPhoto;

	if (!hasBefore && !hasAfter) return null;

	return (
		<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
			{sessionLabel && (
				<p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
					{sessionLabel}
				</p>
			)}
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<p className="text-[10px] font-black text-gray-400 uppercase">
						Antes
					</p>
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
					<p className="text-[10px] font-black text-gray-400 uppercase">
						Después
					</p>
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
		</div>
	);
};
