// /Users/nilto/Documents/GitHub/DermoManager/src/components/treatments/TreatmentsTab.jsx
import React, { useState } from "react";
import { Search, Plus, Pencil, X, Trash2 } from "lucide-react";
import {
	addDocument,
	updateDocument,
	deleteDocument,
} from "../../services/firestore";

export const TreatmentsTab = ({
	user,
	treatments,
	inventory,
	showToast,
	onSelectTreatment,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [showAddTreat, setShowAddTreat] = useState(false);
	const [editingTreat, setEditingTreat] = useState(null);
	const [newTreat, setNewTreat] = useState({ name: "", price: "" });
	const [tempRecipe, setTempRecipe] = useState([]);
	const [recipeItem, setRecipeItem] = useState({ materialId: "", quantity: 1 });

	const addToRecipe = () => {
		if (!recipeItem.materialId) return;
		setTempRecipe([
			...tempRecipe,
			{
				materialId: recipeItem.materialId,
				quantity: Number(recipeItem.quantity),
			},
		]);
		setRecipeItem({ materialId: "", quantity: 1 });
	};

	const saveTreatment = async () => {
		if (!newTreat.name) return;
		const data = {
			name: newTreat.name,
			price: Number(newTreat.price),
			recipe: tempRecipe,
		};
		try {
			if (editingTreat)
				await updateDocument(user.uid, "treatments", editingTreat.id, data);
			else
				await addDocument(user.uid, "treatments", {
					...data,
					createdAt: new Date().toISOString(),
				});
			setNewTreat({ name: "", price: "" });
			setTempRecipe([]);
			setEditingTreat(null);
			setShowAddTreat(false);
		} catch (e) {
			showToast("Error al guardar: ", e);
		}
	};

	const calculateTreatmentCost = (recipe) =>
		recipe?.reduce((total, r) => {
			const item = inventory.find((m) => m.id === r.materialId);
			return total + (item ? item.unitCost * r.quantity : 0);
		}, 0) || 0;

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex justify-between items-center gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar tratamiento..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 ring-rose-200 outline-none"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => {
						setEditingTreat(null);
						setNewTreat({ name: "", price: "" });
						setTempRecipe([]);
						setShowAddTreat(!showAddTreat);
					}}
					className="bg-rose-500 text-white p-3 rounded-xl shadow-lg">
					<Plus />
				</button>
			</div>

			{showAddTreat && (
				<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 mb-6">
					<h3 className="font-bold mb-4 text-gray-800">
						{editingTreat ? "Editar Tratamiento" : "Nuevo Tratamiento"}
					</h3>
					<div className="grid grid-cols-2 gap-4 mb-4">
						<input
							className="p-3 border rounded-xl w-full"
							placeholder="Nombre"
							value={newTreat.name}
							onChange={(e) =>
								setNewTreat({ ...newTreat, name: e.target.value })
							}
						/>
						<input
							type="number"
							className="p-3 border rounded-xl w-full"
							placeholder="Precio (€)"
							value={newTreat.price}
							onChange={(e) =>
								setNewTreat({ ...newTreat, price: e.target.value })
							}
						/>
					</div>
					<div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200">
						<p className="text-xs font-bold text-gray-500 uppercase mb-2">
							Receta (Materiales)
						</p>
						<div className="flex gap-2 mb-2">
							<select
								className="flex-1 p-2 border rounded-lg"
								value={recipeItem.materialId}
								onChange={(e) =>
									setRecipeItem({ ...recipeItem, materialId: e.target.value })
								}>
								<option value="">Seleccionar material...</option>
								{inventory.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name}
									</option>
								))}
							</select>
							<input
								type="number"
								className="w-20 p-2 border rounded-lg"
								placeholder="Cant."
								value={recipeItem.quantity}
								onChange={(e) =>
									setRecipeItem({ ...recipeItem, quantity: e.target.value })
								}
							/>
							<button
								onClick={addToRecipe}
								className="bg-gray-200 px-3 rounded-lg">
								<Plus size={16} />
							</button>
						</div>
						<div className="flex flex-wrap gap-2">
							{tempRecipe.map((r, i) => {
								const mat = inventory.find((m) => m.id === r.materialId);
								return (
									<span
										key={i}
										className="text-xs bg-white border px-2 py-1 rounded-full flex items-center gap-1">
										{mat?.name} <b className="text-rose-500">x{r.quantity}</b>{" "}
										<button
											onClick={() =>
												setTempRecipe(tempRecipe.filter((_, ix) => ix !== i))
											}>
											<X size={12} />
										</button>
									</span>
								);
							})}
						</div>
					</div>
					<button
						onClick={saveTreatment}
						className="w-full bg-rose-500 text-white font-bold py-3 rounded-xl">
						Guardar Tratamiento
					</button>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{treatments
					.filter((t) =>
						t.name.toLowerCase().includes(searchTerm.toLowerCase()),
					)
					.map((t) => {
						const cost = calculateTreatmentCost(t.recipe);
						const profit = t.price - cost;
						return (
							<div
								key={t.id}
								className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
								<div className="flex justify-between items-start mb-2">
									<h3 className="font-bold text-gray-800 text-lg">{t.name}</h3>
									<button
										onClick={() => {
											setEditingTreat(t);
											setNewTreat({ name: t.name, price: t.price });
											setTempRecipe(t.recipe);
											setShowAddTreat(true);
										}}
										className="text-gray-300 hover:text-blue-500">
										<Pencil size={16} />
									</button>
								</div>
								<div className="flex items-baseline gap-2 mb-4">
									<span className="text-2xl font-bold text-rose-500">
										{t.price}€
									</span>
									<span className="text-xs text-gray-400">PVP</span>
								</div>
								<div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
									<div className="flex justify-between text-xs text-gray-500">
										<span>Coste Material</span>
										<span>{cost.toFixed(2)}€</span>
									</div>
									<div className="flex justify-between text-xs font-bold text-emerald-600">
										<span>Beneficio</span>
										<span>{profit.toFixed(2)}€</span>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => {
											if (confirm("¿Borrar?"))
												deleteDocument(user.uid, "treatments", t.id);
										}}
										className="p-2 text-gray-300 hover:text-red-500 bg-gray-50 rounded-lg">
										<Trash2 size={18} />
									</button>
									<button
										onClick={() => onSelectTreatment(t)}
										className="flex-1 bg-gray-900 text-white rounded-lg font-bold text-sm py-2 hover:bg-black">
										Realizar Sesión
									</button>
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
};
