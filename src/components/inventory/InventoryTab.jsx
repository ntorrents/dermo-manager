// /Users/nilto/Documents/GitHub/DermoManager/src/components/inventory/InventoryTab.jsx
import React, { useState } from "react";
import { Search, Plus, Pencil } from "lucide-react";
import { addDocument, updateDocument } from "../../services/firestore";

export const InventoryTab = ({ user, inventory, showToast }) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [showAddInv, setShowAddInv] = useState(false);
	const [editingInv, setEditingInv] = useState(null);
	const [newInv, setNewInv] = useState({ name: "", unitCost: "", stock: "" });

	const saveInventory = async () => {
		if (!newInv.name) return;
		try {
			const data = {
				...newInv,
				unitCost: Number(newInv.unitCost),
				stock: Number(newInv.stock),
			};
			if (editingInv)
				await updateDocument(user.uid, "inventory", editingInv.id, data);
			else
				await addDocument(user.uid, "inventory", {
					...data,
					createdAt: new Date().toISOString(),
				});

			setNewInv({ name: "", unitCost: "", stock: "" });
			setEditingInv(null);
			setShowAddInv(false);
		} catch (e) {
			showToast("Error al guardar: ", e);
		}
	};

	const handleAddStock = async (item, qty, cost) => {
		await updateDocument(user.uid, "inventory", item.id, {
			stock: item.stock + Number(qty),
		});
		if (cost > 0) {
			await addDocument(user.uid, "finance_entries", {
				date: new Date().toISOString().split("T")[0],
				type: "expense",
				expenseType: "STOCK",
				category: "Material",
				description: `Compra Stock: ${item.name}`,
				amount: Number(cost),
				createdAt: new Date().toISOString(),
			});
		}
		showToast("Stock actualizado");
	};

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex justify-between items-center gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar material..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 ring-rose-200 outline-none"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => {
						setEditingInv(null);
						setNewInv({ name: "", unitCost: "", stock: "" });
						setShowAddInv(!showAddInv);
					}}
					className="bg-rose-500 text-white p-3 rounded-xl shadow-lg">
					<Plus />
				</button>
			</div>

			{showAddInv && (
				<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 mb-6">
					<h3 className="font-bold mb-4 text-gray-800">
						{editingInv ? "Editar Material" : "Nuevo Material"}
					</h3>
					<div className="flex flex-wrap gap-4 items-end">
						<div className="flex-1 min-w-[200px]">
							<label className="text-xs font-bold text-gray-500">Nombre</label>
							<input
								className="w-full p-3 border rounded-xl"
								value={newInv.name}
								onChange={(e) => setNewInv({ ...newInv, name: e.target.value })}
							/>
						</div>
						<div className="w-24">
							<label className="text-xs font-bold text-gray-500">
								Coste/ud
							</label>
							<input
								type="number"
								className="w-full p-3 border rounded-xl"
								value={newInv.unitCost}
								onChange={(e) =>
									setNewInv({ ...newInv, unitCost: e.target.value })
								}
							/>
						</div>
						<div className="w-24">
							<label className="text-xs font-bold text-gray-500">Stock</label>
							<input
								type="number"
								className="w-full p-3 border rounded-xl"
								value={newInv.stock}
								onChange={(e) =>
									setNewInv({ ...newInv, stock: e.target.value })
								}
							/>
						</div>
						<button
							onClick={saveInventory}
							className="bg-rose-500 text-white px-6 py-3 rounded-xl font-bold h-[50px]">
							Guardar
						</button>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{inventory
					.filter((i) =>
						i.name.toLowerCase().includes(searchTerm.toLowerCase()),
					)
					.map((item) => (
						<div
							key={item.id}
							className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<p className="font-bold text-gray-800">{item.name}</p>
									<button
										onClick={() => {
											setEditingInv(item);
											setNewInv(item);
											setShowAddInv(true);
										}}
										className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
										<Pencil size={14} />
									</button>
								</div>
								<p className="text-xs text-gray-400 font-mono">
									Coste: {item.unitCost}€
								</p>
							</div>
							<div className="flex items-center gap-3">
								<div
									className={`flex flex-col items-end ${item.stock < 5 ? "text-red-500" : "text-gray-600"}`}>
									<span className="text-xl font-bold">{item.stock}</span>
									<span className="text-[10px] font-bold uppercase tracking-wider">
										Stock
									</span>
								</div>
								<button
									onClick={() => {
										const q = prompt("Cant?");
										if (q) handleAddStock(item, q, prompt("Coste total?"));
									}}
									className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100">
									<Plus size={20} />
								</button>
							</div>
						</div>
					))}
			</div>
		</div>
	);
};
