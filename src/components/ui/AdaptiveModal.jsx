import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/**
 * Modal adaptativo:
 * - Desktop (xl): diálogo centrado
 * - Móvil: bottom drawer (desliza desde abajo)
 * Usa Portal para evitar clipping por padres con overflow
 */
export const AdaptiveModal = ({
	isOpen,
	onClose,
	title,
	children,
	maxWidth = "max-w-lg",
}) => {
	const dialogRef = useRef(null);

	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	useFocusTrap(isOpen, dialogRef, { onEscape: onClose });

	if (!isOpen) return null;

	const modal = (
		<div className="fixed inset-0 z-[100] flex items-end xl:items-center justify-center p-0 xl:p-4">
			<div
				className="fixed inset-0 bg-black/40 backdrop-blur-sm"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				className={`relative bg-white w-full ${maxWidth} rounded-t-3xl xl:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-up`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="adaptive-modal-title">
				<div className="p-6 xl:p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
					<h3
						id="adaptive-modal-title"
						className="text-xl xl:text-2xl font-black text-gray-800 tracking-tight">
						{title}
					</h3>
					<button
						type="button"
						onClick={onClose}
						aria-label="Cerrar"
						className="p-2 rounded-full text-gray-400 hover:bg-white hover:text-gray-600 transition-colors">
						<X size={20} />
					</button>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 xl:p-8">
					{children}
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
};
