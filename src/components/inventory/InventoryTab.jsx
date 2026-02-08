import React, { useState } from "react";
import {
	Plus,
	Search,
	Package,
	Trash2,
	Edit2,
	Loader2,
	AlertTriangle,
} from "lucide-react";
import { IVA_OPTIONS, formatCurrency, formatDate } from "../../utils/format";
import { calculateUnitCost } from "../../utils/calculations";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import {
	useCreateMaterial,
	useUpdateMaterial,
	useRestockMaterial,
	useDeleteMaterial,
} from "../../hooks/useInventoryMutations";

export const InventoryTab = ({
	user,
	inventory = [],
	entries = [],
	showToast,
	onRefresh,
}) => {
	const createMaterial = useCreateMaterial(user?.id);
	const updateMaterial = useUpdateMaterial(user?.id);
	const restockMaterial = useRestockMaterial(user?.id);
	const deleteMaterial = useDeleteMaterial(user?.id);

	const loading =
		createMaterial.isPending ||
		updateMaterial.isPending ||
		restockMaterial.isPending ||
		deleteMaterial.isPending;
	const materialPurchases = (entries || [])
		.filter((e) => e.type === "expense" && e.category === "Material")
		.sort((a, b) => (b.date || "").localeCompare(a.date || ""))
		.slice(0, 15);
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState(null);

	const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
	const [restockItem, setRestockItem] = useState(null);
	const [restockData, setRestockData] = useState({
		quantity: "",
		totalCost: "",
		taxRate: 21,
	});

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);

	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		totalCost: "",
		tax_rate: 21,
		min_stock: "5",
	});

	const filteredInventory =
		inventory?.filter((item) =>
			item.name.toLowerCase().includes(searchTerm.toLowerCase())
		) || [];

	const lowStockCount =
		inventory?.filter((item) => Number(item.stock) <= Number(item.min_stock))
			.length || 0;

	const openModal = (item = null) => {
		if (item) {
			setEditingItem(item);
			const calculatedTotal = (
				Number(item.stock) * Number(item.unit_cost)
			).toFixed(2);
			setFormData({
				name: item.name,
				stock: item.stock,
				unit: item.unit || "uds",
				totalCost: calculatedTotal,
				tax_rate: 21,
				min_stock: item.min_stock,
			});
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				totalCost: "",
				tax_rate: 21,
				min_stock: "5",
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		if (Number(formData.stock) <= 0) {
			showToast("El stock debe ser mayor a 0", "error");
			return;
		}
		try {
			if (editingItem) {
				await updateMaterial.mutateAsync({ editingItem, formData });
				showToast("Material actualizado");
			} else {
				await createMaterial.mutateAsync({ formData, taxCalc: {} });
				showToast("Material creado y gasto registrado");
			}
			setIsModalOpen(false);
			await onRefresh();
		} catch (error) {
			showToast("Error: " + (error?.message || "Error al guardar"), "error");
		}
	};

	const openRestockModal = (item) => {
		setRestockItem(item);
		setRestockData({ quantity: "", totalCost: "", taxRate: 21 });
		setIsRestockModalOpen(true);
	};

	const handleRestock = async (e) => {
		e.preventDefault();
		try {
			await restockMaterial.mutateAsync({ restockItem, restockData });
			showToast("Stock actualizado");
			setIsRestockModalOpen(false);
			await onRefresh();
		} catch {
			showToast("Error al reponer", "error");
		}
	};

	const handleDeleteClick = (item) => {
		setItemToDelete(item);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!itemToDelete) return;
		try {
			await deleteMaterial.mutateAsync(itemToDelete.id);
			showToast("Eliminado");
			setShowDeleteModal(false);
			setItemToDelete(null);
			await onRefresh();
		} catch {
			showToast("Error al eliminar", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Material"
				message={`¿Eliminar "${itemToDelete?.name}"?`}
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			<div className="flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full md:max-w-md">
					<Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
					<input
						placeholder="Buscar material..."
						className="w-full pl-12 p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 ring-rose-100 font-bold"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => openModal()}
					className="bg-primary hover:bg-primary-hover text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-rose-100 transition-all w-full md:w-auto justify-center">
					<Plus size={20} /> Nuevo Material
				</button>
			</div>

			{lowStockCount > 0 && (
				<div className="bg-warning-bg border border-warning-border p-4 rounded-2xl flex items-start gap-4 shadow-sm">
					<AlertTriangle className="text-warning-icon" size={20} />
					<div>
						<h4 className="font-bold text-warning-text">
							Stock Bajo ({lowStockCount})
						</h4>
						<p className="text-xs text-warning-text-light">
							Revisa los productos marcados.
						</p>
					</div>
				</div>
			)}

			<div className="md:hidden">
				{filteredInventory.length === 0 ? (
					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
						<EmptyState
							icon={Package}
							title="No hay materiales"
							description="Añade tu primer producto al inventario para empezar a controlar el stock."
							actionLabel="Añadir primer material"
							onAction={() => openModal()}
						/>
					</div>
				) : (
				<div className="space-y-3">
				{filteredInventory.map((item) => (
					<div
						key={item.id}
						className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
						<div className="flex justify-between items-start">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
									<Package size={20} />
								</div>
								<div>
									<h4 className="font-bold text-gray-800">{item.name}</h4>
									<p className="text-xs text-gray-400 font-medium">
										{item.unit_cost.toFixed(2)}€ / {item.unit}
									</p>
								</div>
							</div>
							<div className="flex gap-1">
								<button
									onClick={() => openModal(item)}
									className="p-2 bg-gray-50 text-gray-400 rounded-lg"
									title="Editar material">
									<Edit2 size={16} />
								</button>
								<button
									onClick={() => handleDeleteClick(item)}
									className="p-2 bg-red-50 text-red-500 rounded-lg"
									title="Eliminar material">
									<Trash2 size={16} />
								</button>
							</div>
						</div>

						<div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
							<div className="flex flex-col">
								<span className="text-[10px] uppercase font-bold text-gray-400">
									Stock Actual
								</span>
								<span
									className={`font-black text-lg ${
										item.stock <= item.min_stock
											? "text-red-500"
											: "text-gray-800"
									}`}>
									{item.stock}{" "}
									<span className="text-xs font-normal text-gray-400">
										{item.unit}
									</span>
								</span>
							</div>
							<button
								onClick={() => openRestockModal(item)}
								className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors">
								<Plus size={14} /> Reponer
							</button>
						</div>
					</div>
				))}
				</div>
				)}
			</div>

			<div className="hidden md:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
				{filteredInventory.length === 0 ? (
					<div className="p-6">
						<EmptyState
							icon={Package}
							title="No hay materiales"
							description="Añade tu primer producto al inventario para empezar a controlar el stock."
							actionLabel="Añadir primer material"
							onAction={() => openModal()}
						/>
					</div>
				) : (
				<table className="w-full text-left border-collapse">
					<thead>
						<tr className="bg-gray-50/50 border-b text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">
							<th className="p-6">Material</th>
							<th className="p-6 text-center">Stock</th>
							<th className="p-6 text-center">Coste Unit.</th>
							<th className="p-6 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{filteredInventory.map((item) => (
							<tr
								key={item.id}
								className="hover:bg-gray-50/30 transition-colors group">
								<td className="p-6">
									<div className="flex items-center gap-4">
										<div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
											<Package size={24} />
										</div>
										<div>
											<p className="font-bold text-gray-900 text-lg leading-tight">
												{item.name}
											</p>
											<p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
												{item.unit || "uds"}
											</p>
										</div>
									</div>
								</td>
								<td className="p-6 text-center">
									<span
										className={`px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${
											Number(item.stock) <= Number(item.min_stock)
												? "bg-rose-50 text-rose-600 border border-rose-100"
												: "bg-emerald-50 text-emerald-600 border border-emerald-100"
										}`}>
										{item.stock}
									</span>
								</td>
								<td className="p-6 text-center">
									<span className="font-bold text-gray-600 text-lg">
										{Number(item.unit_cost).toFixed(2)} €
									</span>
								</td>
								<td className="p-6 text-right">
									<div className="flex justify-end gap-2">
										<button
											onClick={() => openRestockModal(item)}
											className="p-2.5 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
											title="Reponer Stock">
											<Plus size={18} />
										</button>
										<button
											onClick={() => openModal(item)}
											className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-200 transition-all shadow-sm"
											title="Editar material">
											<Edit2 size={18} />
										</button>
										<button
											onClick={() => handleDeleteClick(item)}
											className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
											title="Eliminar material">
											<Trash2 size={18} />
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				)}
			</div>

			{/* Historial de compras (Material) */}
			{materialPurchases.length > 0 && (
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
					<h3 className="p-4 font-black text-gray-700 uppercase text-xs tracking-widest border-b border-gray-100">
						Historial de compras
					</h3>
					<div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
						{materialPurchases.map((entry) => (
							<div
								key={entry.id}
								className="flex justify-between items-center p-4 hover:bg-gray-50/50">
								<div>
									<p className="font-bold text-gray-800 text-sm">
										{entry.description}
									</p>
									<p className="text-[10px] text-gray-400 font-bold uppercase">
										{formatDate(entry.date)}
									</p>
								</div>
								<span className="font-black text-rose-500">
									-{formatCurrency(entry.amount)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={editingItem ? "Editar Material" : "Nuevo Material"}
				maxWidth="max-w-lg">
				<form onSubmit={handleSave} className="space-y-6">
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
										Nombre del Producto
									</label>
									<input
										required
										placeholder="Ej: Agujas 30G"
										className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-gray-200 focus:bg-white rounded-2xl outline-none font-bold"
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											Stock Actual
										</label>
										<input
											type="number"
											placeholder="Ej: 100"
											className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
											value={formData.stock}
											onChange={(e) =>
												setFormData({ ...formData, stock: e.target.value })
											}
										/>
									</div>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											Unidad
										</label>
										<select
											className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer"
											value={formData.unit}
											onChange={(e) =>
												setFormData({ ...formData, unit: e.target.value })
											}>
											<option value="uds">uds</option>
											<option value="dosis">dosis</option>
											<option value="ml">ml</option>
											<option value="paq">paq</option>
											<option value="g">g</option>
										</select>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-2 block ml-1">
											Coste Total (€)
										</label>
										<input
											type="number"
											step="0.01"
											placeholder="Ej: 25.50"
											className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-rose-500 placeholder-rose-300"
											value={formData.totalCost}
											onChange={(e) =>
												setFormData({ ...formData, totalCost: e.target.value })
											}
										/>
										{formData.stock && formData.totalCost && Number(formData.stock) > 0 && (
											<p className="text-xs text-gray-500 mt-2 ml-1">
												Coste unitario calculado: {calculateUnitCost(formData.totalCost, formData.stock).toFixed(2)} €
											</p>
										)}
									</div>
									{!editingItem && (
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												IVA (%)
											</label>
											<select
												className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer"
												value={formData.tax_rate}
												onChange={(e) =>
													setFormData({ ...formData, tax_rate: Number(e.target.value) })
												}>
										{IVA_OPTIONS.map((v) => (
											<option key={v} value={v}>{v}%</option>
										))}
									</select>
								</div>
									)}
									<div className={!editingItem ? "col-span-2" : ""}>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											Aviso Mínimo
										</label>
										<input
											type="number"
											placeholder="Ej: 5"
											className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
											value={formData.min_stock}
											onChange={(e) =>
												setFormData({ ...formData, min_stock: e.target.value })
											}
										/>
									</div>
								</div>
								<div className="pt-4">
									<LoadingButton
										loading={loading}
										type="submit"
										className="w-full bg-surface-dark text-white font-black py-4 rounded-xl shadow-lg">
										{loading ? "Guardando..." : "Guardar Material"}
									</LoadingButton>
								</div>
							</form>
			</AdaptiveModal>

			<AdaptiveModal
				isOpen={isRestockModalOpen}
				onClose={() => setIsRestockModalOpen(false)}
				title={`Reponer: ${restockItem?.name || ""}`}
				maxWidth="max-w-md">
				<form onSubmit={handleRestock} className="space-y-6">
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									Cantidad Comprada
								</label>
								<input
									type="number"
									required
									placeholder="0"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none"
									value={restockData.quantity}
									onChange={(e) =>
										setRestockData({ ...restockData, quantity: e.target.value })
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
										Coste Total (€)
									</label>
									<input
										type="number"
										step="0.01"
										required
										placeholder="0.00"
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none"
										value={restockData.totalCost}
										onChange={(e) =>
											setRestockData({
												...restockData,
												totalCost: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
										IVA (%)
									</label>
									<select
										className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none cursor-pointer"
										value={restockData.taxRate}
										onChange={(e) =>
											setRestockData({
												...restockData,
												taxRate: Number(e.target.value),
											})
										}>
										{IVA_OPTIONS.map((v) => (
											<option key={v} value={v}>{v}%</option>
										))}
									</select>
								</div>
							</div>
							<LoadingButton
								loading={loading}
								type="submit"
								className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg">
								{loading ? "Guardando..." : "Confirmar Compra"}
							</LoadingButton>
						</form>
			</AdaptiveModal>
		</div>
	);
};
