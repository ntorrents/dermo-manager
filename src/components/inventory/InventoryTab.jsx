import React, { useState } from "react";
import {
	Search,
	Plus,
	Package,
	AlertTriangle,
	ArrowDown,
	TrendingUp,
	X,
	Save,
	RefreshCw,
} from "lucide-react";
import {
	addDocument,
	updateDocument,
	deleteDocument,
} from "../../services/firestore";
import { formatCurrency } from "../../utils/format";

export const InventoryTab = ({ user, inventory, showToast }) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isRestockOpen, setIsRestockOpen] = useState(false); // Modal de reposición
	const [editingItem, setEditingItem] = useState(null);

	// Estado para Crear/Editar Producto
	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		unitCost: "",
		minStock: "5", // Nuevo campo: Alerta de stock bajo
	});

	// Estado para Reposición (Restock)
	const [restockData, setRestockData] = useState({
		quantity: "",
		totalCost: "",
	});

	// Filtrar inventario
	const filteredInventory = inventory.filter((item) =>
		item.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	// --- LÓGICA DE ALERTA ---
	const lowStockItems = inventory.filter((i) => i.stock <= (i.minStock || 5));

	// --- GESTIÓN DE PRODUCTOS (Crear/Editar) ---
	const openForm = (item = null) => {
		if (item) {
			setEditingItem(item);
			setFormData(item);
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				unitCost: "",
				minStock: "5",
			});
		}
		setIsFormOpen(true);
	};

	const handleSaveProduct = async (e) => {
		e.preventDefault();
		try {
			const dataToSave = {
				...formData,
				stock: Number(formData.stock),
				unitCost: Number(formData.unitCost),
				minStock: Number(formData.minStock),
			};

			if (editingItem) {
				await updateDocument(user.uid, "inventory", editingItem.id, dataToSave);
				showToast("Producto actualizado");
			} else {
				await addDocument(user.uid, "inventory", dataToSave);
				showToast("Producto creado");
			}
			setIsFormOpen(false);
		} catch (error) {
			console.error(error);
			showToast("Error al guardar", "error");
		}
	};

	const handleDelete = async (id) => {
		if (confirm("¿Eliminar este producto?")) {
			await deleteDocument(user.uid, "inventory", id);
			showToast("Producto eliminado");
		}
	};

	// --- GESTIÓN DE REPOSICIÓN (Cálculo PMP) ---
	const openRestock = (item) => {
		setEditingItem(item);
		setRestockData({ quantity: "", totalCost: "" });
		setIsRestockOpen(true);
	};

	const handleRestock = async (e) => {
		e.preventDefault();
		if (!editingItem) return;

		const quantityAdded = Number(restockData.quantity);
		const costOfPurchase = Number(restockData.totalCost);

		if (quantityAdded <= 0)
			return showToast("La cantidad debe ser positiva", "error");

		try {
			// 1. Calcular Valor Actual
			const currentValue = editingItem.stock * editingItem.unitCost;

			// 2. Calcular Nuevo Stock Total
			const newStock = editingItem.stock + quantityAdded;

			// 3. Calcular Nuevo Coste Unitario (PMP)
			// Si el stock era 0 o negativo, el nuevo precio es simplemente el de la compra
			let newUnitCost;
			if (editingItem.stock <= 0) {
				newUnitCost = costOfPurchase / quantityAdded;
			} else {
				// (Valor Viejo + Valor Nuevo) / Stock Total
				newUnitCost = (currentValue + costOfPurchase) / newStock;
			}

			// 4. Guardar en Firestore
			await updateDocument(user.uid, "inventory", editingItem.id, {
				stock: newStock,
				unitCost: newUnitCost, // Guardamos el precio promediado
			});

			showToast(
				`Stock actualizado. Nuevo precio medio: ${formatCurrency(newUnitCost)}`,
			);
			setIsRestockOpen(false);
		} catch (error) {
			console.error(error);
			showToast("Error al reponer stock", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* Header y Buscador */}
			<div className="flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full md:max-w-md">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar material..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 ring-rose-100 outline-none shadow-sm"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => openForm()}
					className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors w-full md:w-auto justify-center">
					<Plus size={20} /> Nuevo Material
				</button>
			</div>

			{/* ALERTA DE STOCK BAJO (Solo visible si hay productos bajos) */}
			{lowStockItems.length > 0 && (
				<div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-start gap-3">
					<AlertTriangle
						className="text-orange-500 shrink-0 mt-0.5"
						size={20}
					/>
					<div>
						<h4 className="font-bold text-orange-800 text-sm">
							Stock Bajo Detectado
						</h4>
						<p className="text-xs text-orange-600 mt-1">
							Tienes {lowStockItems.length} productos por debajo del mínimo.
							Revisa la lista.
						</p>
					</div>
				</div>
			)}

			{/* Tabla de Inventario */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
							<th className="p-4">Material</th>
							<th className="p-4 text-center">Stock</th>
							<th className="p-4 text-right hidden md:table-cell">
								Coste Unit.
							</th>
							<th className="p-4 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{filteredInventory.map((item) => {
							const isLowStock = item.stock <= (item.minStock || 5);
							return (
								<tr
									key={item.id}
									className={`hover:bg-gray-50/50 transition-colors ${isLowStock ? "bg-orange-50/30" : ""}`}>
									<td className="p-4">
										<div className="flex items-center gap-3">
											<div
												className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${isLowStock ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
												<Package size={20} />
											</div>
											<div>
												<p className="font-bold text-gray-900">{item.name}</p>
												<p className="text-xs text-gray-400">{item.unit}</p>
											</div>
										</div>
									</td>
									<td className="p-4 text-center">
										<span
											className={`px-3 py-1 rounded-full text-sm font-bold ${
												isLowStock
													? "bg-red-100 text-red-600 border border-red-200"
													: "bg-green-100 text-green-700 border border-green-200"
											}`}>
											{item.stock}
										</span>
										{isLowStock && (
											<p className="text-[10px] text-red-500 font-bold mt-1">
												¡Reponer!
											</p>
										)}
									</td>
									<td className="p-4 text-right hidden md:table-cell">
										<p className="text-sm font-medium text-gray-600">
											{formatCurrency(item.unitCost)}
										</p>
									</td>
									<td className="p-4 text-right">
										<div className="flex justify-end gap-2">
											{/* Botón Reponer */}
											<button
												onClick={() => openRestock(item)}
												className="p-2 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-lg shadow-sm transition-colors"
												title="Añadir Compra (Reponer)">
												<RefreshCw size={16} />
											</button>
											{/* Editar */}
											<button
												onClick={() => openForm(item)}
												className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
												<Save size={16} />
											</button>
											{/* Borrar */}
											<button
												onClick={() => handleDelete(item.id)}
												className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
												<X size={16} />
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* MODAL 1: CREAR / EDITAR PRODUCTO */}
			{isFormOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsFormOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-bold text-lg">
								{editingItem ? "Editar Material" : "Nuevo Material"}
							</h3>
							<button onClick={() => setIsFormOpen(false)}>
								<X className="text-gray-400" />
							</button>
						</div>
						<form onSubmit={handleSaveProduct} className="space-y-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Nombre
								</label>
								<input
									required
									className="w-full p-2 border rounded-xl"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-500 uppercase">
										Stock Actual
									</label>
									<input
										required
										type="number"
										className="w-full p-2 border rounded-xl"
										value={formData.stock}
										onChange={(e) =>
											setFormData({ ...formData, stock: e.target.value })
										}
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-500 uppercase">
										Unidad (ml, caja...)
									</label>
									<input
										className="w-full p-2 border rounded-xl"
										value={formData.unit}
										onChange={(e) =>
											setFormData({ ...formData, unit: e.target.value })
										}
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-500 uppercase">
										Coste Unitario (€)
									</label>
									<input
										required
										type="number"
										step="0.01"
										className="w-full p-2 border rounded-xl"
										value={formData.unitCost}
										onChange={(e) =>
											setFormData({ ...formData, unitCost: e.target.value })
										}
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-rose-500 uppercase">
										Alerta Mínima
									</label>
									<input
										type="number"
										className="w-full p-2 border border-rose-100 bg-rose-50 rounded-xl font-bold text-rose-700"
										value={formData.minStock}
										onChange={(e) =>
											setFormData({ ...formData, minStock: e.target.value })
										}
									/>
								</div>
							</div>
							<button className="w-full bg-rose-500 text-white font-bold py-3 rounded-xl hover:bg-rose-600 mt-2">
								Guardar
							</button>
						</form>
					</div>
				</div>
			)}

			{/* MODAL 2: REPONER STOCK (Cálculo PMP) */}
			{isRestockOpen && editingItem && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsRestockOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
						<div className="flex justify-between items-center mb-1">
							<h3 className="font-bold text-lg text-blue-600">Reponer Stock</h3>
							<button onClick={() => setIsRestockOpen(false)}>
								<X className="text-gray-400" />
							</button>
						</div>
						<p className="text-sm text-gray-500 mb-4">
							Añadir unidades a <strong>{editingItem.name}</strong>
						</p>

						<form onSubmit={handleRestock} className="space-y-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Cantidad Comprada
								</label>
								<div className="relative">
									<input
										required
										type="number"
										className="w-full p-3 pl-3 border rounded-xl font-bold text-lg"
										placeholder="0"
										value={restockData.quantity}
										onChange={(e) =>
											setRestockData({
												...restockData,
												quantity: e.target.value,
											})
										}
									/>
									<span className="absolute right-3 top-3.5 text-gray-400 text-sm">
										{editingItem.unit}
									</span>
								</div>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Coste TOTAL de la compra (€)
								</label>
								<input
									required
									type="number"
									step="0.01"
									className="w-full p-3 border rounded-xl font-bold text-lg"
									placeholder="0.00"
									value={restockData.totalCost}
									onChange={(e) =>
										setRestockData({
											...restockData,
											totalCost: e.target.value,
										})
									}
								/>
								<p className="text-xs text-gray-400 mt-1">
									Pon lo que te ha costado la factura entera de este producto.
								</p>
							</div>

							<div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800">
								<p>
									ℹ️ Se recalculará el coste unitario automáticamente (Precio
									Medio Ponderado).
								</p>
							</div>

							<button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 mt-2 shadow-lg shadow-blue-200">
								Confirmar Compra
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
