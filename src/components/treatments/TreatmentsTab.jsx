import React, { useState } from "react";
import { Plus, Trash2, Edit2, Zap, X, Loader2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { ConfirmModal } from "../ui/ConfirmModal";

export const TreatmentsTab = ({
	user,
	treatments = [],
	inventory = [],
	showToast,
	onSelectTreatment,
	onRefresh,
}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTreatment, setEditingTreatment] = useState(null);
	const [loading, setLoading] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [treatmentToDelete, setTreatmentToDelete] = useState(null);
	const [formData, setFormData] = useState({ name: "", price: "", recipe: [], internal_notes: "" });

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

	const openModal = (t = null) => {
		if (t) {
			setEditingTreatment(t);
			setFormData({ name: t.name, price: t.price, recipe: t.recipe || [], internal_notes: t.internal_notes || "" });
		} else {
			setEditingTreatment(null);
			setFormData({ name: "", price: "", recipe: [], internal_notes: "" });
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
				internal_notes: formData.internal_notes || null,
				user_id: user.id,
			};
			if (editingTreatment) {
				const { error } = await supabase
					.from("treatments")
					.update(payload)
					.eq("id", editingTreatment.id);
				if (error) throw error;
				showToast("Tratamiento actualizado");
			} else {
				const { error } = await supabase.from("treatments").insert([payload]);
				if (error) throw error;
				showToast("Tratamiento creado");
			}
			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (error) {
			showToast("Error al guardar", "error");
		} finally {
			setLoading(false);
		}
	};

	const updateMaterial = (index, field, value) => {
		const newRecipe = [...formData.recipe];
		newRecipe[index][field] = value;
		setFormData({ ...formData, recipe: newRecipe });
	};

	const confirmDeleteTreatment = async () => {
		if (!treatmentToDelete) return;
		try {
			await supabase
				.from("treatments")
				.delete()
				.eq("id", treatmentToDelete.id);
			showToast("Tratamiento eliminado");
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al eliminar", "error");
		} finally {
			setShowDeleteModal(false);
			setTreatmentToDelete(null);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 xl:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Tratamiento"
				message={`¿Borrar "${treatmentToDelete?.name}"?`}
				onConfirm={confirmDeleteTreatment}
				onCancel={() => {
					setShowDeleteModal(false);
					setTreatmentToDelete(null);
				}}
				isDestructive={true}
			/>
			{/* HEADER: Fix choque de titulo y botón */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h2 className="text-2xl xl:text-3xl font-black text-gray-800 tracking-tight italic">
					Tratamientos
				</h2>
				<button
					onClick={() => openModal()}
					className="bg-[#f43f5e] hover:bg-rose-600 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all w-full sm:w-auto justify-center">
					<Plus size={18} /> Nuevo Tratamiento
				</button>
			</div>

			{/* GRID: Tarjetas más compactas */}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
				{treatments.map((t) => {
					const materialCost = calculateCost(t.recipe);
					const profit = Number(t.price) - materialCost;

					return (
						<div
							key={t.id}
							className="bg-white p-5 xl:p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
							<div className="flex justify-between items-start mb-3">
								<h3 className="font-black text-lg xl:text-xl text-gray-800 group-hover:text-rose-500 transition-colors leading-tight">
									{t.name}
								</h3>
								<div className="flex gap-1">
									<button
										onClick={() => openModal(t)}
										className="p-2 text-gray-300 hover:text-blue-500"
										title="Editar tratamiento">
										<Edit2 size={16} />
									</button>
									<button
										onClick={() => {
											setTreatmentToDelete(t);
											setShowDeleteModal(true);
										}}
										className="p-2 text-gray-300 hover:text-red-500"
										title="Eliminar tratamiento">
										<Trash2 size={16} />
									</button>
								</div>
							</div>

							<div className="flex items-baseline gap-1 mb-4">
								<span className="text-3xl xl:text-4xl font-black text-[#f43f5e] tracking-tighter">
									{t.price}€
								</span>
								<span className="text-[9px] font-bold text-gray-400 uppercase italic">
									PVP
								</span>
							</div>

							<div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-6 text-xs xl:text-sm">
								<div className="flex justify-between font-bold">
									<span className="text-gray-400 uppercase tracking-tighter">
										Coste Mat.
									</span>
									<span className="text-gray-600">
										{materialCost.toFixed(2)}€
									</span>
								</div>
								<div className="flex justify-between font-bold border-t border-gray-200 pt-2">
									<span className="text-rose-400 uppercase tracking-tighter">
										Beneficio
									</span>
									<span className="text-emerald-500 text-base xl:text-lg">
										+{profit.toFixed(2)}€
									</span>
								</div>
							</div>

							<button
								onClick={() => onSelectTreatment(t)}
								className="w-full mt-auto bg-[#1e293b] hover:bg-rose-500 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
								<Zap size={16} fill="currentColor" /> Realizar Sesión
							</button>
						</div>
					);
				})}
			</div>

			{/* MODAL: Reutilizado con mejoras de scroll móvil */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-start p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-lg rounded-t-2xl xl:rounded-[2.5rem] shadow-2xl flex flex-col h-[calc(100vh-120px)] mt-auto xl:mt-20 overflow-hidden animate-in slide-in-from-bottom-4 xl:zoom-in-95">
						<div className="p-6 border-b bg-gray-50 flex justify-between items-center">
							<h3 className="text-xl font-black text-gray-800">
								{editingTreatment ? "Editar" : "Nuevo"} Tratamiento
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="text-gray-400">
								<X size={24} />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
							<form onSubmit={handleSave} className="space-y-6">
								<input
									required
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									placeholder="Nombre del Servicio"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
								/>
								<div className="flex flex-col gap-1">
									<label className="text-[10px] font-black text-rose-500 uppercase ml-2">
										Precio PVP (€)
									</label>
									<input
										type="number"
										required
										className="w-full p-4 bg-rose-50/30 border-2 border-rose-100 rounded-2xl font-black text-rose-600 text-xl"
										value={formData.price}
										onChange={(e) =>
											setFormData({ ...formData, price: e.target.value })
										}
									/>
								</div>

								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">
										Notas Internas
									</label>
									<textarea
										rows={3}
										placeholder="Notas solo para ti (no afectan precios ni recetas)"
										className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-medium text-sm resize-none"
										value={formData.internal_notes}
										onChange={(e) =>
											setFormData({ ...formData, internal_notes: e.target.value })
										}
									/>
								</div>

								<div className="space-y-3">
									<div className="flex justify-between items-center">
										<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
											Materiales
										</label>
										<button
											type="button"
											onClick={() =>
												setFormData({
													...formData,
													recipe: [
														...formData.recipe,
														{ materialId: "", quantity: 1 },
													],
												})
											}
											className="text-[#f43f5e] text-[10px] font-black uppercase">
											+ Añadir
										</button>
									</div>
									<div className="space-y-2">
										{formData.recipe.map((item, index) => (
											<div
												key={index}
												className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
												<select
													className="flex-1 bg-transparent text-xs font-bold outline-none"
													value={item.materialId}
													onChange={(e) =>
														updateMaterial(index, "materialId", e.target.value)
													}
													required>
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
													className="w-16 p-2 bg-white rounded-lg text-center font-black text-rose-500 text-sm"
													value={item.quantity}
													onChange={(e) =>
														updateMaterial(index, "quantity", e.target.value)
													}
													required
												/>
												<button
													type="button"
													onClick={() =>
														setFormData({
															...formData,
															recipe: formData.recipe.filter(
																(_, i) => i !== index
															),
														})
													}
													className="text-gray-300 hover:text-red-500">
													<X size={16} />
												</button>
											</div>
										))}
									</div>
								</div>

								<div className="mt-6 bg-[#1e293b] rounded-[2rem] p-6 text-white shadow-xl">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-[10px] font-bold text-gray-400 uppercase">
												Beneficio
											</p>
											<p className="text-xl font-black text-emerald-400">
												{(
													Number(formData.price) -
													calculateCost(formData.recipe)
												).toFixed(2)}
												€
											</p>
										</div>
										<div className="text-right">
											<p className="text-[10px] font-bold text-gray-400 uppercase">
												ROI Est.
											</p>
											<p className="text-xl font-black text-blue-400">
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
										className="w-full bg-[#f43f5e] text-white font-black py-4 rounded-xl mt-6 shadow-lg">
										Confirmar
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
