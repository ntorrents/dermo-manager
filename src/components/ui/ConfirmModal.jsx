import React from "react";
import { AdaptiveModal } from "./AdaptiveModal";

/**
 * Confirmación destructiva / neutra sobre AdaptiveModal.
 * Loss Aversion: el caller pasa message concreto (qué se pierde).
 */
export const ConfirmModal = ({
	isOpen,
	title,
	message,
	onConfirm,
	onCancel,
	isDestructive = false,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
}) => {
	return (
		<AdaptiveModal
			isOpen={isOpen}
			onClose={onCancel}
			title={title}
			maxWidth="max-w-md">
			<p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
			<div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">
				<button
					type="button"
					onClick={onCancel}
					className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">
					{cancelLabel}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl shadow-sm active:scale-[0.98] transition-colors ${
						isDestructive
							? "bg-red-600 hover:bg-red-700"
							: "bg-rose-700 hover:bg-rose-800"
					}`}>
					{confirmLabel}
				</button>
			</div>
		</AdaptiveModal>
	);
};
