import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Panel lateral de trabajo (CRUD).
 * Header y footer sticky; cuerpo con scroll independiente.
 */
export const SidePanel = ({
	isOpen,
	onClose,
	title,
	subtitle,
	children,
	footer,
	widthClass = "md:max-w-xl lg:max-w-2xl",
	size = "md", // sm | md | lg
}) => {
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e) => {
			if (e.key === "Escape") onClose?.();
		};
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const width =
		size === "lg"
			? "md:max-w-3xl lg:max-w-4xl"
			: size === "sm"
				? "md:max-w-md"
				: widthClass;

	return createPortal(
		<div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true">
			<button
				type="button"
				aria-label="Cerrar panel"
				className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
				onClick={onClose}
			/>
			<div
				className={`relative z-10 flex h-full w-full ${width} flex-col border-l border-slate-100 bg-white shadow-2xl animate-in slide-in-from-right max-md:mt-auto max-md:h-[92dvh] max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:animate-in max-md:slide-up`}>
				<header className="sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold text-slate-900 truncate">{title}</h2>
						{subtitle ? (
							<p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-slate-100 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
						aria-label="Cerrar">
						<X size={18} />
					</button>
				</header>
				<div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 bg-white">
					{children}
				</div>
				{footer ? (
					<footer className="sticky bottom-0 z-20 shrink-0 border-t border-slate-100 bg-white px-5 py-4">
						{footer}
					</footer>
				) : null}
			</div>
		</div>,
		document.body,
	);
};
