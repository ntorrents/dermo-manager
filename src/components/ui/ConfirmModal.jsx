// /Users/nilto/Documents/GitHub/DermoManager/src/components/ui/ConfirmModal.jsx
import React from "react";
import { LogOut, AlertCircle } from "lucide-react";

export const ConfirmModal = ({
	isOpen,
	title,
	message,
	onConfirm,
	onCancel,
	isDestructive = false,
}) => {
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="p-6 text-center">
					<div
						className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${isDestructive ? "bg-red-100 text-red-600" : "bg-rose-100 text-rose-600"}`}>
						{isDestructive ? <LogOut size={24} /> : <AlertCircle size={24} />}
					</div>
					<h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
					<p className="text-sm text-gray-500 mb-6">{message}</p>
					<div className="flex gap-3">
						<button
							onClick={onCancel}
							className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
							Cancelar
						</button>
						<button
							onClick={onConfirm}
							className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl shadow-sm active:scale-95 ${isDestructive ? "bg-red-500" : "bg-rose-500"}`}>
							Confirmar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
