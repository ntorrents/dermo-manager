import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, Zap, X, FolderOpen } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useTreatmentGroups } from "../../hooks/useTreatmentGroups";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { useTenant } from "../../context/TenantContext";

const UNGROUPED_KEY = "__ungrouped__";

export const TreatmentsTab = ({
	user,
	treatments = [],
	inventory = [],
	showToast,
	onSelectTreatment,
	onRefresh,
}) => {
	const { canDeleteOperational } = useTenant();
	const { groups, create: createGroup, update: updateGroup, delete: deleteGroup, isCreating: isCreatingGroup } = useTreatmentGroups(user);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTreatment, setEditingTreatment] = useState(null);
	const [loading, setLoading] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [treatmentToDelete, setTreatmentToDelete] = useState(null);
	const [formData, setFormData] = useState({ name: "", price: "", recipe: [], internal_notes: "", group_id: "" });

	const [showGroupsModal, setShowGroupsModal] = useState(false);
	const [groupFormName, setGroupFormName] = useState("");
	const [editingGroup, setEditingGroup] = useState(null);
	const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
	const [groupToDelete, setGroupToDelete] = useState(null);

	// Agrupar tratamientos: por group_id (y Sin grupo al final), ordenados por nombre dentro de cada grupo
	const treatmentsByGroup = useMemo(() => {
		const byGroup = {};
		const sortedGroups = [...groups].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || "").localeCompare(b.name || ""));
		sortedGroups.forEach((g) => { byGroup[g.id] = []; });
		byGroup[UNGROUPED_KEY] = [];
		treatments.forEach((t) => {
			const key = t.group_id || UNGROUPED_KEY;
			if (!byGroup[key]) byGroup[key] = [];
			byGroup[key].push(t);
		});
		Object.keys(byGroup).forEach((k) => byGroup[k].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
		return { byGroup, sortedGroups };
	}, [treatments, groups]);

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
			setFormData({ name: t.name, price: t.price, recipe: t.recipe || [], internal_notes: t.internal_notes || "", group_id: t.group_id || "" });
		} else {
			setEditingTreatment(null);
			setFormData({ name: "", price: "", recipe: [], internal_notes: "", group_id: "" });
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
				group_id: formData.group_id || null,
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
				const { error } = await supabase
					.from("treatments")
					.insert([{ ...payload, activo: true }]);
				if (error) throw error;
				showToast("Tratamiento creado");
			}
			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al guardar", "error");
		} finally {
			setLoading(false);
		}
	};

	const openGroupsModal = () => {
		setGroupFormName("");
		setEditingGroup(null);
		setShowGroupsModal(true);
	};

	const handleSaveGroup = async (e) => {
		e.preventDefault();
		const name = groupFormName.trim();
		if (!name) return;
		try {
			if (editingGroup) {
				await updateGroup({ id: editingGroup.id, name });
				showToast("Grupo actualizado");
			} else {
				await createGroup({ name, sort_order: groups.length });
				showToast("Grupo creado");
			}
			setGroupFormName("");
			setEditingGroup(null);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error", "error");
		}
	};

	const confirmDeleteGroup = async () => {
		if (!groupToDelete) return;
		try {
			await deleteGroup(groupToDelete.id);
			showToast("Grupo eliminado (tratamientos sin grupo)");
			setShowDeleteGroupModal(false);
			setShowGroupsModal(false);
			setGroupToDelete(null);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error", "error");
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
				.update({ activo: false })
				.eq("id", treatmentToDelete.id);
			showToast("Tratamiento archivado");
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al eliminar", "error");
		} finally {
			setShowDeleteModal(false);
			setTreatmentToDelete(null);
		}
	};

	// Tarjeta compacta por tratamiento (dentro de cada grupo)
	const renderTreatmentCard = (t) => {
		const materialCost = calculateCost(t.recipe);
		const profit = Number(t.price) - materialCost;
		return (
			<div
				key={t.id}
				className="bg-gray-50/50 hover:bg-rose-50/30 p-3 rounded-xl border border-gray-100 hover:border-rose-100 transition-all flex flex-col group">
				<div className="flex justify-between items-start gap-1 mb-1.5">
					<h3 className="font-bold text-sm text-gray-800 group-hover:text-rose-600 transition-colors leading-tight line-clamp-2">
						{t.name}
					</h3>
					<div className="flex gap-0.5 shrink-0">
						<button
							type="button"
							onClick={() => openModal(t)}
							className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg"
							title="Editar">
							<Edit2 size={14} />
						</button>
						{canDeleteOperational && (
							<button
								type="button"
								onClick={() => { setTreatmentToDelete(t); setShowDeleteModal(true); }}
								className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg"
								title="Eliminar">
								<Trash2 size={14} />
							</button>
						)}
					</div>
				</div>
				<div className="flex items-baseline gap-1 mb-2">
					<span className="text-xl font-black text-primary tracking-tight">{t.price}€</span>
					<span className="text-[8px] font-bold text-gray-400 uppercase">PVP</span>
				</div>
				<div className="text-[10px] space-y-0.5 mb-2 text-gray-500">
					<div className="flex justify-between">
						<span>Coste est.</span>
						<span className="font-medium text-gray-600">{materialCost.toFixed(2)} €</span>
					</div>
					<div className="flex justify-between font-semibold text-emerald-600">
						<span>Beneficio</span>
						<span>+{profit.toFixed(2)} €</span>
					</div>
				</div>
				<button
					type="button"
					onClick={() => onSelectTreatment(t)}
					className="w-full mt-auto bg-surface-dark hover:bg-primary text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-sm transition-all active:scale-[0.98]">
					<Zap size={12} fill="currentColor" /> Sesión
				</button>
			</div>
		);
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Archivar tratamiento"
				message={`¿Archivar "${treatmentToDelete?.name}"? Dejará de mostrarse en listas y sesiones nuevas.`}
				onConfirm={confirmDeleteTreatment}
				onCancel={() => { setShowDeleteModal(false); setTreatmentToDelete(null); }}
				isDestructive
			/>
			<ConfirmModal
				isOpen={showDeleteGroupModal}
				title="Eliminar grupo"
				message={`¿Eliminar el grupo "${groupToDelete?.name}"? Los tratamientos quedarán sin grupo.`}
				onConfirm={confirmDeleteGroup}
				onCancel={() => { setShowDeleteGroupModal(false); setGroupToDelete(null); }}
				isDestructive
			/>
			{/* HEADER */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h2 className="text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight">
					Tratamientos
				</h2>
				<div className="flex flex-wrap gap-2 w-full sm:w-auto">
					<button
						type="button"
						onClick={openGroupsModal}
						className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors">
						<FolderOpen size={16} /> Grupos
					</button>
					<button
						type="button"
						onClick={() => openModal()}
						className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors">
						<Plus size={18} /> Nuevo tratamiento
					</button>
				</div>
			</div>

			{/* CONTENIDO: por grupos o lista vacía */}
			{treatments.length === 0 ? (
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
					<EmptyState
						icon={Zap}
						title="No hay tratamientos"
						description="Crea tu primer servicio para poder registrar sesiones y facturar."
						actionLabel="Crear tratamiento"
						onAction={() => openModal()}
					/>
				</div>
			) : (
				<div className="space-y-6">
					{/* Grupos ordenados + Sin grupo al final */}
					{treatmentsByGroup.sortedGroups.map((gr) => {
						const list = treatmentsByGroup.byGroup[gr.id] || [];
						if (list.length === 0) return null;
						return (
							<div key={gr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
								<div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
									<FolderOpen size={16} className="text-rose-500" />
									<span className="font-black text-sm text-gray-800 uppercase tracking-wide">{gr.name}</span>
									<span className="text-xs text-gray-400 font-medium">({list.length})</span>
								</div>
								<div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
									{list.map((t) => renderTreatmentCard(t))}
								</div>
							</div>
						);
					})}
					{/* Sin grupo */}
					{(treatmentsByGroup.byGroup[UNGROUPED_KEY]?.length ?? 0) > 0 && (
						<div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
							<div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2">
								<span className="font-bold text-xs text-gray-500 uppercase tracking-wide">Sin grupo</span>
								<span className="text-xs text-gray-400">({treatmentsByGroup.byGroup[UNGROUPED_KEY].length})</span>
							</div>
							<div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
								{treatmentsByGroup.byGroup[UNGROUPED_KEY].map((t) => renderTreatmentCard(t))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Modal: Gestionar grupos */}
			<AdaptiveModal
				isOpen={showGroupsModal}
				onClose={() => setShowGroupsModal(false)}
				title="Grupos de tratamientos"
				maxWidth="max-w-md">
				<p className="text-sm text-gray-500 mb-4">
					Agrupa tratamientos (ej. Mesoterapia) para encontrarlos más rápido. Asigna el grupo al crear o editar cada tratamiento.
				</p>
				<form onSubmit={handleSaveGroup} className="flex gap-2 mb-6">
					<input
						className="flex-1 p-3 bg-gray-50 rounded-xl font-medium outline-none border border-gray-100 focus:border-rose-200"
						placeholder="Nombre del grupo"
						value={groupFormName}
						onChange={(e) => setGroupFormName(e.target.value)}
					/>
					<LoadingButton
						loading={isCreatingGroup}
						type="submit"
						className="bg-rose-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap">
						{editingGroup ? "Guardar" : "Añadir"}
					</LoadingButton>
				</form>
				{editingGroup && (
					<button
						type="button"
						onClick={() => { setEditingGroup(null); setGroupFormName(""); }}
						className="text-xs text-gray-500 hover:text-gray-700 mb-2">
						Cancelar edición
					</button>
				)}
				<div className="space-y-2 max-h-60 overflow-y-auto">
					{groups.length === 0 ? (
						<p className="text-sm text-gray-400 py-4">No hay grupos. Crea uno arriba.</p>
					) : (
						groups.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || "").localeCompare(b.name || "")).map((g) => (
							<div
								key={g.id}
								className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
								<span className="font-bold text-gray-800">{g.name}</span>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => { setEditingGroup(g); setGroupFormName(g.name); }}
										className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg"
										title="Editar grupo">
										<Edit2 size={14} />
									</button>
									{canDeleteOperational && (
										<button
											type="button"
											onClick={() => { setGroupToDelete(g); setShowDeleteGroupModal(true); }}
											className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
											title="Eliminar grupo">
											<Trash2 size={14} />
										</button>
									)}
								</div>
							</div>
						))
					)}
				</div>
			</AdaptiveModal>

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={editingTreatment ? "Editar" : "Nuevo Tratamiento"}
				maxWidth="max-w-lg">
				<form onSubmit={handleSave} className="space-y-6">
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Nombre</label>
									<input
										required
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
										placeholder="Nombre del Servicio"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									/>
								</div>
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Grupo</label>
									<select
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100"
										value={formData.group_id}
										onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}>
										<option value="">Sin grupo</option>
										{groups.map((g) => (
											<option key={g.id} value={g.id}>{g.name}</option>
										))}
									</select>
								</div>
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
											className="text-primary text-[10px] font-black uppercase">
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
															{(inv.item_type || "material") === "maquina" ? " (Máquina)" : ""}
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

								<div className="mt-6 bg-surface-dark rounded-[2rem] p-6 text-white shadow-xl">
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
									<LoadingButton
										loading={loading}
										type="submit"
										className="w-full bg-primary text-white font-black py-4 rounded-xl mt-6 shadow-lg">
										Confirmar
									</LoadingButton>
								</div>
							</form>
			</AdaptiveModal>
		</div>
	);
};
