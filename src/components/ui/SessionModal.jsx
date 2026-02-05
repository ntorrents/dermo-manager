import React, { useState, useEffect } from "react";
import { X, Calendar, User, Search, Euro, Tag } from "lucide-react";

export const SessionModal = ({
	isOpen,
	treatment,
	clients,
	inventory,
	onClose,
	onConfirm,
}) => {
	const [selectedClient, setSelectedClient] = useState(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [finalPrice, setFinalPrice] = useState("");
	// NUEVO: Estado para la fecha
	const [selectedDate, setSelectedDate] = useState(
		new Date().toISOString().split("T")[0]
	);

	useEffect(() => {
		if (isOpen && treatment) {
			setFinalPrice(treatment.price);
			setSelectedClient(null);
			setSearchTerm("");
			// Reseteamos la fecha a HOY cada vez que se abre
			setSelectedDate(new Date().toISOString().split("T")[0]);
		}
	}, [isOpen, treatment]);

	if (!isOpen || !treatment) return null;

	const filteredClients = clients.filter((c) =>
		`${c.name} ${c.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const handleConfirm = () => {
		if (!selectedClient) return;
		// AHORA enviamos también selectedDate
		onConfirm(treatment, selectedClient, Number(finalPrice), selectedDate);
	};

	return (
		<div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
				onClick={onClose}
			/>
			<div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
				<div className="p-8 border-b bg-gray-50 flex justify-between items-start">
					<div>
						<h3 className="text-2xl font-black text-gray-800 tracking-tight leading-none">
							Nueva Sesión
						</h3>
						<p className="text-rose-500 font-bold mt-2 text-lg">
							{treatment.name}
						</p>
					</div>
					<button
						onClick={onClose}
						className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100 transition-colors">
						<X size={20} />
					</button>
				</div>

				<div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
					{/* 1. SELECCIÓN DE CLIENTE */}
					<div className="space-y-3">
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
							<User size={14} /> Seleccionar Cliente
						</label>

						{!selectedClient ? (
							<div className="relative group">
								<Search
									className="absolute left-4 top-4 text-gray-400 group-focus-within:text-rose-500 transition-colors"
									size={20}
								/>
								<input
									autoFocus
									className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all placeholder:text-gray-300"
									placeholder="Buscar por nombre..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>

								{searchTerm && (
									<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-20">
										{filteredClients.length > 0 ? (
											filteredClients.map((client) => (
												<button
													key={client.id}
													onClick={() => {
														setSelectedClient(client);
														setSearchTerm("");
													}}
													className="w-full text-left p-4 hover:bg-rose-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0">
													<div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xs">
														{client.name[0]}
													</div>
													<div>
														<p className="font-bold text-gray-800 text-sm">
															{client.name} {client.surname}
														</p>
													</div>
												</button>
											))
										) : (
											<div className="p-4 text-center text-gray-400 text-xs font-bold">
												No se encontraron clientes.
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-white text-rose-500 flex items-center justify-center font-black shadow-sm">
										{selectedClient.name[0]}
									</div>
									<div>
										<p className="font-bold text-gray-900 leading-tight">
											{selectedClient.name} {selectedClient.surname}
										</p>
										<p className="text-xs text-rose-400 font-bold mt-0.5">
											Cliente seleccionado
										</p>
									</div>
								</div>
								<button
									onClick={() => setSelectedClient(null)}
									className="text-xs font-black bg-white text-gray-400 hover:text-rose-500 px-3 py-2 rounded-lg border border-gray-100 transition-colors">
									CAMBIAR
								</button>
							</div>
						)}
					</div>

					{/* 2. FECHA Y PRECIO (Grid de 2 columnas) */}
					<div className="grid grid-cols-2 gap-4">
						{/* FECHA (NUEVO) */}
						<div className="space-y-3">
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
								<Calendar size={14} /> Fecha
							</label>
							<input
								type="date"
								required
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all text-sm"
							/>
						</div>

						{/* PRECIO */}
						<div className="space-y-3">
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
								<Tag size={14} /> Precio (€)
							</label>
							<div className="relative">
								<Euro
									className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
									size={18}
								/>
								<input
									type="number"
									step="0.01"
									className="w-full pl-10 p-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl outline-none font-black text-xl text-gray-800 transition-all"
									value={finalPrice}
									onChange={(e) => setFinalPrice(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{/* 3. RESUMEN MATERIALES */}
					{treatment.recipe?.length > 0 && (
						<div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
							<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
								Material a consumir
							</p>
							<div className="space-y-2">
								{treatment.recipe.map((item, idx) => {
									const materialName =
										inventory?.find((i) => i.id === item.materialId)?.name ||
										"Material desconocido";

									return (
										<div
											key={idx}
											className="flex justify-between text-xs font-bold text-gray-600">
											<span>{materialName}</span>
											<span className="bg-white px-2 py-0.5 rounded-md border border-gray-100">
												x{item.quantity}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				<div className="p-8 border-t bg-gray-50">
					<button
						disabled={!selectedClient || !finalPrice}
						onClick={handleConfirm}
						className="w-full bg-[#1e293b] hover:bg-black text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
						<Calendar size={20} className="text-rose-500" />
						Confirmar Sesión
					</button>
				</div>
			</div>
		</div>
	);
};
