import React, { useState } from "react";
import {
	Plus,
	Search,
	Package,
	Trash2,
	Edit2,
	Loader2,
	AlertTriangle,
	ChevronDown,
	Filter,
	History,
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
	useUpdateBatch,
} from "../../hooks/useInventoryMutations";
import { useInventoryBatches, fetchBatchesForMaterial } from "../../hooks/useInventoryBatches";

function BatchEditRow({ batch, onSave, showToast }) {
	const [lotNumber, setLotNumber] = useState(batch.lot_number);
	const [expiryDate, setExpiryDate] = useState(batch.expiry_date?.slice?.(0, 10) || "");

	const handleBlur = () => {
		if (
			(lotNumber !== batch.lot_number || expiryDate !== (batch.expiry_date?.slice?.(0, 10) || "")) &&
			lotNumber.trim() &&
			expiryDate
		) {
			onSave({ lot_number: lotNumber.trim(), expiry_date: expiryDate }).catch(() =>
				showToast("Error al actualizar lote", "error")
			);
		}
	};

	return (
		<div className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200">
			<input
				type="text"
				className="flex-1 p-2 rounded-lg text-sm font-bold outline-none border border-gray-200"
				value={lotNumber}
				onChange={(e) => setLotNumber(e.target.value)}
				onBlur={handleBlur}
				placeholder="Nº lote"
			/>
			<input
				type="date"
				className="p-2 rounded-lg text-sm font-bold outline-none border border-gray-200 w-36"
				value={expiryDate}
				onChange={(e) => setExpiryDate(e.target.value)}
				onBlur={handleBlur}
			/>
			<span className="text-xs text-gray-400 font-medium shrink-0">
				{batch.quantity_remaining} {batch.quantity_remaining === 1 ? "ud" : "uds"}
			</span>
		</div>
	);
}

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
	const updateBatch = useUpdateBatch(user?.id);
	const { batches } = useInventoryBatches(user?.id);

	const loading =
		createMaterial.isPending ||
		updateMaterial.isPending ||
		restockMaterial.isPending ||
		deleteMaterial.isPending;
	const allMaterialPurchases = (entries || []).filter(
		(e) => e.type === "expense" && e.category === "Material"
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [purchaseSearch, setPurchaseSearch] = useState("");
	const [purchaseSort, setPurchaseSort] = useState("date-desc");
	const [purchaseDateFrom, setPurchaseDateFrom] = useState("");
	const [purchaseDateTo, setPurchaseDateTo] = useState("");
	const [purchaseAmountMin, setPurchaseAmountMin] = useState("");
	const [purchaseAmountMax, setPurchaseAmountMax] = useState("");
	const [showPurchaseFilters, setShowPurchaseFilters] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState(null);

	const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
	const [restockItem, setRestockItem] = useState(null);
	const [restockData, setRestockData] = useState({
		quantity: "",
		totalCost: "",
		taxRate: 21,
		lotNumber: "",
		expiryDate: "",
		purchaseDate: new Date().toISOString().split("T")[0],
	});

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);
	const [editBatches, setEditBatches] = useState([]);

	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		totalCost: "",
		tax_rate: 21,
		min_stock: "5",
		lotNumber: "",
		expiryDate: "",
		purchaseDate: new Date().toISOString().split("T")[0],
		supplier_nif: "",
		invoice_number: "",
	});

	const filteredInventory =
		inventory?.filter((item) =>
			item.name.toLowerCase().includes(searchTerm.toLowerCase())
		) || [];

	const materialPurchases = (() => {
		let list = [...allMaterialPurchases];

		if (purchaseSearch.trim()) {
			const q = purchaseSearch.toLowerCase().trim();
			list = list.filter(
				(e) =>
					(e.description || "").toLowerCase().includes(q) ||
					(e.amount?.toString() || "").includes(q)
			);
		}
		if (purchaseDateFrom) {
			list = list.filter((e) => (e.date || "") >= purchaseDateFrom);
		}
		if (purchaseDateTo) {
			list = list.filter((e) => (e.date || "") <= purchaseDateTo);
		}
		if (purchaseAmountMin !== "" && !Number.isNaN(Number(purchaseAmountMin))) {
			list = list.filter((e) => Number(e.amount) >= Number(purchaseAmountMin));
		}
		if (purchaseAmountMax !== "" && !Number.isNaN(Number(purchaseAmountMax))) {
			list = list.filter((e) => Number(e.amount) <= Number(purchaseAmountMax));
		}

		const [field, order] = purchaseSort.split("-");
		list.sort((a, b) => {
			if (field === "date") {
				const cmp = (a.date || "").localeCompare(b.date || "");
				return order === "desc" ? -cmp : cmp;
			}
			if (field === "amount") {
				const cmp = Number(a.amount) - Number(b.amount);
				return order === "desc" ? -cmp : cmp;
			}
			return 0;
		});
		return list;
	})();

	const getEarliestExpiry = (itemId) => {
		const itemBatches = (batches || []).filter((b) => b.inventory_id === itemId);
		if (!itemBatches.length) return null;
		const sorted = [...itemBatches].sort(
			(a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)
		);
		return sorted[0];
	};

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
			setEditBatches([]);
			fetchBatchesForMaterial(item.id).then(setEditBatches);
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				totalCost: "",
				tax_rate: 21,
				min_stock: "5",
				lotNumber: "",
				expiryDate: "",
				purchaseDate: new Date().toISOString().split("T")[0],
				supplier_nif: "",
				invoice_number: "",
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
		setRestockData({
			quantity: "",
			totalCost: "",
			taxRate: 21,
			lotNumber: "",
			expiryDate: "",
			purchaseDate: new Date().toISOString().split("T")[0],
			supplier_nif: "",
			invoice_number: "",
		});
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
										{item.unit_cost.toFixed(2)} € / {item.unit_consumption || item.unit || "uds"}
									</p>
									{(item.unit_purchase || item.unit_consumption) && (
										<p className="text-[10px] text-gray-400">
											Compra: {item.unit_purchase || item.unit || "uds"}
										</p>
									)}
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
							<th className="p-6 text-center">Próx. caducidad</th>
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
												{item.unit_purchase || item.unit_consumption
													? `Compra: ${item.unit_purchase || item.unit || "uds"} · Consumo: ${item.unit_consumption || item.unit || "uds"}`
													: (item.unit || "uds")}
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
									{(() => {
										const next = getEarliestExpiry(item.id);
										if (!next) return <span className="text-gray-300">—</span>;
										const isExpiringSoon =
											new Date(next.expiry_date) - new Date() < 90 * 24 * 60 * 60 * 1000;
										return (
											<span
												title={`Lote ${next.lot_number}`}
												className={
													isExpiringSoon
														? "text-amber-600 font-bold text-sm"
														: "text-gray-500 text-sm"
												}>
												{formatDate(next.expiry_date)}
											</span>
										);
									})()}
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

			{/* Historial de compras (Material) - Mejorado */}
			<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 border-b border-gray-100">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
							<History size={20} className="text-rose-500" />
							Historial de compras
						</h3>
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative flex-1 sm:flex-initial min-w-0 sm:min-w-[200px]">
								<Search
									className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
									size={18}
								/>
								<input
									type="text"
									placeholder="Buscar en historial..."
									value={purchaseSearch}
									onChange={(e) => setPurchaseSearch(e.target.value)}
									className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-200"
								/>
							</div>
							<button
								type="button"
								onClick={() => setShowPurchaseFilters((v) => !v)}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
									showPurchaseFilters
										? "bg-rose-100 text-rose-600"
										: "bg-gray-100 text-gray-600 hover:bg-gray-200"
								}`}>
								<Filter size={16} /> Filtros
								<ChevronDown
									size={14}
									className={`transition-transform ${showPurchaseFilters ? "rotate-180" : ""}`}
								/>
							</button>
							<select
								value={purchaseSort}
								onChange={(e) => setPurchaseSort(e.target.value)}
								className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-100 appearance-none cursor-pointer">
								<option value="date-desc">Más reciente</option>
								<option value="date-asc">Más antigua</option>
								<option value="amount-desc">Importe ↑</option>
								<option value="amount-asc">Importe ↓</option>
							</select>
						</div>
					</div>
					{showPurchaseFilters && (
						<div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in slide-in-from-top-2">
							<div>
								<label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Desde</label>
								<input
									type="date"
									value={purchaseDateFrom}
									onChange={(e) => setPurchaseDateFrom(e.target.value)}
									className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
								/>
							</div>
							<div>
								<label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Hasta</label>
								<input
									type="date"
									value={purchaseDateTo}
									onChange={(e) => setPurchaseDateTo(e.target.value)}
									className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
								/>
							</div>
							<div>
								<label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Importe mín. (€)</label>
								<input
									type="number"
									step="0.01"
									placeholder="0"
									value={purchaseAmountMin}
									onChange={(e) => setPurchaseAmountMin(e.target.value)}
									className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
								/>
							</div>
							<div>
								<label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Importe máx. (€)</label>
								<input
									type="number"
									step="0.01"
									placeholder="∞"
									value={purchaseAmountMax}
									onChange={(e) => setPurchaseAmountMax(e.target.value)}
									className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
								/>
							</div>
						</div>
					)}
				</div>
				<div className="overflow-x-auto max-h-[400px] overflow-y-auto">
					{allMaterialPurchases.length === 0 ? (
						<div className="p-12 text-center text-gray-400">
							<Package size={40} className="mx-auto mb-2 opacity-50" />
							<p className="text-sm font-medium">Sin compras registradas</p>
							<p className="text-xs mt-1">Las compras aparecerán al añadir o reponer materiales</p>
						</div>
					) : materialPurchases.length === 0 ? (
						<div className="p-12 text-center text-gray-400">
							<p className="text-sm font-medium">Ningún resultado</p>
							<p className="text-xs mt-1">Prueba a ajustar los filtros o la búsqueda</p>
						</div>
					) : (
						<table className="w-full text-left border-collapse">
							<thead className="sticky top-0 bg-gray-50/95 backdrop-blur z-10">
								<tr className="border-b border-gray-200">
									<th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Fecha</th>
									<th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Descripción</th>
									<th className="p-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Importe</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{materialPurchases.map((entry) => (
									<tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
										<td className="p-4 text-sm font-medium text-gray-600 whitespace-nowrap">
											{formatDate(entry.date)}
										</td>
										<td className="p-4">
											<p className="font-bold text-gray-800 text-sm line-clamp-2">
												{entry.description}
											</p>
										</td>
										<td className="p-4 text-right">
											<span className="font-black text-rose-500">
												-{formatCurrency(entry.amount)}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
				{allMaterialPurchases.length > 0 && materialPurchases.length > 0 && (
					<div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs font-medium text-gray-500">
						{materialPurchases.length} de {allMaterialPurchases.length} compras
					</div>
				)}
			</div>

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
											{editingItem && (
												<span className="text-gray-400 font-normal ml-1">(solo lectura, usa Reponer)</span>
											)}
										</label>
										<input
											type="number"
											placeholder="Ej: 100"
											readOnly={!!editingItem}
											className={`w-full p-4 rounded-2xl outline-none font-bold ${
												editingItem ? "bg-gray-100 text-gray-500" : "bg-gray-50"
											}`}
											value={formData.stock}
											onChange={(e) =>
												!editingItem && setFormData({ ...formData, stock: e.target.value })
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
								{editingItem && editBatches.length > 0 && (
									<div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
										<p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
											Lotes (corregir nº lote o caducidad)
										</p>
										{editBatches.map((b) => (
											<BatchEditRow
												key={`${b.id}-${b.lot_number}-${b.expiry_date}`}
												batch={b}
												onSave={async (updates) => {
													await updateBatch.mutateAsync({ batchId: b.id, updates });
													const next = editBatches.map((x) =>
														x.id === b.id ? { ...x, ...updates } : x
													);
													setEditBatches(next);
													showToast("Lote actualizado");
												}}
												showToast={showToast}
											/>
										))}
									</div>
								)}
								{!editingItem && Number(formData.stock) > 0 && (
									<div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
										<p className="text-xs font-bold text-amber-800 uppercase">
											Trazabilidad (obligatorio)
										</p>
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												Fecha de compra
											</label>
											<input
												type="date"
												className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
												value={formData.purchaseDate || ""}
												onChange={(e) =>
													setFormData({ ...formData, purchaseDate: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												Nº de Lote <span className="text-rose-500">*</span>
											</label>
											<input
												type="text"
												required
												placeholder="Ej: L2024-001"
												className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
												value={formData.lotNumber}
												onChange={(e) =>
													setFormData({ ...formData, lotNumber: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												Fecha de Caducidad <span className="text-rose-500">*</span>
											</label>
											<input
												type="date"
												required
												className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
												value={formData.expiryDate}
												onChange={(e) =>
													setFormData({ ...formData, expiryDate: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												NIF/CIF Proveedor *
											</label>
											<input
												required
												placeholder="Ej: B12345678"
												className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
												value={formData.supplier_nif}
												onChange={(e) =>
													setFormData({ ...formData, supplier_nif: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
												Nº Factura Proveedor
											</label>
											<input
												placeholder="Ej: F2026-001"
												className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
												value={formData.invoice_number}
												onChange={(e) =>
													setFormData({ ...formData, invoice_number: e.target.value })
												}
											/>
										</div>
									</div>
								)}
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
									Fecha de compra / reposición
								</label>
								<input
									type="date"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									value={restockData.purchaseDate || ""}
									onChange={(e) =>
										setRestockData({ ...restockData, purchaseDate: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									Nº de Lote <span className="text-rose-500">*</span>
								</label>
								<input
									type="text"
									required
									placeholder="Ej: L2024-001"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									value={restockData.lotNumber}
									onChange={(e) =>
										setRestockData({ ...restockData, lotNumber: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									Fecha de Caducidad <span className="text-rose-500">*</span>
								</label>
								<input
									type="date"
									required
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									value={restockData.expiryDate}
									onChange={(e) =>
										setRestockData({ ...restockData, expiryDate: e.target.value })
									}
								/>
							</div>
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
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									NIF/CIF Proveedor *
								</label>
								<input
									required
									placeholder="Ej: B12345678"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									value={restockData.supplier_nif}
									onChange={(e) =>
										setRestockData({
											...restockData,
											supplier_nif: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									Nº Factura Proveedor
								</label>
								<input
									placeholder="Ej: F2026-001"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
									value={restockData.invoice_number}
									onChange={(e) =>
										setRestockData({
											...restockData,
											invoice_number: e.target.value,
										})
									}
								/>
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
