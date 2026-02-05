/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from "react";
import {
	Plus,
	TrendingUp,
	TrendingDown,
	Search,
	FileSpreadsheet,
	Settings,
	Trash2,
	CheckCircle2,
	AlertCircle,
	X,
	ArrowRight,
	Loader2,
	Calendar,
	Edit2,
	FileText,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { formatCurrency, formatDate } from "../../utils/format";
import { exportToCSV } from "../../utils/export";
import { filterByDate, getDateLabel } from "../../utils/dateUtils"; // IMPORTANTE

export const FinanceTab = ({
	user,
	entries = [],
	currentDate,
	setCurrentDate,
	viewMode,
	setViewMode,
	showToast,
	onRefresh,
}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isConfigOpen, setIsConfigOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");

	// Eliminamos viewMode local porque ahora viene de props

	const [recurringExpenses, setRecurringExpenses] = useState([]);
	const [loadingConfig, setLoadingConfig] = useState(true);

	// Estado para Edición
	const [editingEntry, setEditingEntry] = useState(null);

	const [formData, setFormData] = useState({
		type: "expense",
		amount: "",
		category: "General",
		description: "",
		date: new Date().toISOString().split("T")[0],
		notes: "", // Campo Notas
	});

	const fetchConfig = async () => {
		try {
			setLoadingConfig(true);
			const { data, error } = await supabase
				.from("recurring_config")
				.select("*")
				.eq("user_id", user.id);
			if (error) throw error;
			setRecurringExpenses(data || []);
		} catch (error) {
			console.error("Error cargando fijos:", error);
		} finally {
			setLoadingConfig(false);
		}
	};

	useEffect(() => {
		if (user) fetchConfig();
	}, [user]);

	// LÓGICA FILTRADO GLOBAL
	const filteredEntries = useMemo(() => {
		const dateFiltered = filterByDate(entries, "date", viewMode, currentDate);

		return dateFiltered
			.filter(
				(e) =>
					e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					e.category?.toLowerCase().includes(searchTerm.toLowerCase())
			)
			.sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [entries, currentDate, searchTerm, viewMode]);

	const totalIncome = filteredEntries
		.filter((e) => e.type === "income")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const totalExpense = filteredEntries
		.filter((e) => e.type === "expense")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const netProfit = totalIncome - totalExpense;

	const getFixedStatus = (expense) => {
		// Buscamos si se pagó en el mes actual (incluso si la vista es anual, el estatus es del mes seleccionado)
		const found = entries
			.filter((e) => e.date.startsWith(currentDate))
			.find(
				(e) =>
					e.category === "Fijo" &&
					e.description.toLowerCase().includes(expense.category.toLowerCase())
			);
		return found ? { paid: true, date: found.date } : { paid: false };
	};

	// Acepta un entry opcional para editar
	const openEntryModal = (type, entry = null) => {
		if (entry) {
			setEditingEntry(entry);
			setFormData({
				type: entry.type,
				amount: entry.amount,
				category: entry.category,
				description: entry.description,
				date: entry.date,
				notes: entry.notes || "",
			});
		} else {
			setEditingEntry(null);
			setFormData({
				type,
				amount: "",
				category: type === "income" ? "Servicio" : "Material",
				description: "",
				date: new Date().toISOString().split("T")[0],
				notes: "",
			});
		}
		setIsModalOpen(true);
	};

	const handleSaveEntry = async (e) => {
		e.preventDefault();
		try {
			const payload = {
				...formData,
				amount: Number(formData.amount),
				user_id: user.id,
			};

			if (editingEntry) {
				// ACTUALIZAR
				const { error } = await supabase
					.from("finance_entries")
					.update(payload)
					.eq("id", editingEntry.id);
				if (error) throw error;
				showToast("Movimiento actualizado");
			} else {
				// CREAR
				const { error } = await supabase
					.from("finance_entries")
					.insert([payload]);
				if (error) throw error;
				showToast("Movimiento registrado");
			}

			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (error) {
			showToast("Error al guardar", "error");
		}
	};

	const payFixedExpense = async (expense) => {
		if (confirm(`¿Confirmar pago de ${expense.category}?`)) {
			try {
				const selectedDate =
					currentDate === new Date().toISOString().slice(0, 7)
						? new Date().toISOString().split("T")[0]
						: `${currentDate}-01`;
				const { error } = await supabase.from("finance_entries").insert([
					{
						user_id: user.id,
						type: "expense",
						amount: Number(expense.amount),
						category: "Fijo",
						description: expense.category,
						date: selectedDate,
						notes: "Pago recurrente automático",
					},
				]);
				if (error) throw error;
				showToast(`Pago de ${expense.category} registrado ✅`);
				if (onRefresh) await onRefresh();
			} catch (error) {
				showToast("Error al registrar pago", error);
			}
		}
	};

	const handleDelete = async (id) => {
		if (confirm("¿Eliminar movimiento?")) {
			const { error } = await supabase
				.from("finance_entries")
				.delete()
				.eq("id", id);
			if (error) showToast("Error al eliminar", "error");
			else {
				showToast("Eliminado");
				if (onRefresh) await onRefresh();
			}
		}
	};

	const handleSaveConfig = async (e) => {
		e.preventDefault();
		try {
			await supabase.from("recurring_config").delete().eq("user_id", user.id);
			const toInsert = recurringExpenses
				.filter((exp) => exp.category && exp.amount > 0)
				.map((exp) => ({
					user_id: user.id,
					category: exp.category,
					amount: Number(exp.amount),
				}));
			if (toInsert.length > 0) {
				const { error } = await supabase
					.from("recurring_config")
					.insert(toInsert);
				if (error) throw error;
			}
			showToast("Configuración guardada");
			setIsConfigOpen(false);
			fetchConfig();
		} catch (error) {
			showToast("Error al configurar", error);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
				<div>
					<p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">
						Balance {getDateLabel(currentDate, viewMode)}
					</p>
					<h2
						className={`text-4xl font-black tracking-tighter ${
							netProfit >= 0 ? "text-gray-800" : "text-rose-500"
						}`}>
						{formatCurrency(netProfit)}
					</h2>
				</div>
				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
					<div className="relative">
						<Calendar
							className="absolute left-3 top-2.5 text-gray-400"
							size={16}
						/>
						<input
							type="month"
							value={currentDate}
							onChange={(e) => setCurrentDate(e.target.value)}
							className="pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none cursor-pointer"
						/>
					</div>
					<select
						value={viewMode}
						onChange={(e) => setViewMode(e.target.value)}
						className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none cursor-pointer">
						<option value="month">Mensual</option>
						<option value="quarter">Trimestral</option>
						<option value="year">Anual</option>
					</select>
					<button
						onClick={() =>
							exportToCSV(filteredEntries, `Finanzas_${currentDate}.csv`)
						}
						className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 transition-colors hover:bg-emerald-100">
						<FileSpreadsheet size={20} />
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* COLUMNA 1: INGRESOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
							<TrendingUp size={16} className="text-emerald-500" /> Ingresos
						</h3>
						<span className="text-emerald-600 font-black">
							{formatCurrency(totalIncome)}
						</span>
					</div>
					<button
						onClick={() => openEntryModal("income")}
						className="w-full py-4 border-2 border-dashed border-emerald-100 bg-emerald-50/30 text-emerald-600 rounded-2xl font-black hover:bg-emerald-50 transition-all flex justify-center items-center gap-2">
						<Plus size={18} /> Añadir Ingreso
					</button>
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{filteredEntries.filter((e) => e.type === "income").length > 0 ? (
							filteredEntries
								.filter((e) => e.type === "income")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b border-gray-50 last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date}
											</p>
											{entry.notes && (
												<p className="text-[10px] text-gray-400 italic mt-0.5 flex items-center gap-1">
													<FileText size={8} /> {entry.notes}
												</p>
											)}
										</div>
										<div className="flex items-center gap-2">
											<span className="font-black text-emerald-500 mr-1">
												+{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("income", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Edit2 size={14} />
											</button>
											<button
												onClick={() => handleDelete(entry.id)}
												className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))
						) : (
							<div className="p-10 text-center text-gray-300 text-xs font-bold uppercase italic tracking-widest">
								Sin ingresos
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA 2: GASTOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
							<TrendingDown size={16} className="text-rose-500" /> Gastos
						</h3>
						<span className="text-rose-600 font-black">
							{formatCurrency(totalExpense)}
						</span>
					</div>
					<button
						onClick={() => openEntryModal("expense")}
						className="w-full py-4 border-2 border-dashed border-rose-100 bg-rose-50/30 text-rose-600 rounded-2xl font-black hover:bg-rose-50 transition-all flex justify-center items-center gap-2">
						<Plus size={18} /> Añadir Gasto
					</button>
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{filteredEntries.filter((e) => e.type === "expense").length > 0 ? (
							filteredEntries
								.filter((e) => e.type === "expense")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b border-gray-50 last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date} •{" "}
												<span className="text-rose-400">{entry.category}</span>
											</p>
											{entry.notes && (
												<p className="text-[10px] text-gray-400 italic mt-0.5 flex items-center gap-1">
													<FileText size={8} /> {entry.notes}
												</p>
											)}
										</div>
										<div className="flex items-center gap-2">
											<span className="font-black text-rose-500 mr-1">
												-{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("expense", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Edit2 size={14} />
											</button>
											<button
												onClick={() => handleDelete(entry.id)}
												className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))
						) : (
							<div className="p-10 text-center text-gray-300 text-xs font-bold uppercase italic tracking-widest">
								Sin gastos
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA 3: CONTROL DE FIJOS (Se queda igual) */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest">
							Control de Fijos
						</h3>
						<button
							onClick={() => setIsConfigOpen(true)}
							className="text-[10px] font-black text-gray-400 hover:text-rose-500 flex items-center gap-1 uppercase tracking-widest italic transition-colors">
							<Settings size={14} /> Configurar
						</button>
					</div>

					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 space-y-3">
						<div className="flex items-center gap-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">
							<span className="flex items-center gap-1 text-emerald-500">
								<CheckCircle2 size={12} /> Pagado
							</span>
							<span className="flex items-center gap-1 text-rose-500">
								<ArrowRight size={12} /> Pendiente
							</span>
						</div>

						{loadingConfig ? (
							<div className="flex justify-center py-4 text-rose-500">
								<Loader2 className="animate-spin" />
							</div>
						) : recurringExpenses.length > 0 ? (
							recurringExpenses.map((exp, idx) => {
								const status = getFixedStatus(exp);
								return (
									<div
										key={idx}
										className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
											status.paid
												? "bg-emerald-50/30 border-emerald-100 shadow-none"
												: "bg-white border-gray-100 shadow-sm hover:border-rose-100"
										}`}>
										<div>
											<p className="font-black text-gray-800 text-sm leading-tight">
												{exp.category}
											</p>
											<p className="text-xs text-gray-400 font-bold">
												{formatCurrency(exp.amount)}
											</p>
											{status.paid && (
												<p className="text-[10px] text-emerald-600 font-black uppercase mt-1">
													Registrado
												</p>
											)}
										</div>
										{status.paid ? (
											<CheckCircle2 size={22} className="text-emerald-500" />
										) : (
											<button
												onClick={() => payFixedExpense(exp)}
												className="bg-[#f43f5e] hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-md transition-all active:scale-95">
												Pagar
											</button>
										)}
									</div>
								);
							})
						) : (
							<div className="p-10 text-center border-2 border-dashed border-gray-50 rounded-[2rem] flex flex-col items-center gap-2">
								<AlertCircle className="text-gray-200" size={32} />
								<p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-tight">
									Configura tus gastos fijos para controlarlos aquí
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Modal Crear/Editar Movimiento */}
			{isModalOpen && (
				<div className="fixed inset-0 z-[9999] flex justify-center items-start p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-md rounded-t-[2.5rem] shadow-2xl flex flex-col h-[calc(100vh-100px)] mt-[0px] animate-in slide-in-from-top-4 duration-300 overflow-hidden">
						<div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
							<h3
								className={`text-2xl font-black uppercase italic tracking-tighter ${
									formData.type === "income"
										? "text-emerald-500"
										: "text-rose-500"
								}`}>
								{editingEntry
									? "Editar Movimiento"
									: formData.type === "income"
									? "Registrar Ingreso"
									: "Registrar Gasto"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="text-gray-400 hover:text-gray-600">
								<X size={24} />
							</button>
						</div>
						<form
							onSubmit={handleSaveEntry}
							className="p-8 space-y-6 flex-1 overflow-y-auto bg-white custom-scrollbar">
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									Concepto / Descripción
								</label>
								<input
									required
									className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-gray-800"
									placeholder="Ej. Sesión Dermapen..."
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
										Importe (€)
									</label>
									<input
										required
										type="number"
										step="0.01"
										className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-black text-xl"
										placeholder="0.00"
										value={formData.amount}
										onChange={(e) =>
											setFormData({ ...formData, amount: e.target.value })
										}
									/>
								</div>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
										Fecha
									</label>
									<input
										type="date"
										required
										className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm"
										value={formData.date}
										onChange={(e) =>
											setFormData({ ...formData, date: e.target.value })
										}
									/>
								</div>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									Categoría
								</label>
								<select
									className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
									value={formData.category}
									onChange={(e) =>
										setFormData({ ...formData, category: e.target.value })
									}>
									{formData.type === "income" ? (
										<>
											{" "}
											<option>Servicio</option> <option>Producto</option>{" "}
											<option>Otros</option>{" "}
										</>
									) : (
										<>
											{" "}
											<option>Material</option> <option>Alquiler</option>{" "}
											<option>Marketing</option> <option>Suministros</option>{" "}
											<option>Otros</option>{" "}
										</>
									)}
								</select>
							</div>

							{/* CAMPO NOTAS AÑADIDO */}
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
									Notas Adicionales
								</label>
								<textarea
									rows="2"
									placeholder="Detalles extra..."
									className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-gray-800 resize-none"
									value={formData.notes}
									onChange={(e) =>
										setFormData({ ...formData, notes: e.target.value })
									}
								/>
							</div>

							<div className="mt-auto pt-8">
								<button
									className={`w-full text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg transition-all ${
										formData.type === "income"
											? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100"
											: "bg-rose-500 hover:bg-rose-600 shadow-rose-100"
									}`}>
									{editingEntry ? "Guardar Cambios" : "Confirmar Movimiento"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{/* Modal Configuración Fijos (Se queda igual) */}
			{isConfigOpen && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setIsConfigOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
						<div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
							<div>
								<h3 className="text-2xl font-black text-gray-800 tracking-tighter italic">
									Gastos Fijos Mensuales
								</h3>
								<p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
									Importes que se repiten cada mes
								</p>
							</div>
							<button onClick={() => setIsConfigOpen(false)}>
								<X size={24} className="text-gray-300" />
							</button>
						</div>
						<form
							onSubmit={handleSaveConfig}
							className="p-8 space-y-6 bg-white">
							<div className="max-h-[400px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
								{recurringExpenses.map((exp, idx) => (
									<div
										key={idx}
										className="space-y-3 p-4 bg-gray-50 rounded-[1.5rem] relative group border border-transparent hover:border-gray-200 transition-all">
										<button
											type="button"
											onClick={() =>
												setRecurringExpenses(
													recurringExpenses.filter((_, i) => i !== idx)
												)
											}
											className="absolute -top-2 -right-2 bg-white text-gray-300 hover:text-rose-500 p-1 rounded-full shadow-sm border border-gray-100">
											<X size={14} />
										</button>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block tracking-widest">
												Concepto
											</label>
											<input
												required
												className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-rose-200"
												value={exp.category}
												onChange={(e) => {
													const newExps = [...recurringExpenses];
													newExps[idx].category = e.target.value;
													setRecurringExpenses(newExps);
												}}
											/>
										</div>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block tracking-widest">
												Importe Mensual (€)
											</label>
											<input
												type="number"
												step="0.01"
												required
												className="w-full p-3 bg-white border border-gray-100 rounded-xl font-black text-lg outline-none focus:border-rose-200"
												value={exp.amount}
												onChange={(e) => {
													const newExps = [...recurringExpenses];
													newExps[idx].amount = e.target.value;
													setRecurringExpenses(newExps);
												}}
											/>
										</div>
									</div>
								))}
								<button
									type="button"
									onClick={() =>
										setRecurringExpenses([
											...recurringExpenses,
											{ category: "", amount: 0 },
										])
									}
									className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
									<Plus size={14} /> Añadir concepto personalizado
								</button>
							</div>
							<button className="w-full bg-[#1e293b] text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg hover:bg-black transition-all shadow-slate-200 mt-4">
								Guardar Configuración
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
