// /Users/nilto/Documents/GitHub/DermoManager/src/components/finance/FinanceTab.jsx
import React, { useState, useMemo } from "react";
import {
	Briefcase,
	Trash2,
	X,
	Zap,
	Check,
	TrendingUp,
	TrendingDown,
} from "lucide-react";
import { addDocument, deleteDocument } from "../../services/firestore";
import { formatCurrency } from "../../utils/format";

export const FinanceTab = ({
	user,
	entries,
	recurringConfig,
	currentMonth,
	showToast,
}) => {
	const [showRecurringModal, setShowRecurringModal] = useState(false);
	const [newRecurring, setNewRecurring] = useState({ name: "", amount: "" });
	const [showManualEntryModal, setShowManualEntryModal] = useState(false);
	const [manualEntry, setManualEntry] = useState({
		description: "",
		amount: "",
		category: "Otros",
		type: "expense",
	});
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);

	const filteredEntries = useMemo(
		() => entries.filter((e) => e.date.startsWith(currentMonth)),
		[entries, currentMonth],
	);
	const income = filteredEntries
		.filter((e) => e.type === "income")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenses = filteredEntries
		.filter((e) => e.type === "expense")
		.reduce((acc, c) => acc + c.amount, 0);

	const addRecurringConfig = async () => {
		if (!newRecurring.name || !newRecurring.amount) return;
		await addDocument(user.uid, "recurring_config", {
			name: newRecurring.name,
			amount: Number(newRecurring.amount),
		});
		setNewRecurring({ name: "", amount: "" });
	};

	const payRecurring = async (configItem) => {
		await addDocument(user.uid, "finance_entries", {
			date: new Date().toISOString().split("T")[0],
			type: "expense",
			category: "Fijo",
			description: configItem.name,
			amount: configItem.amount,
			recurringId: configItem.id,
			monthKey: currentMonth,
		});
		showToast("Pago registrado");
	};

	const addManualEntry = async () => {
		if (!manualEntry.amount) return;
		await addDocument(user.uid, "finance_entries", {
			date: new Date().toISOString().split("T")[0],
			type: manualEntry.type,
			category: manualEntry.category,
			description: manualEntry.description,
			amount: Number(manualEntry.amount),
			isManual: true,
		});
		setManualEntry({
			description: "",
			amount: "",
			category: "Otros",
			type: "expense",
		});
		setShowManualEntryModal(false);
	};

	const deleteEntry = async (id) => {
		if (confirmDeleteId !== id) {
			setConfirmDeleteId(id);
			setTimeout(() => setConfirmDeleteId(null), 4000);
			return;
		}
		await deleteDocument(user.uid, "finance_entries", id);
		setConfirmDeleteId(null);
	};

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold">Finanzas</h2>
				<button
					onClick={() => setShowRecurringModal(!showRecurringModal)}
					className="bg-white border text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2">
					<Briefcase size={16} /> Config. Fijos
				</button>
			</div>

			{showRecurringModal && (
				<div className="bg-gray-100 p-4 rounded-2xl border border-gray-200 animate-in fade-in">
					<h4 className="font-bold text-sm text-gray-700 mb-3">
						Configurar gasto mensual
					</h4>
					<div className="flex gap-2 mb-4">
						<input
							placeholder="Nombre"
							className="flex-1 p-2 rounded-lg border text-sm"
							value={newRecurring.name}
							onChange={(e) =>
								setNewRecurring({ ...newRecurring, name: e.target.value })
							}
						/>
						<input
							type="number"
							placeholder="€"
							className="w-24 p-2 rounded-lg border text-sm"
							value={newRecurring.amount}
							onChange={(e) =>
								setNewRecurring({ ...newRecurring, amount: e.target.value })
							}
						/>
						<button
							onClick={addRecurringConfig}
							className="bg-gray-800 text-white px-4 rounded-lg text-sm font-bold">
							Añadir
						</button>
					</div>
					<div className="space-y-2">
						{recurringConfig.map((c) => (
							<div
								key={c.id}
								className="flex justify-between items-center text-sm bg-white p-2 rounded border">
								<span>
									{c.name} ({c.amount}€)
								</span>
								<button
									onClick={() =>
										deleteDocument(user.uid, "recurring_config", c.id)
									}
									className="text-red-400 hover:text-red-600">
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{showManualEntryModal && (
				<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 animate-in zoom-in-95 mb-4">
					<div className="flex justify-between mb-4">
						<h3 className="font-bold">
							{manualEntry.type === "income"
								? "Registrar Ingreso"
								: "Registrar Gasto"}
						</h3>
						<button onClick={() => setShowManualEntryModal(false)}>
							<X size={20} />
						</button>
					</div>
					<div className="grid gap-4">
						<input
							className="w-full p-3 border rounded-xl"
							placeholder="Concepto"
							value={manualEntry.description}
							onChange={(e) =>
								setManualEntry({ ...manualEntry, description: e.target.value })
							}
						/>
						<div className="flex gap-2">
							<input
								type="number"
								className="flex-1 p-3 border rounded-xl"
								placeholder="Importe (€)"
								value={manualEntry.amount}
								onChange={(e) =>
									setManualEntry({ ...manualEntry, amount: e.target.value })
								}
							/>
							{manualEntry.type === "expense" && (
								<select
									className="flex-1 p-3 border rounded-xl bg-white"
									value={manualEntry.category}
									onChange={(e) =>
										setManualEntry({ ...manualEntry, category: e.target.value })
									}>
									<option>Otros</option>
									<option>Mobiliario</option>
									<option>Transporte</option>
									<option>Impuestos</option>
									<option>Formación</option>
								</select>
							)}
						</div>
						<button
							onClick={addManualEntry}
							className={`w-full text-white font-bold py-3 rounded-xl ${manualEntry.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`}>
							Guardar
						</button>
					</div>
				</div>
			)}

			{recurringConfig.length > 0 && (
				<div className="mb-6">
					<h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
						Pagos Recurrentes (
						{new Date(currentMonth).toLocaleString("es-ES", { month: "long" })})
					</h3>
					<div className="flex gap-3 overflow-x-auto pb-2">
						{recurringConfig.map((conf) => {
							const isPaid = filteredEntries.some(
								(e) => e.recurringId === conf.id,
							);
							return (
								<button
									key={conf.id}
									onClick={() => !isPaid && payRecurring(conf)}
									disabled={isPaid}
									className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${isPaid ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-orange-200 text-gray-700 hover:border-orange-400 shadow-sm"}`}>
									{isPaid ? (
										<Check size={14} />
									) : (
										<Zap size={14} className="text-orange-500" />
									)}{" "}
									{conf.name}
								</button>
							);
						})}
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="flex flex-col gap-4">
					<div className="flex justify-between items-end">
						<div>
							<h3 className="font-bold text-gray-700 flex items-center gap-2">
								<TrendingUp className="text-emerald-500" /> Ingresos
							</h3>
							<p className="text-2xl font-bold text-emerald-600">
								{formatCurrency(income)}
							</p>
						</div>
						<button
							onClick={() => {
								setManualEntry({
									...manualEntry,
									type: "income",
									category: "Extra",
								});
								setShowManualEntryModal(true);
							}}
							className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100">
							+ Ingreso Extra
						</button>
					</div>
					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
						<div className="divide-y divide-gray-100">
							{filteredEntries
								.filter((e) => e.type === "income")
								.map((e) => (
									<div
										key={e.id}
										className="p-3 flex justify-between items-center hover:bg-gray-50">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{e.description}
											</p>
											<p className="text-xs text-gray-400">
												{e.date} • {e.category}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-bold text-emerald-600">
												+{e.amount}€
											</span>
											<button
												onClick={() => deleteEntry(e.id)}
												className="text-gray-300 hover:text-red-400">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<div className="flex justify-between items-end">
						<div>
							<h3 className="font-bold text-gray-700 flex items-center gap-2">
								<TrendingDown className="text-rose-500" /> Gastos
							</h3>
							<p className="text-2xl font-bold text-rose-600">
								{formatCurrency(expenses)}
							</p>
						</div>
						<button
							onClick={() => {
								setManualEntry({
									...manualEntry,
									type: "expense",
									category: "Otros",
								});
								setShowManualEntryModal(true);
							}}
							className="text-xs bg-rose-50 text-rose-700 font-bold px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100">
							+ Registrar Gasto
						</button>
					</div>
					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
						<div className="divide-y divide-gray-100">
							{filteredEntries
								.filter((e) => e.type === "expense")
								.map((e) => (
									<div
										key={e.id}
										className="p-3 flex justify-between items-center hover:bg-gray-50">
										<div className="flex items-center gap-2">
											<div
												className={`w-1.5 h-1.5 rounded-full ${e.category === "Material" ? "bg-blue-400" : e.category === "Fijo" ? "bg-orange-400" : "bg-purple-400"}`}></div>
											<div>
												<p className="font-bold text-gray-800 text-sm">
													{e.description}
												</p>
												<p className="text-xs text-gray-400">
													{e.date} • {e.category}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-bold text-rose-600">
												-{e.amount}€
											</span>
											<button
												onClick={() => deleteEntry(e.id)}
												className={`text-gray-300 hover:text-red-400 transition-all ${confirmDeleteId === e.id ? "text-red-500 scale-125" : ""}`}>
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
