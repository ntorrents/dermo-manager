import React, { useState, useEffect, useRef } from "react";
import { User, Search, X, Check } from "lucide-react";

export const SessionModal = ({
	isOpen,
	treatment,
	clients = [],
	onClose,
	onConfirm,
}) => {
	// Buscador y Selección
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState(null);
	const [showSuggestions, setShowSuggestions] = useState(false);

	// Referencia para detectar clics fuera
	const wrapperRef = useRef(null);

	// Resetear estados al abrir/cerrar
	useEffect(() => {
		if (isOpen) {
			setSearchTerm("");
			setSelectedClient(null);
			setShowSuggestions(false);
		}
	}, [isOpen]);

	// Cerrar sugerencias al hacer clic fuera
	useEffect(() => {
		function handleClickOutside(event) {
			if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				setShowSuggestions(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [wrapperRef]);

	if (!isOpen || !treatment) return null;

	// Filtrar clientes (máximo 5 sugerencias)
	const filteredClients = clients
		.filter(
			(c) =>
				c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				c.surname?.toLowerCase().includes(searchTerm.toLowerCase()),
		)
		.slice(0, 5);

	const handleSelect = (client) => {
		setSelectedClient(client);
		setSearchTerm(`${client.name} ${client.surname || ""}`.trim());
		setShowSuggestions(false);
	};

	const handleSubmit = () => {
		// Enviamos el objeto cliente entero (si existe) O el texto escrito
		const clientData = selectedClient || { name: searchTerm, isGuest: true };
		onConfirm(treatment, clientData);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
				<div className="p-6">
					<h3 className="text-lg font-bold text-gray-900 mb-1">
						Registrar Sesión
					</h3>
					<p className="text-sm text-gray-500 mb-6">
						{treatment.name} -{" "}
						<span className="font-bold text-rose-500">{treatment.price}€</span>
					</p>

					<div className="mb-6 relative" ref={wrapperRef}>
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Cliente
						</label>

						{/* Input Buscador */}
						<div className="relative">
							<User
								className={`absolute left-3 top-3 transition-colors ${selectedClient ? "text-rose-500" : "text-gray-400"}`}
								size={18}
							/>
							<input
								type="text"
								placeholder="Buscar o escribir nombre..."
								className={`w-full pl-10 pr-10 py-3 rounded-xl border outline-none text-sm transition-all ${
									selectedClient
										? "border-rose-500 bg-rose-50 text-rose-900 font-bold"
										: "border-gray-200 focus:border-rose-500"
								}`}
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									setSelectedClient(null); // Al escribir, quitamos la selección fija
									setShowSuggestions(true);
								}}
								onFocus={() => setShowSuggestions(true)}
							/>
							{/* Botón X para limpiar */}
							{searchTerm && (
								<button
									onClick={() => {
										setSearchTerm("");
										setSelectedClient(null);
									}}
									className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
									<X size={16} />
								</button>
							)}
						</div>

						{/* Lista de Sugerencias (Dropdown) */}
						{showSuggestions && searchTerm && !selectedClient && (
							<div className="absolute w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-48 overflow-y-auto">
								{filteredClients.length > 0 ? (
									filteredClients.map((client) => (
										<button
											key={client.id}
											onClick={() => handleSelect(client)}
											className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0">
											<div>
												<p className="font-bold text-sm text-gray-800">
													{client.name} {client.surname}
												</p>
												<p className="text-xs text-gray-400">
													{client.phone || "Sin teléfono"}
												</p>
											</div>
											<Check
												size={14}
												className="text-gray-300 opacity-0 group-hover:opacity-100"
											/>
										</button>
									))
								) : (
									<div className="p-3 text-xs text-gray-400 text-center">
										No encontrado. Se registrará como nombre libre.
									</div>
								)}
							</div>
						)}
					</div>

					<div className="flex gap-3">
						<button
							onClick={onClose}
							className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 text-sm">
							Cancelar
						</button>
						<button
							onClick={handleSubmit}
							disabled={!searchTerm}
							className="flex-1 px-4 py-2.5 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed">
							Confirmar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
