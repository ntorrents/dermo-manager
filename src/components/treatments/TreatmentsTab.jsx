import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, Zap, X, FolderOpen, LayoutGrid, List as ListIcon } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useTreatmentGroups } from "../../hooks/useTreatmentGroups";
import { useColumnPreferences } from "../../hooks/useColumnPreferences";
import { ConfirmModal } from "../ui/ConfirmModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { SidePanel } from "../ui/SidePanel";
import {
	FormSheet,
	FormSheetPrimary,
	FormSheetPreview,
	FormPreviewStat,
	FormDetails,
} from "../ui/FormSheet";
import { useTenant } from "../../context/TenantContext";
import { IVA_OPTIONS } from "../../utils/format";
import { taxRateLabel } from "../../utils/incomeTax";

const UNGROUPED_KEY = "__ungrouped__";

const TREATMENT_COLUMNS = [
	{ id: "name", label: "Tratamiento", required: true },
	{ id: "notes", label: "Notas" },
	{ id: "price", label: "Precio PVP" },
	{ id: "profit", label: "Beneficio Neto" },
	{ id: "acciones", label: "Acciones", required: true },
];

export const TreatmentsTab = ({
	user,
	treatments = [],
	inventory = [],
	showToast,
	onSelectTreatment,
	onRefresh,
}) => {
	const { canDeleteOperational, clinicId } = useTenant();
	const { groups, create: createGroup, update: updateGroup, delete: deleteGroup, isCreating: isCreatingGroup } = useTreatmentGroups(user);
	const { isVisible: isTreatColVisible, toggle: toggleTreatCol } =
		useColumnPreferences("c3linic_treatments_columns", TREATMENT_COLUMNS);

	const [viewMode, setViewMode] = useState("grid");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTreatment, setEditingTreatment] = useState(null);
	const [loading, setLoading] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [treatmentToDelete, setTreatmentToDelete] = useState(null);
	const [formData, setFormData] = useState({
		name: "",
		price: "",
		tax_rate: 21,
		recipe: [],
		internal_notes: "",
		group_id: "",
	});

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
		if (!recipe || recipe.length === 0) return 0;
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

	const renderTreatmentTableRow = (t) => {
		const materialCost = calculateCost(t.recipe);
		const profit = Number(t.price) - materialCost;
		const profitMargin = t.price > 0 ? (profit / Number(t.price)) * 100 : 0;
		return (
			<tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
				{isTreatColVisible("name") && (
				<td className="p-3">
					<p className="font-medium text-slate-900 text-sm leading-tight">{t.name}</p>
				</td>
				)}
				{isTreatColVisible("notes") && (
				<td className="p-3 text-sm font-medium text-slate-500 hidden sm:table-cell">
					{t.internal_notes ? <span className="truncate max-w-[8rem] inline-block" title={t.internal_notes}>{t.internal_notes}</span> : <span className="text-slate-300">—</span>}
				</td>
				)}
				{isTreatColVisible("price") && (
				<td className="p-3">
					<span className="text-sm font-medium text-slate-900 tabular-nums">{Number(t.price).toFixed(2)} €</span>
				</td>
				)}
				{isTreatColVisible("profit") && (
				<td className="p-3">
					<div className="flex flex-col">
						<span className="text-sm font-medium text-emerald-700 tabular-nums">+{profit.toFixed(2)} € ({profitMargin.toFixed(0)}%)</span>
						<span className="text-[11px] text-slate-400 tabular-nums">Coste: {materialCost.toFixed(2)} €</span>
					</div>
				</td>
				)}
				{isTreatColVisible("acciones") && (
				<td className="p-3 text-right">
					<div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<button type="button" onClick={() => onSelectTreatment(t)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Nueva Sesión"><Zap size={16} /></button>
						<button type="button" onClick={() => openModal(t)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Editar"><Edit2 size={16} /></button>
						{canDeleteOperational && (
							<button type="button" onClick={() => { setTreatmentToDelete(t); setShowDeleteModal(true); }} className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
						)}
					</div>
				</td>
				)}
			</tr>
		);
	};

	const openModal = (t = null) => {
		if (t) {
			setEditingTreatment(t);
			setFormData({
				name: t.name,
				price: t.price,
				tax_rate: t.tax_rate != null ? Number(t.tax_rate) : 21,
				recipe: t.recipe || [],
				internal_notes: t.internal_notes || "",
				group_id: t.group_id || "",
			});
		} else {
			setEditingTreatment(null);
			setFormData({
				name: "",
				price: "",
				tax_rate: 21,
				recipe: [],
				internal_notes: "",
				group_id: "",
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		if (!clinicId) {
			showToast("No hay clínica activa", "error");
			return;
		}
		setLoading(true);
		try {
			const payload = {
				name: formData.name,
				price: Number(formData.price),
				tax_rate: Number(formData.tax_rate) ?? 21,
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
					.insert([{ ...payload, clinic_id: clinicId, activo: true }]);
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
		const recipeSummary = (t.recipe || [])
			.map((r) => {
				const inv = inventory.find((i) => i.id === r.materialId);
				if (!inv) return null;
				const unit = inv.unit_consumption || inv.unit || "uds";
				return `${inv.name} ${r.quantity}${unit}`;
			})
			.filter(Boolean)
			.slice(0, 2)
			.join(" · ");
		return (
			<div
				key={t.id}
				className="bg-white hover:bg-slate-50/80 p-3 rounded-xl border border-slate-100 transition-all flex flex-col group shadow-sm">
				<div className="flex justify-between items-start gap-1 mb-1.5">
					<h3 className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">
						{t.name}
					</h3>
					<div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							type="button"
							onClick={() => openModal(t)}
							className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
							title="Editar">
							<Edit2 size={14} />
						</button>
						{canDeleteOperational && (
							<button
								type="button"
								onClick={() => { setTreatmentToDelete(t); setShowDeleteModal(true); }}
								className="p-1.5 text-slate-400 hover:text-rose-700 rounded-lg"
								title="Eliminar">
								<Trash2 size={14} />
							</button>
						)}
					</div>
				</div>
				<div className="flex items-baseline gap-1 mb-2">
					<span className="text-lg font-semibold text-slate-900 tracking-tight tabular-nums">{t.price}€</span>
					<span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">PVP</span>
				</div>
				<div className="text-[10px] space-y-0.5 mb-2 text-gray-500">
					{recipeSummary && <div className="truncate">{recipeSummary}</div>}
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
					className="w-full mt-auto btn-primary py-2 flex items-center justify-center gap-1.5 text-xs">
					<Zap size={12} fill="currentColor" /> Sesión
				</button>
			</div>
		);
	};


	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar tratamiento"
				message={`Estás a punto de archivar "${treatmentToDelete?.name || "este tratamiento"}".\n\nDejará de mostrarse en listados y en nuevas sesiones. El historial de sesiones previas se conserva, pero no podrás recuperarlo fácilmente desde aquí.\n\n¿Confirmas la eliminación?`}
				onConfirm={confirmDeleteTreatment}
				onCancel={() => { setShowDeleteModal(false); setTreatmentToDelete(null); }}
				isDestructive
				confirmLabel="Eliminar tratamiento"
			/>
			<ConfirmModal
				isOpen={showDeleteGroupModal}
				title="Eliminar grupo"
				message={`Estás a punto de eliminar el grupo "${groupToDelete?.name || ""}".\n\nLos tratamientos del grupo quedarán sin clasificar. Esta acción no se puede deshacer.\n\n¿Confirmas la eliminación?`}
				onConfirm={confirmDeleteGroup}
				onCancel={() => { setShowDeleteGroupModal(false); setGroupToDelete(null); }}
				isDestructive
				confirmLabel="Eliminar grupo"
			/>
			{/* HEADER */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h2 className="text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight">
					Tratamientos
				</h2>
				<div className="flex flex-wrap gap-2 w-full sm:w-auto">
					<div className="flex bg-slate-100 p-1 rounded-lg">
						<button
							onClick={() => setViewMode("grid")}
							className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-rose-700" : "text-slate-500 hover:text-slate-700"}`}
							title="Vista Tarjetas">
							<LayoutGrid size={18} />
						</button>
						<button
							onClick={() => setViewMode("list")}
							className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-rose-700" : "text-slate-500 hover:text-slate-700"}`}
							title="Vista Lista">
							<ListIcon size={18} />
						</button>
					</div>
					{viewMode === "list" && (
						<ColumnPicker
							columns={TREATMENT_COLUMNS}
							isVisible={isTreatColVisible}
							onToggle={toggleTreatCol}
						/>
					)}
					<button
						type="button"
						onClick={openGroupsModal}
						className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors">
						<FolderOpen size={16} /> Grupos
					</button>
					<button
						type="button"
						onClick={() => openModal()}
						className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-700 text-white shadow-sm hover:bg-rose-800 transition-colors">
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
									<FolderOpen size={16} className="text-rose-700" />
									<span className="font-black text-sm text-gray-800 uppercase tracking-wide">{gr.name}</span>
									<span className="text-xs text-gray-400 font-medium">({list.length})</span>
								</div>
								{viewMode === "grid" ? (
									<div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
										{list.map((t) => renderTreatmentCard(t))}
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-left border-collapse min-w-[560px]">
											<thead>
												<tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
													{isTreatColVisible("name") && <th className="p-3">Tratamiento</th>}
													{isTreatColVisible("notes") && (
														<th className="p-3 hidden sm:table-cell">Notas</th>
													)}
													{isTreatColVisible("price") && <th className="p-3">Precio PVP</th>}
													{isTreatColVisible("profit") && (
														<th className="p-3">Beneficio Neto</th>
													)}
													{isTreatColVisible("acciones") && (
														<th className="p-3 text-right">Acciones</th>
													)}
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-100">
												{list.map((t) => renderTreatmentTableRow(t))}
											</tbody>
										</table>
									</div>
								)}
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
							{viewMode === "grid" ? (
								<div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
									{treatmentsByGroup.byGroup[UNGROUPED_KEY].map((t) => renderTreatmentCard(t))}
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse min-w-[560px]">
										<thead>
											<tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
												{isTreatColVisible("name") && <th className="p-3">Tratamiento</th>}
												{isTreatColVisible("notes") && (
													<th className="p-3 hidden sm:table-cell">Notas</th>
												)}
												{isTreatColVisible("price") && <th className="p-3">Precio PVP</th>}
												{isTreatColVisible("profit") && (
													<th className="p-3">Beneficio Neto</th>
												)}
												{isTreatColVisible("acciones") && (
													<th className="p-3 text-right">Acciones</th>
												)}
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{treatmentsByGroup.byGroup[UNGROUPED_KEY].map((t) => renderTreatmentTableRow(t))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
				</div>
			)}


			<SidePanel
				isOpen={showGroupsModal}
				onClose={() => setShowGroupsModal(false)}
				title="Grupos de tratamientos"
				subtitle="Organiza servicios (ej. Mesoterapia)"
				size="md"
				footer={
					<LoadingButton
						loading={isCreatingGroup}
						type="button"
						onClick={handleSaveGroup}
						className="w-full btn-primary py-3">
						{editingGroup ? "Guardar grupo" : "Añadir grupo"}
					</LoadingButton>
				}>
				<p className="text-sm text-muted mb-4">
					Agrupa tratamientos para encontrarlos más rápido. Asigna el grupo al crear o editar cada uno.
				</p>
				<label className="block space-y-1 mb-4">
					<span className="text-xs font-bold text-muted">Nombre del grupo</span>
					<input
						className="input-field"
						placeholder="Ej. Mesoterapia"
						value={groupFormName}
						onChange={(e) => setGroupFormName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleSaveGroup(e);
							}
						}}
					/>
				</label>
				{editingGroup && (
					<button
						type="button"
						onClick={() => {
							setEditingGroup(null);
							setGroupFormName("");
						}}
						className="text-xs text-muted hover:text-fg mb-3">
						Cancelar edición
					</button>
				)}
				<div className="space-y-2">
					{groups.length === 0 ? (
						<p className="text-sm text-muted py-4">No hay grupos. Crea uno arriba.</p>
					) : (
						groups
							.slice()
							.sort(
								(a, b) =>
									(a.sort_order ?? 0) - (b.sort_order ?? 0) ||
									(a.name || "").localeCompare(b.name || ""),
							)
							.map((g) => (
								<div
									key={g.id}
									className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-edge">
									<span className="font-bold text-fg">{g.name}</span>
									<div className="flex gap-1">
										<button
											type="button"
											onClick={() => {
												setEditingGroup(g);
												setGroupFormName(g.name);
											}}
											className="p-1.5 text-muted hover:text-primary rounded-lg"
											title="Editar grupo">
											<Edit2 size={14} />
										</button>
										{canDeleteOperational && (
											<button
												type="button"
												onClick={() => {
													setGroupToDelete(g);
													setShowDeleteGroupModal(true);
												}}
												className="p-1.5 text-muted hover:text-danger rounded-lg"
												title="Eliminar grupo">
												<Trash2 size={14} />
											</button>
										)}
									</div>
								</div>
							))
					)}
				</div>
			</SidePanel>

			<SidePanel
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={editingTreatment ? "Editar tratamiento" : "Nuevo tratamiento"}
				subtitle="PVP, fiscalidad y materiales de la receta"
				size="lg"
				footer={
					<LoadingButton
						loading={loading}
						type="button"
						onClick={handleSave}
						className="w-full btn-primary py-3">
						{editingTreatment ? "Guardar cambios" : "Crear tratamiento"}
					</LoadingButton>
				}>
				<form onSubmit={handleSave}>
					<FormSheet>
						<FormSheetPrimary>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Nombre</span>
								<input
									required
									className="input-field"
									placeholder="Nombre del servicio"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Grupo</span>
								<select
									className="input-field"
									value={formData.group_id}
									onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}>
									<option value="">Sin grupo</option>
									{groups.map((g) => (
										<option key={g.id} value={g.id}>
											{g.name}
										</option>
									))}
								</select>
							</label>
							<div className="grid grid-cols-2 gap-3">
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">PVP (€)</span>
									<input
										type="number"
										required
										className="input-field font-bold text-primary"
										value={formData.price}
										onChange={(e) => setFormData({ ...formData, price: e.target.value })}
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">IVA</span>
									<select
										className="input-field"
										value={formData.tax_rate}
										onChange={(e) =>
											setFormData({ ...formData, tax_rate: Number(e.target.value) })
										}>
										<option value={21}>Estético — 21 %</option>
										<option value={0}>Sanitario — 0 %</option>
										{IVA_OPTIONS.filter((v) => v !== 21 && v !== 0).map((v) => (
											<option key={v} value={v}>
												IVA {v} %
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="space-y-3">
								<span className="erp-label mb-0">Materiales / receta</span>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">
										Añadir varios de golpe
									</span>
									<select
										className="input-field text-sm"
										value=""
										onChange={(e) => {
											const id = e.target.value;
											if (!id) return;
											if (formData.recipe.some((r) => r.materialId === id)) return;
											setFormData({
												...formData,
												recipe: [
													...formData.recipe,
													{ materialId: id, quantity: 1 },
												],
											});
										}}>
										<option value="">— Seleccionar producto / máquina —</option>
										{inventory
											.filter(
												(inv) =>
													!formData.recipe.some((r) => r.materialId === inv.id),
											)
											.map((inv) => (
												<option key={inv.id} value={inv.id}>
													{inv.name}
													{(inv.item_type || "material") === "maquina"
														? " (Máquina)"
														: ` · stock ${inv.stock}`}
												</option>
											))}
									</select>
								</label>
								{formData.recipe.length > 0 && (
									<div className="rounded-xl border border-edge overflow-hidden">
										<table className="w-full text-sm">
											<thead>
												<tr className="bg-surface-2 text-[10px] font-medium uppercase tracking-wider text-muted">
													<th className="text-left p-2">Producto</th>
													<th className="text-center p-2 w-20">Uds</th>
													<th className="text-center p-2 w-16">Stock</th>
													<th className="w-8" />
												</tr>
											</thead>
											<tbody className="divide-y divide-edge">
												{formData.recipe.map((item, index) => {
													const inv = inventory.find((i) => i.id === item.materialId);
													const stock = inv ? Number(inv.stock) : null;
													const isMachine =
														(inv?.item_type || "material") === "maquina";
													const low =
														!isMachine &&
														stock != null &&
														stock < Number(item.quantity || 0);
													return (
														<tr key={`${item.materialId}-${index}`}>
															<td className="p-2 font-medium text-fg">
																{inv?.name || "—"}
															</td>
															<td className="p-2">
																<input
																	type="number"
																	step="0.1"
																	min="0"
																	className="w-full p-1.5 bg-surface rounded-lg text-center font-bold text-primary text-sm border border-edge"
																	value={item.quantity}
																	onChange={(e) =>
																		updateMaterial(
																			index,
																			"quantity",
																			e.target.value,
																		)
																	}
																	required
																/>
															</td>
															<td className="p-2 text-center tabular-nums text-xs">
																{isMachine ? (
																	<span className="text-muted">—</span>
																) : (
																	<span
																		className={
																			low
																				? "text-rose-700 font-bold"
																				: "text-muted"
																		}>
																		{stock}
																	</span>
																)}
															</td>
															<td className="p-2">
																<button
																	type="button"
																	onClick={() =>
																		setFormData({
																			...formData,
																			recipe: formData.recipe.filter(
																				(_, i) => i !== index,
																			),
																		})
																	}
																	className="text-muted hover:text-danger">
																	<X size={16} />
																</button>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
							<FormDetails title="Más detalles" defaultOpen={!!formData.internal_notes}>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Notas internas</span>
									<textarea
										rows={3}
										placeholder="Solo para ti"
										className="input-field resize-none"
										value={formData.internal_notes}
										onChange={(e) =>
											setFormData({ ...formData, internal_notes: e.target.value })
										}
									/>
								</label>
							</FormDetails>
						</FormSheetPrimary>
						<FormSheetPreview>
							<div className="grid grid-cols-2 gap-3">
								<FormPreviewStat
									label="Coste receta"
									value={`${calculateCost(formData.recipe).toFixed(2)} €`}
								/>
								<FormPreviewStat
									label="Beneficio"
									tone="success"
									value={`${(Number(formData.price) - calculateCost(formData.recipe)).toFixed(2)} €`}
								/>
							</div>
							<p className="text-sm text-slate-300">
								ROI est.{" "}
								<strong className="text-sky-300">
									{formData.price > 0
										? (
												((Number(formData.price) - calculateCost(formData.recipe)) /
													Number(formData.price)) *
												100
											).toFixed(0)
										: 0}
									%
								</strong>
							</p>
							<p className="text-[11px] text-slate-400">{taxRateLabel(formData.tax_rate)}</p>
							{formData.name ? (
								<p className="text-sm font-semibold text-slate-200 pt-2 border-t border-slate-700">
									{formData.name}
								</p>
							) : null}
						</FormSheetPreview>
					</FormSheet>
				</form>
			</SidePanel>
		</div>
	);
};

