import React, { useState } from "react";
import {
	Plus,
	Search,
	Package,
	Trash2,
	Edit2,
	Loader2,
	AlertTriangle,
	X,
	RotateCcw,
	Info,
	MoreVertical,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { ConfirmModal } from "../ui/ConfirmModal";

export const InventoryTab = ({
	user,
	inventory = [],
	showToast,
	onRefresh,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState(null);

	const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
	const [restockItem, setRestockItem] = useState(null);
	const [restockData, setRestockData] = useState({
		quantity: "",
		totalCost: "",
	});

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);
	const [loading, setLoading] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		totalCost: "",
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
				min_stock: item.min_stock,
			});
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				totalCost: "",
				min_stock: "5",
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const stockNum = Number(formData.stock);
			const totalCostNum = Number(formData.totalCost);

			if (stockNum <= 0) throw new Error("El stock debe ser mayor a 0");

			// Calcular coste unitario
			const calculatedUnitCost = totalCostNum / stockNum;

			const payload = {
				name: formData.name,
				stock: stockNum,
				unit: formData.unit,
				unit_cost: calculatedUnitCost,
				min_stock: Number(formData.min_stock),
				user_id: user.id,
			};

			if (editingItem) {
				// MODO EDICIÓN: Solo actualizamos la ficha del material
				// (No generamos gasto financiero porque asumimos que es una corrección de datos)
				const { error } = await supabase
					.from("inventory")
					.update(payload)
					.eq("id", editingItem.id);
				if (error) throw error;
				showToast("Material actualizado");
			} else {
				// MODO CREACIÓN: Nuevo material -> Generar Gasto

				// 1. Insertar en Inventario
				const { error: invError } = await supabase
					.from("inventory")
					.insert([payload]);
				if (invError) throw invError;

				// 2. Insertar en Finanzas (EL CAMBIO IMPORTANTE)
				const { error: finError } = await supabase
					.from("finance_entries")
					.insert([
						{
							user_id: user.id,
							type: "expense", // Gasto
							category: "Material",
							description: `Compra Stock Inicial: ${formData.name}`,
							amount: totalCostNum, // El coste total que pusiste en el formulario
							date: new Date().toISOString().split("T")[0],
						},
					]);
				if (finError) throw finError;

				showToast("Material creado y gasto registrado");
			}
			setIsModalOpen(false);
			await onRefresh();
		} catch (error) {
			console.error(error);
			showToast("Error: " + error.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const openRestockModal = (item) => {
		setRestockItem(item);
		setRestockData({ quantity: "", totalCost: "" });
		setIsRestockModalOpen(true);
	};

	const handleRestock = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const qtyBought = Number(restockData.quantity);
			const purchaseCost = Number(restockData.totalCost);
			const currentStock = Number(restockItem.stock);
			const currentUnitCost = Number(restockItem.unit_cost);
			const newStock = currentStock + qtyBought;
			const newUnitCost =
				(currentStock * currentUnitCost + purchaseCost) / newStock;

			const { error } = await supabase
				.from("inventory")
				.update({
					stock: newStock,
					unit_cost: parseFloat(newUnitCost.toFixed(4)),
				})
				.eq("id", restockItem.id);
			if (error) throw error;

			await supabase.from("finance_entries").insert([
				{
					user_id: user.id,
					date: new Date().toISOString().split("T")[0],
					type: "expense",
					category: "Material",
					description: `Reposición: ${restockItem.name} (${qtyBought} ${restockItem.unit})`,
					amount: purchaseCost,
				},
			]);

			showToast("Stock actualizado");
			setIsRestockModalOpen(false);
			await onRefresh();
		} catch (error) {
			showToast("Error al reponer", "error");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteClick = (item) => {
		setItemToDelete(item);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!itemToDelete) return;
		try {
			const { error } = await supabase
				.from("inventory")
				.delete()
				.eq("id", itemToDelete.id);
			if (error) throw error;
			showToast("Eliminado");
			await onRefresh();
		} catch (error) {
			showToast("Error al eliminar", "error");
		} finally {
			setShowDeleteModal(false);
			setItemToDelete(null);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 xl:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Material"
				message={`¿Eliminar "${itemToDelete?.name}"?`}
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			<div className="flex flex-col xl:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full xl:max-w-md">
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
					className="bg-[#f43f5e] hover:bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-rose-100 transition-all w-full xl:w-auto justify-center">
					<Plus size={20} /> Nuevo Material
				</button>
			</div>

			{lowStockCount > 0 && (
				<div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-2xl flex items-start gap-4 shadow-sm">
					<AlertTriangle className="text-[#d97706]" size={20} />
					<div>
						<h4 className="font-bold text-[#92400e]">
							Stock Bajo ({lowStockCount})
						</h4>
						<p className="text-xs text-[#b45309]">
							Revisa los productos marcados.
						</p>
					</div>
				</div>
			)}

			<div className="xl:hidden space-y-3">
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
									className="p-2 bg-gray-50 text-gray-400 rounded-lg">
									<Edit2 size={16} />
								</button>
								<button
									onClick={() => handleDeleteClick(item)}
									className="p-2 bg-red-50 text-red-500 rounded-lg">
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
								<RotateCcw size={14} /> Reponer
							</button>
						</div>
					</div>
				))}
			</div>

			<div className="hidden xl:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
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
											<RotateCcw size={18} />
										</button>
										<button
											onClick={() => openModal(item)}
											className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-200 transition-all shadow-sm">
											<Edit2 size={18} />
										</button>
										<button
											onClick={() => handleDeleteClick(item)}
											className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
											<Trash2 size={18} />
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-start xl:items-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] mt-8 xl:mt-0 animate-in zoom-in-95">
						<div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
							<h3 className="text-2xl font-black text-gray-800 tracking-tight">
								{editingItem ? "Editar" : "Nuevo"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="text-gray-400 hover:text-gray-600">
								<X size={24} />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
												Coste unitario calculado: {(Number(formData.totalCost) / Number(formData.stock)).toFixed(2)} €
											</p>
										)}
									</div>
									<div>
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
									<button className="w-full bg-[#1e293b] text-white font-black py-4 rounded-xl shadow-lg">
										Guardar Material
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{isRestockModalOpen && (
				<div className="fixed inset-0 z-[60] flex justify-center items-center p-4">
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setIsRestockModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95">
						<div className="flex justify-between items-start mb-6">
							<div>
								<h3 className="text-2xl font-black text-blue-600">Reponer</h3>
								<p className="text-gray-500 font-bold">{restockItem?.name}</p>
							</div>
							<button onClick={() => setIsRestockModalOpen(false)}>
								<X className="text-gray-400" />
							</button>
						</div>
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
							<button
								disabled={loading}
								className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg">
								{loading ? "Guardando..." : "Confirmar Compra"}
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
