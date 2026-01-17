// /Users/nilto/Documents/GitHub/DermoManager/src/components/ui/SessionModal.jsx
import React, { useState } from "react";
import { User } from "lucide-react";

export const SessionModal = ({ isOpen, treatment, onClose, onConfirm }) => {
	const [clientName, setClientName] = useState("");
	if (!isOpen || !treatment) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="p-6">
					<h3 className="text-lg font-bold text-gray-900 mb-1">
						Registrar Sesión
					</h3>
					<p className="text-sm text-gray-500 mb-4">
						{treatment.name} -{" "}
						<span className="font-bold text-rose-500">{treatment.price}€</span>
					</p>
					<div className="mb-4">
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Nombre del Cliente (Opcional)
						</label>
						<div className="relative">
							<User
								className="absolute left-3 top-2.5 text-gray-400"
								size={16}
							/>
							<input
								type="text"
								placeholder="Ej: María García"
								className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-rose-500 outline-none text-sm"
								value={clientName}
								onChange={(e) => setClientName(e.target.value)}
								autoFocus
							/>
						</div>
					</div>
					<div className="flex gap-3">
						<button
							onClick={onClose}
							className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
							Cancelar
						</button>
						<button
							onClick={() => onConfirm(treatment, clientName)}
							className="flex-1 px-4 py-2 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 shadow-sm">
							Confirmar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
