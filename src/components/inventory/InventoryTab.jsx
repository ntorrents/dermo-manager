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
	Save,
	Info,
} from "lucide-react";
import { supabase } from "../../services/supabase";

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
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		unit_cost: "",
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
			setFormData({
				name: item.name,
				stock: item.stock,
				unit: item.unit || "uds",
				unit_cost: item.unit_cost,
				min_stock: item.min_stock,
			});
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				unit_cost: "",
				min_stock: "5",
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const payload = {
				name: formData.name,
				stock: Number(formData.stock),
				unit: formData.unit,
				unit_cost: Number(formData.unit_cost),
				min_stock: Number(formData.min_stock),
			};

			if (editingItem) {
				const { error } = await supabase
					.from("inventory")
					.update(payload)
					.eq("id", editingItem.id);
				if (error) throw error;
				showToast("Material actualizado");
			} else {
				const { error } = await supabase
					.from("inventory")
					.insert([{ ...payload, user_id: user.id }]);
				if (error) throw error;
				showToast("Material creado");
			}
			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (error) {
			showToast("Error al guardar", error);
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
					unit_cost: parseFloat(newUnitCost.toFixed(2)),
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

			showToast("Stock repuesto y coste actualizado");
			setIsRestockModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (error) {
			showToast("Error al reponer stock", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20">
			<div className="flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full md:max-w-md">
					<Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
					<input
						placeholder="Buscar material..."
						className="w-full pl-12 p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 ring-rose-100"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => openModal()}
					className="bg-[#f43f5e] hover:bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-rose-100 transition-all w-full md:w-auto justify-center">
					<Plus size={20} /> Nuevo Material
				</button>
			</div>

			{lowStockCount > 0 && (
				<div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-2xl flex items-start gap-4 shadow-sm">
					<div className="p-2 bg-white rounded-xl shadow-sm">
						<AlertTriangle className="text-[#d97706]" size={20} />
					</div>
					<div>
						<h4 className="font-bold text-[#92400e]">Stock Bajo Detectado</h4>
						<p className="text-sm text-[#b45309]">
							Tienes {lowStockCount} productos por debajo del mínimo. Revisa la
							lista.
						</p>
					</div>
				</div>
			)}

			<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
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
									<div className="inline-flex flex-col items-center">
										<span
											className={`px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${
												Number(item.stock) <= Number(item.min_stock)
													? "bg-rose-50 text-rose-600 border border-rose-100"
													: "bg-emerald-50 text-emerald-600 border border-emerald-100"
											}`}>
											{item.stock}
										</span>
										{Number(item.stock) <= Number(item.min_stock) && (
											<span className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tighter italic">
												¡Reponer!
											</span>
										)}
									</div>
								</td>
								<td className="p-6 text-center">
									<span className="font-bold text-gray-600 text-lg">
										{item.unit_cost} €
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
											onClick={async () => {
												if (confirm("¿Eliminar?")) {
													await supabase
														.from("inventory")
														.delete()
														.eq("id", item.id);
													if (onRefresh) await onRefresh();
												}
											}}
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
			{/* ... (Modales Nuevo Material y Reponer Stock, asegúrate de mantener el contenido interior igual, solo cambia el handleSave/handleRestock que ya puse arriba) */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-start p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] shadow-2xl flex flex-col h-[calc(100vh-100px)] mt-[0px] animate-in slide-in-from-top-4 duration-300 overflow-hidden">
						<div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
							<h3 className="text-2xl font-black text-gray-800 tracking-tight">
								{editingItem ? "Editar Material" : "Nuevo Material"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-2">
								<X size={24} />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
							<form
								onSubmit={handleSave}
								className="space-y-6 flex flex-col min-h-full">
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
										Nombre
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
								<div className="grid grid-cols-2 gap-4">
									<input
										type="number"
										placeholder="Stock"
										className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
										value={formData.stock}
										onChange={(e) =>
											setFormData({ ...formData, stock: e.target.value })
										}
									/>
									<input
										placeholder="Unidad"
										className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
										value={formData.unit}
										onChange={(e) =>
											setFormData({ ...formData, unit: e.target.value })
										}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<input
										type="number"
										step="0.01"
										placeholder="Coste Unit."
										className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
										value={formData.unit_cost}
										onChange={(e) =>
											setFormData({ ...formData, unit_cost: e.target.value })
										}
									/>
									<input
										type="number"
										placeholder="Mínimo"
										className="w-full p-4 bg-rose-50 text-rose-600 rounded-2xl outline-none font-bold"
										value={formData.min_stock}
										onChange={(e) =>
											setFormData({ ...formData, min_stock: e.target.value })
										}
									/>
								</div>
								<div className="mt-auto pt-8">
									<button className="w-full bg-[#f43f5e] text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg">
										Guardar Material
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
			{isRestockModalOpen && (
				<div className="fixed inset-0 z-[60] mt-[100px] flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setIsRestockModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
						<div className="flex justify-between items-start mb-6">
							<div>
								<h3 className="text-2xl font-black text-blue-600 tracking-tight">
									Reponer Stock
								</h3>
								<p className="text-gray-500 font-bold">
									Añadir unidades a{" "}
									<span className="text-gray-800">{restockItem?.name}</span>
								</p>
							</div>
							<button
								onClick={() => setIsRestockModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-1">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleRestock} className="space-y-6">
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									CANTIDAD COMPRADA
								</label>
								<div className="relative">
									<input
										type="number"
										required
										className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:border-blue-200 rounded-2xl outline-none font-bold text-xl transition-all"
										value={restockData.quantity}
										onChange={(e) =>
											setRestockData({
												...restockData,
												quantity: e.target.value,
											})
										}
									/>
									<span className="absolute right-4 top-4 text-gray-400 font-bold">
										{restockItem?.unit || "uds"}
									</span>
								</div>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									COSTE TOTAL DE LA COMPRA (€)
								</label>
								<input
									type="number"
									step="0.01"
									required
									placeholder="0.00"
									className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:border-blue-200 rounded-2xl outline-none font-bold text-xl transition-all"
									value={restockData.totalCost}
									onChange={(e) =>
										setRestockData({
											...restockData,
											totalCost: e.target.value,
										})
									}
								/>
								<p className="mt-2 text-[11px] text-gray-400 font-medium leading-relaxed">
									Pon lo que te ha costado la factura entera de este producto.
								</p>
							</div>
							<div className="bg-blue-50/50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100">
								<Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
								<p className="text-xs font-bold text-blue-700 leading-relaxed">
									Se recalculará el coste unitario automáticamente (Precio Medio
									Ponderado).
								</p>
							</div>
							<button
								disabled={loading}
								className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-100 transition-all text-lg flex justify-center">
								{loading ? (
									<Loader2 className="animate-spin" />
								) : (
									"Confirmar Compra"
								)}
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
