import React, { useState } from "react";
import {
	Plus,
	Trash2,
	Edit2,
	Zap,
	X,
	Loader2,
	Beaker,
	TrendingUp,
	Info,
} from "lucide-react";
import { supabase } from "../../services/supabase";

export const TreatmentsTab = ({
	user,
	treatments = [],
	inventory = [],
	showToast,
	onSelectTreatment,
}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTreatment, setEditingTreatment] = useState(null);
	const [loading, setLoading] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		price: "",
		recipe: [], // Array de objetos { materialId: '', quantity: 1 }
	});

	// --- LÓGICA DE CÁLCULO DE COSTES ---
	const calculateCost = (recipe) => {
		return (
			recipe?.reduce((total, item) => {
				const material = inventory.find((m) => m.id === item.materialId);
				return (
					total +
					(material
						? (Number(material.unit_cost) || 0) * Number(item.quantity)
						: 0)
				);
			}, 0) || 0
		);
	};

	// --- LÓGICA: CREAR / EDITAR ---
	const openModal = (t = null) => {
		if (t) {
			setEditingTreatment(t);
			setFormData({ name: t.name, price: t.price, recipe: t.recipe || [] });
		} else {
			setEditingTreatment(null);
			setFormData({ name: "", price: "", recipe: [] });
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const payload = {
				name: formData.name,
				price: Number(formData.price),
				recipe: formData.recipe,
			};

			if (editingTreatment) {
				const { error } = await supabase
					.from("treatments")
					.update(payload)
					.eq("id", editingTreatment.id);
				if (error) throw error;
				showToast("Tratamiento actualizado");
			} else {
				const { error } = await supabase
					.from("treatments")
					.insert([{ ...payload, user_id: user.uid }]);
				if (error) throw error;
				showToast("Tratamiento creado");
			}
			setIsModalOpen(false);
		} catch (error) {
			showToast("Error al guardar", "error");
		} finally {
			setLoading(false);
		}
	};

	// Gestión de Receta (Materiales)
	const addMaterial = () =>
		setFormData({
			...formData,
			recipe: [...formData.recipe, { materialId: "", quantity: 1 }],
		});
	const removeMaterial = (index) =>
		setFormData({
			...formData,
			recipe: formData.recipe.filter((_, i) => i !== index),
		});
	const updateMaterial = (index, field, value) => {
		const newRecipe = [...formData.recipe];
		newRecipe[index][field] = value;
		setFormData({ ...formData, recipe: newRecipe });
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20">
			{/* Cabecera */}
			<div className="flex justify-between items-center">
				<h2 className="text-3xl font-black text-gray-800 tracking-tight italic">
					Tratamientos
				</h2>
				<button
					onClick={() => openModal()}
					className="bg-[#f43f5e] hover:bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-rose-100 transition-all">
					<Plus size={20} /> Nuevo Tratamiento
				</button>
			</div>

			{/* Grid de Tarjetas (Mejorado de image_5e5100.png) */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{treatments.map((t) => {
					const materialCost = calculateCost(t.recipe);
					const profit = Number(t.price) - materialCost;

					return (
						<div
							key={t.id}
							className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-rose-100 transition-all group relative overflow-hidden">
							<div className="flex justify-between items-start mb-4">
								<div className="flex flex-col">
									<h3 className="text-xl font-black text-gray-800 group-hover:text-rose-500 transition-colors">
										{t.name}
									</h3>
									<p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
										{t.recipe?.length || 0} Materiales
									</p>
								</div>
								<div className="flex gap-1">
									<button
										onClick={() => openModal(t)}
										className="p-2 text-gray-300 hover:text-rose-500 transition-colors">
										<Edit2 size={16} />
									</button>
									<button
										onClick={async () => {
											if (confirm("¿Eliminar?"))
												await supabase
													.from("treatments")
													.delete()
													.eq("id", t.id);
										}}
										className="p-2 text-gray-300 hover:text-red-500 transition-colors">
										<Trash2 size={16} />
									</button>
								</div>
							</div>

							<div className="flex items-baseline gap-1 mb-6">
								<span className="text-4xl font-black text-[#f43f5e] tracking-tighter">
									{t.price}€
								</span>
								<span className="text-xs font-bold text-gray-400 uppercase italic">
									PVP
								</span>
							</div>

							{/* Desglose de Rentabilidad (image_5e5100.png style) */}
							<div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-6">
								<div className="flex justify-between text-sm font-bold">
									<span className="text-gray-400">Coste Material</span>
									<span className="text-gray-600">
										{materialCost.toFixed(2)}€
									</span>
								</div>
								<div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
									<span className="text-rose-400">Beneficio</span>
									<span className="text-emerald-500 text-lg">
										+{profit.toFixed(2)}€
									</span>
								</div>
							</div>

							<button
								onClick={() => onSelectTreatment(t)}
								className="w-full bg-[#1e293b] hover:bg-rose-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95">
								<Zap size={18} fill="currentColor" /> Realizar Sesión
							</button>
						</div>
					);
				})}
			</div>

			{/* --- MODAL: NUEVO TRATAMIENTO (Full Height consistente) --- */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-start p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] shadow-2xl flex flex-col h-[calc(100vh-100px)] mt-[0px] animate-in slide-in-from-top-4 duration-300 overflow-hidden">
						{/* Cabecera */}
						<div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
							<h3 className="text-2xl font-black text-gray-800 tracking-tight">
								{editingTreatment ? "Ajustar Tratamiento" : "Nuevo Tratamiento"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-2">
								<X size={24} />
							</button>
						</div>

						{/* Cuerpo (Scrollable) */}
						<div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
							<form
								onSubmit={handleSave}
								className="space-y-8 flex flex-col min-h-full">
								<div className="grid grid-cols-2 gap-4">
									<div className="col-span-2 md:col-span-1">
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
											Nombre del Servicio
										</label>
										<input
											required
											className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-gray-200 focus:bg-white rounded-2xl outline-none font-bold transition-all"
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
										/>
									</div>
									<div className="col-span-2 md:col-span-1">
										<label className="text-[11px] font-black text-[#f43f5e] uppercase tracking-widest mb-2 block">
											PVP Sugerido (€)
										</label>
										<input
											type="number"
											required
											className="w-full p-4 bg-rose-50/30 border-2 border-rose-100 focus:border-rose-200 focus:bg-white rounded-2xl outline-none font-black text-rose-600 text-xl transition-all"
											value={formData.price}
											onChange={(e) =>
												setFormData({ ...formData, price: e.target.value })
											}
										/>
									</div>
								</div>

								{/* Sección de Receta */}
								<div className="space-y-4">
									<div className="flex justify-between items-center">
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
											Materiales Necesarios
										</label>
										<button
											type="button"
											onClick={addMaterial}
											className="text-[#f43f5e] text-xs font-black flex items-center gap-1 hover:scale-105 transition-transform">
											<Plus size={16} /> Añadir Material
										</button>
									</div>

									{formData.recipe.length === 0 ? (
										<div className="p-8 border-2 border-dashed border-gray-100 rounded-[2rem] text-center text-gray-400">
											<Beaker className="mx-auto mb-2 opacity-20" size={32} />
											<p className="text-xs font-bold">
												No has añadido materiales todavía.
											</p>
										</div>
									) : (
										<div className="space-y-3">
											{formData.recipe.map((item, index) => (
												<div
													key={index}
													className="flex gap-3 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 animate-in fade-in">
													<select
														className="flex-1 p-2 bg-transparent text-sm font-bold outline-none"
														value={item.materialId}
														onChange={(e) =>
															updateMaterial(
																index,
																"materialId",
																e.target.value
															)
														}
														required>
														<option value="">Seleccionar material...</option>
														{inventory.map((inv) => (
															<option key={inv.id} value={inv.id}>
																{inv.name} ({inv.unit || "uds"})
															</option>
														))}
													</select>
													<input
														type="number"
														step="0.1"
														className="w-20 p-2 bg-white border border-gray-200 rounded-xl text-center font-black text-rose-500"
														value={item.quantity}
														onChange={(e) =>
															updateMaterial(index, "quantity", e.target.value)
														}
														required
													/>
													<button
														type="button"
														onClick={() => removeMaterial(index)}
														className="text-gray-300 hover:text-red-500 p-1">
														<X size={18} />
													</button>
												</div>
											))}
										</div>
									)}
								</div>

								{/* Dashboard de Beneficio en el Modal */}
								<div className="mt-auto bg-[#1e293b] rounded-[2rem] p-6 text-white shadow-xl">
									<div className="flex justify-between items-center mb-4">
										<div className="flex items-center gap-2">
											<TrendingUp className="text-emerald-400" size={20} />
											<span className="text-xs font-black uppercase tracking-widest text-gray-400">
												Análisis de Beneficio
											</span>
										</div>
										<Info size={14} className="text-gray-500" />
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
												Margen
											</p>
											<p className="text-2xl font-black text-emerald-400">
												{(
													Number(formData.price) -
														calculateCost(formData.recipe) || 0
												).toFixed(2)}
												€
											</p>
										</div>
										<div className="text-right">
											<p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
												ROI Est.
											</p>
											<p className="text-2xl font-black text-blue-400">
												{formData.price > 0
													? (
															((Number(formData.price) -
																calculateCost(formData.recipe)) /
																Number(formData.price)) *
															100
													  ).toFixed(0)
													: 0}
												%
											</p>
										</div>
									</div>
									<button
										disabled={loading}
										className="w-full bg-[#f43f5e] hover:bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all mt-6 text-lg flex justify-center">
										{loading ? (
											<Loader2 className="animate-spin" />
										) : (
											"Confirmar Tratamiento"
										)}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
