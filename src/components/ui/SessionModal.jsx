import React, { useState, useEffect } from "react";
import {
	X,
	Calendar,
	User,
	Search,
	Euro,
	Tag,
	Plus,
	Trash2,
} from "lucide-react";

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
	const [selectedDate, setSelectedDate] = useState(
		new Date().toISOString().split("T")[0]
	);

	// NUEVO: Estado para materiales extra
	const [extras, setExtras] = useState([]);
	// Receta activa editable (permite eliminar ingredientes por sesión)
	const [activeRecipe, setActiveRecipe] = useState([]);

	useEffect(() => {
		if (isOpen && treatment) {
			setFinalPrice(treatment.price);
			setSelectedClient(null);
			setSearchTerm("");
			setSelectedDate(new Date().toISOString().split("T")[0]);
			setExtras([]);
			setActiveRecipe(treatment.recipe ? [...treatment.recipe] : []);
		}
	}, [isOpen, treatment]);

	if (!isOpen || !treatment) return null;

	const filteredClients = clients.filter((c) =>
		`${c.name} ${c.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
	);

	// Funciones para gestionar extras
	const addExtra = () => {
		setExtras([...extras, { materialId: "", quantity: 1 }]);
	};

	const updateExtra = (index, field, value) => {
		const newExtras = [...extras];
		newExtras[index][field] = value;
		setExtras(newExtras);
	};

	const removeExtra = (index) => {
		const newExtras = extras.filter((_, i) => i !== index);
		setExtras(newExtras);
	};

	const removeFromRecipe = (index) => {
		setActiveRecipe((prev) => prev.filter((_, i) => i !== index));
	};

	const handleConfirm = () => {
		if (!selectedClient) return;
		// Pasamos treatment con receta filtrada (solo lo que queda en activeRecipe)
		onConfirm(
			{ ...treatment, recipe: activeRecipe },
			selectedClient,
			Number(finalPrice),
			selectedDate,
			extras
		);
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

					{/* 2. FECHA Y PRECIO */}
					<div className="grid grid-cols-2 gap-4">
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

					{/* 3. MATERIALES (Receta + Extras) */}
					<div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
						<div className="flex justify-between items-center">
							<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
								Consumo de Material
							</p>
							<button
								onClick={addExtra}
								className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors">
								<Plus size={12} /> Añadir Extra
							</button>
						</div>

						{/* Lista de Receta Standard (editable por sesión) */}
						{activeRecipe.length > 0 && (
							<div className="space-y-2">
								{activeRecipe.map((item, idx) => {
									const materialName =
										inventory?.find((i) => i.id === item.materialId)?.name ||
										"Material desconocido";
									return (
										<div
											key={`recipe-${idx}`}
											className="flex justify-between items-center text-xs font-bold text-gray-600 pl-2 border-l-2 border-gray-200 gap-2">
											<div className="flex-1 min-w-0">
												<span>{materialName}</span>
												<span className="text-gray-400 ml-1">x{item.quantity}</span>
											</div>
											<button
												type="button"
												onClick={() => removeFromRecipe(idx)}
												className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
												title="Eliminar de esta sesión">
												<Trash2 size={14} />
											</button>
										</div>
									);
								})}
							</div>
						)}

						{/* Lista de Extras */}
						{extras.length > 0 && (
							<div className="space-y-2 pt-2 border-t border-dashed border-gray-200">
								<p className="text-[10px] font-bold text-rose-400 italic">
									Adicionales:
								</p>
								{extras.map((extra, idx) => (
									<div
										key={`extra-${idx}`}
										className="flex gap-2 items-center animate-in slide-in-from-left-2">
										<select
											className="flex-1 bg-white text-xs font-bold p-2 rounded-lg border border-gray-200 outline-none focus:border-rose-300"
											value={extra.materialId}
											onChange={(e) =>
												updateExtra(idx, "materialId", e.target.value)
											}>
											<option value="">Seleccionar...</option>
											{inventory.map((inv) => (
												<option key={inv.id} value={inv.id}>
													{inv.name}
												</option>
											))}
										</select>
										<input
											type="number"
											step="0.1"
											className="w-14 p-2 bg-white rounded-lg border border-gray-200 text-center font-bold text-xs outline-none focus:border-rose-300"
											value={extra.quantity}
											onChange={(e) =>
												updateExtra(idx, "quantity", e.target.value)
											}
										/>
										<button
											onClick={() => removeExtra(idx)}
											className="text-gray-400 hover:text-red-500">
											<Trash2 size={14} />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
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
