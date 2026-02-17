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
	X,
	Calendar,
	Edit2,
	FileText,
	Download,
	Receipt,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import {
	formatCurrency,
	IVA_OPTIONS,
	calculateTaxFromTotal,
} from "../../utils/format";
import { exportToCSV, exportTrimestreToExcel } from "../../utils/export";
import { filterByDate, getDateLabel } from "../../utils/dateUtils";
import { uploadReceipt, getReceiptUrl, getReceiptSignedUrl } from "../../services/receiptStorage";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";

export const FinanceTab = ({
	user,
	entries = [],
	clients = [],
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

	const [recurringExpenses, setRecurringExpenses] = useState([]);
	const [loadingConfig, setLoadingConfig] = useState(true);

	// Estado para Edición
	const [editingEntry, setEditingEntry] = useState(null);

	// ESTADOS PARA CONFIRMACIONES
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);
	const [showPayModal, setShowPayModal] = useState(false);
	const [itemToPay, setItemToPay] = useState(null);
	const [savingEntry, setSavingEntry] = useState(false);

	// NUEVO: Filtro para la vista móvil (Gasto por defecto)
	const [typeFilter, setTypeFilter] = useState("expense");

	const [formData, setFormData] = useState({
		type: "expense",
		amount: "",
		tax_rate: 0,
		category: "General",
		description: "",
		date: new Date().toISOString().split("T")[0],
		notes: "",
		is_deductible: false,
		supplier_nif: "",
		invoice_number: "",
	});
	const [receiptFile, setReceiptFile] = useState(null);

	const taxCalc = useMemo(() => {
		const { baseAmount, taxAmount } = calculateTaxFromTotal(
			formData.amount,
			formData.tax_rate
		);
		return { base_amount: baseAmount, tax_amount: taxAmount };
	}, [formData.amount, formData.tax_rate]);

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

	// Entradas filtradas solo por fecha para cálculos globales
	const periodEntries = useMemo(() => {
		return filterByDate(entries, "date", viewMode, currentDate);
	}, [entries, currentDate, viewMode]);

	// Entradas filtradas para la lista (incluye búsqueda y el filtro de tipo móvil)
	const filteredEntries = useMemo(() => {
		let data = periodEntries;

		if (typeFilter !== "all") {
			data = data.filter((e) => e.type === typeFilter);
		}

		return data
			.filter(
				(e) =>
					e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					e.category?.toLowerCase().includes(searchTerm.toLowerCase())
			)
			.sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [periodEntries, searchTerm, typeFilter]);

	// Cálculos basados en el periodo total
	const totalIncome = periodEntries
		.filter((e) => e.type === "income")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const totalExpense = periodEntries
		.filter((e) => e.type === "expense")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const netProfit = totalIncome - totalExpense;

	const getFixedStatus = (expense) => {
		const found = entries
			.filter((e) => e.date.startsWith(currentDate))
			.find(
				(e) =>
					e.category === "Fijo" &&
					e.description.toLowerCase().includes(expense.category.toLowerCase())
			);
		return found ? { paid: true, date: found.date } : { paid: false };
	};

	const openEntryModal = (type, entry = null) => {
		if (entry) {
			setEditingEntry(entry);
			setFormData({
				type: entry.type,
				amount: entry.amount,
				tax_rate: entry.tax_rate ?? 0,
				category: entry.category,
				description: entry.description,
				date: entry.date,
				notes: entry.notes || "",
				is_deductible: entry.is_deductible ?? false,
				supplier_nif: entry.supplier_nif || "",
				invoice_number: entry.invoice_number || "",
				file_url: entry.file_url || "",
			});
		} else {
			setEditingEntry(null);
			setFormData({
				type,
				amount: "",
				tax_rate: type === "expense" ? 21 : 0,
				category: type === "income" ? "Servicio" : "Material",
				description: "",
				date: new Date().toISOString().split("T")[0],
				notes: "",
				is_deductible: false,
				supplier_nif: "",
				invoice_number: "",
				file_url: "",
			});
		}
		setReceiptFile(null);
		setIsModalOpen(true);
	};

	const handleSaveEntry = async (e) => {
		e.preventDefault();
		setSavingEntry(true);
		try {
			const taxRate = Number(formData.tax_rate) || 0;
			const amount = Number(formData.amount);
			const { baseAmount, taxAmount } = calculateTaxFromTotal(amount, taxRate);
			
			const payload = {
				type: formData.type,
				amount,
				total_amount: amount,
				tax_rate: taxRate,
				tax_amount: taxAmount,
				tax_base: baseAmount,
				category: formData.category,
				description: formData.description,
				date: formData.date,
				notes: formData.notes || null,
				is_deductible: formData.is_deductible || false,
				supplier_nif: formData.is_deductible ? (formData.supplier_nif?.trim() || null) : null,
				invoice_number: formData.is_deductible ? (formData.invoice_number?.trim() || null) : null,
				// Mantener file_url existente si no hay archivo nuevo
				file_url: receiptFile ? undefined : (editingEntry?.file_url || null),
				user_id: user.id,
			};

			let insertedId = null;
			if (editingEntry) {
				const { error } = await supabase
					.from("finance_entries")
					.update(payload)
					.eq("id", editingEntry.id);
				if (error) throw error;
				insertedId = editingEntry.id;
				showToast("Movimiento actualizado");
			} else {
				const { data, error } = await supabase
					.from("finance_entries")
					.insert([payload])
					.select("id")
					.single();
				if (error) throw error;
				insertedId = data.id;
				showToast("Movimiento registrado");
			}

			// Subir archivo si existe y es factura deducible (solo si hay un archivo nuevo)
			if (formData.is_deductible && receiptFile && insertedId) {
				try {
					const path = await uploadReceipt(user.id, insertedId, receiptFile);
					await supabase.from("finance_entries").update({ file_url: path }).eq("id", insertedId);
				} catch (fileErr) {
					console.error("Error subiendo archivo:", fileErr);
					showToast("Gasto guardado pero error al subir archivo", "error");
				}
			}

			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al guardar", "error");
		} finally {
			setSavingEntry(false);
		}
	};

	const handlePayClick = (expense) => {
		setItemToPay(expense);
		setShowPayModal(true);
	};

	const confirmPay = async () => {
		if (!itemToPay) return;
		try {
			const selectedDate =
				currentDate === new Date().toISOString().slice(0, 7)
					? new Date().toISOString().split("T")[0]
					: `${currentDate}-01`;
			const { error } = await supabase.from("finance_entries").insert([
				{
					user_id: user.id,
					type: "expense",
					amount: Number(itemToPay.amount),
					category: "Fijo",
					description: itemToPay.category,
					date: selectedDate,
					notes: "Pago recurrente automático",
				},
			]);
			if (error) throw error;
			showToast(`Pago de ${itemToPay.category} registrado ✅`);
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al registrar pago", "error");
		} finally {
			setShowPayModal(false);
			setItemToPay(null);
		}
	};

	const handleDeleteClick = (id) => {
		setItemToDelete(id);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!itemToDelete) return;
		try {
			const { error } = await supabase
				.from("finance_entries")
				.delete()
				.eq("id", itemToDelete);
			if (error) throw error;
			showToast("Eliminado");
			if (onRefresh) await onRefresh();
		} catch (e) {
			console.error(e);
		} finally {
			setShowDeleteModal(false);
			setItemToDelete(null);
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
		} catch {
			showToast("Error al configurar", "error");
		}
	};


	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* MODALES DE CONFIRMACIÓN */}
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Movimiento"
				message="¿Estás seguro de que quieres eliminar este registro? Esto afectará a tus estadísticas."
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			<ConfirmModal
				isOpen={showPayModal}
				title="Confirmar Pago Recurrente"
				message={`¿Quieres registrar el pago de ${
					itemToPay?.category
				} por ${formatCurrency(itemToPay?.amount)}?`}
				onConfirm={confirmPay}
				onCancel={() => setShowPayModal(false)}
			/>

			{/* HEADER: BALANCE Y SELECTORES */}
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
							exportToCSV(periodEntries, `Finanzas_${currentDate}.csv`)
						}
						className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 transition-colors hover:bg-emerald-100"
						title="Exportar CSV">
						<FileSpreadsheet size={20} />
					</button>
				</div>
			</div>
			{/* BOTONES DE ACCIÓN RÁPIDA (Siempre arriba) */}
			<div className="grid grid-cols-2 gap-3 md:gap-6">
				<button
					onClick={() => openEntryModal("income")}
					className="py-4 md:py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 flex justify-center items-center gap-2 active:scale-95 transition-all">
					<Plus size={22} />{" "}
					<span className="uppercase tracking-widest text-sm">Ingreso</span>
				</button>
				<button
					onClick={() => openEntryModal("expense")}
					className="py-4 md:py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-100 flex justify-center items-center gap-2 active:scale-95 transition-all">
					<Plus size={22} />{" "}
					<span className="uppercase tracking-widest text-sm">Gasto</span>
				</button>
			</div>

			{/* --- VISTA MÓVIL/TABLET (Tabs y Lista Unificada) --- */}
			<div className="md:hidden space-y-4">
				{/* Pestañas de Filtro */}
				<div className="flex bg-gray-100 p-1 rounded-xl">
					{["all", "income", "expense"].map((type) => (
						<button
							key={type}
							onClick={() => setTypeFilter(type)}
							className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
								typeFilter === type
									? "bg-white text-gray-800 shadow-sm"
									: "text-gray-400"
							}`}>
							{type === "all"
								? "Todo"
								: type === "income"
								? "Ingresos"
								: "Gastos"}
						</button>
					))}
				</div>

				{/* Buscador Móvil */}
				<div className="relative">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar en la lista..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl outline-none"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				{/* Lista Móvil Unificada */}
				<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
					{filteredEntries.length > 0 ? (
						filteredEntries.map((entry) => (
							<div
								key={entry.id}
								className="p-4 border-b last:border-0 hover:bg-gray-50 transition-colors flex justify-between items-center group">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date} • {entry.category}
												{entry.is_deductible && " • Factura deducible"}
											</p>
											{entry.notes && (
												<p className="text-[10px] text-gray-400 italic mt-1 flex items-center gap-1">
													<FileText size={10} /> {entry.notes}
												</p>
											)}
										</div>
										<div className="flex items-center gap-2">
											{entry.type === "expense" && entry.file_url && (
												<a
													href="#"
													onClick={async (e) => {
														e.preventDefault();
														try {
															const url = await getReceiptSignedUrl(entry.file_url);
															if (url) {
																window.open(url, "_blank");
															} else {
																// Fallback a URL pública
																const publicUrl = getReceiptUrl(entry.file_url);
																if (publicUrl) {
																	window.open(publicUrl, "_blank");
																} else {
																	showToast("Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.", "error");
																}
															}
														} catch (err) {
															console.error("Error descargando archivo:", err);
															if (err?.message?.includes("Bucket not found") || err?.error === "Bucket not found") {
																showToast("Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.", "error");
															} else {
																showToast("Error al descargar el archivo", "error");
															}
														}
													}}
													className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
													title="Ver/Descargar justificante">
													<Download size={16} />
												</a>
											)}
									<span
										className={`font-black text-sm ${
											entry.type === "income"
												? "text-emerald-500"
												: "text-rose-500"
										}`}>
										{entry.type === "income" ? "+" : "-"}
										{formatCurrency(entry.amount)}
									</span>
									<button
										onClick={() => openEntryModal(null, entry)}
										className="text-gray-300 p-1"
										title="Editar">
										<Edit2 size={14} />
									</button>
									<button
										onClick={() => handleDeleteClick(entry.id)}
										className="text-gray-300 p-1"
										title="Eliminar">
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						))
					) : (
						<div className="p-10 text-center text-gray-300 font-bold uppercase text-xs">
							Sin movimientos
						</div>
					)}
				</div>

				{/* Gastos Fijos (Siempre visibles al final en móvil) */}
				<div className="space-y-4 pt-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">
							Gastos Fijos
						</h3>
						<button
							onClick={() => setIsConfigOpen(true)}
							className="text-[10px] font-black text-gray-400 hover:text-rose-500 uppercase italic flex items-center gap-1">
							<Settings size={12} /> Configurar
						</button>
					</div>
					<div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-3">
						{recurringExpenses.map((exp, idx) => {
							const status = getFixedStatus(exp);
							return (
								<div
									key={idx}
									className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
										status.paid
											? "bg-emerald-50 border-emerald-100"
											: "bg-white border-gray-100"
									}`}>
									<div>
										<p className="font-bold text-gray-800 text-xs">
											{exp.category}
										</p>
										<p className="text-[10px] text-gray-400 font-bold">
											{formatCurrency(exp.amount)}
										</p>
									</div>
									{status.paid ? (
										<CheckCircle2 size={20} className="text-emerald-500" />
									) : (
										<button
											onClick={() => handlePayClick(exp)}
											className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors">
											Pagar
										</button>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* --- VISTA WEB/TABLET: 2 cols en tablet, 3 en escritorio --- */}
			<div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
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
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{periodEntries.filter((e) => e.type === "income").length > 0 ? (
							periodEntries
								.filter((e) => e.type === "income")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-black text-emerald-500 mr-1">
												+{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("income", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Editar">
												<Edit2 size={14} />
											</button>
											<button
												onClick={() => handleDeleteClick(entry.id)}
												className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Eliminar">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))
						) : (
							<div className="p-6">
								<EmptyState
									icon={TrendingUp}
									title="Sin ingresos"
									description="Registra tu primer ingreso en este periodo."
									actionLabel="Registrar ingreso"
									onAction={() => openEntryModal("income")}
								/>
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
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{periodEntries.filter((e) => e.type === "expense").length > 0 ? (
							periodEntries
								.filter((e) => e.type === "expense")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date} •{" "}
												<span className="text-rose-400">{entry.category}</span>
												{entry.is_deductible && " • Factura deducible"}
											</p>
										</div>
										<div className="flex items-center gap-2">
											{entry.file_url && (
												<a
													href="#"
													onClick={async (e) => {
														e.preventDefault();
														try {
															const url = await getReceiptSignedUrl(entry.file_url);
															if (url) {
																window.open(url, "_blank");
															} else {
																// Fallback a URL pública
																const publicUrl = getReceiptUrl(entry.file_url);
																if (publicUrl) {
																	window.open(publicUrl, "_blank");
																} else {
																	showToast("Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.", "error");
																}
															}
														} catch (err) {
															console.error("Error descargando archivo:", err);
															if (err?.message?.includes("Bucket not found") || err?.error === "Bucket not found") {
																showToast("Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.", "error");
															} else {
																showToast("Error al descargar el archivo", "error");
															}
														}
													}}
													className="text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
													title="Ver/Descargar justificante">
													<Download size={16} />
												</a>
											)}
											<span className="font-black text-rose-500 mr-1">
												-{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("expense", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Editar">
												<Edit2 size={14} />
											</button>
											<button
												onClick={() => handleDeleteClick(entry.id)}
												className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Eliminar">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))
						) : (
							<div className="p-6">
								<EmptyState
									icon={TrendingDown}
									title="Sin gastos"
									description="Registra tu primer gasto en este periodo."
									actionLabel="Registrar gasto"
									onAction={() => openEntryModal("expense")}
								/>
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA 3: CONTROL DE FIJOS */}
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
						{recurringExpenses.map((exp, idx) => {
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
									</div>
									{status.paid ? (
										<CheckCircle2 size={22} className="text-emerald-500" />
									) : (
										<button
											onClick={() => handlePayClick(exp)}
											className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-md transition-all active:scale-95">
											Pagar
										</button>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={
					editingEntry
						? "Editar Movimiento"
						: formData.type === "income"
						? "Registrar Ingreso"
						: "Registrar Gasto"
				}
				maxWidth="max-w-md">
				<form
					onSubmit={handleSaveEntry}
					className="space-y-5">
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Descripción
								</label>
								<input
									required
									className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-gray-200 outline-none"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
								/>
							</div>
							{formData.type === "expense" && (
								<div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
									<input
										type="checkbox"
										id="is_deductible"
										checked={formData.is_deductible}
										onChange={(e) => {
											const checked = e.target.checked;
											setFormData({
												...formData,
												is_deductible: checked,
												tax_rate: checked ? 21 : 0,
												supplier_nif: checked ? formData.supplier_nif : "",
												invoice_number: checked ? formData.invoice_number : "",
											});
										}}
										className="w-5 h-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
									/>
									<label htmlFor="is_deductible" className="font-bold text-gray-800 cursor-pointer flex-1">
										¿Es Factura Deducible?
									</label>
								</div>
							)}
							<div className="flex gap-4">
								<div className="flex-1">
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
										Importe Total (€)
									</label>
									<input
										required
										type="number"
										step="0.01"
										placeholder="0.00 €"
										className="w-full p-4 bg-gray-50 rounded-xl font-black text-rose-500 text-xl placeholder:text-rose-300"
										value={formData.amount}
										onChange={(e) =>
											setFormData({ ...formData, amount: e.target.value })
										}
									/>
								</div>
								{formData.type === "expense" && formData.is_deductible && (
									<div className="flex-1">
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
											IVA (%)
										</label>
										<select
											className="w-full p-4 bg-gray-50 rounded-xl font-bold"
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
							</div>
							{formData.type === "expense" && formData.is_deductible && formData.amount && (
								<div className="text-xs font-bold text-gray-500 bg-gray-50 p-3 rounded-xl">
									Base: {formatCurrency(taxCalc.base_amount)} | Cuota IVA: {formatCurrency(taxCalc.tax_amount)}
								</div>
							)}
							{formData.type === "expense" && formData.is_deductible && (
								<>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
											NIF/CIF Proveedor *
										</label>
										<input
											required={formData.is_deductible}
											placeholder="Ej: B12345678"
											className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
											value={formData.supplier_nif}
											onChange={(e) =>
												setFormData({ ...formData, supplier_nif: e.target.value })
											}
										/>
									</div>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
											Nº Factura Proveedor
										</label>
										<input
											placeholder="Ej: F2026-001"
											className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
											value={formData.invoice_number}
											onChange={(e) =>
												setFormData({ ...formData, invoice_number: e.target.value })
											}
										/>
									</div>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
											Justificante (foto o PDF) {editingEntry?.file_url ? "" : "*"}
										</label>
										{editingEntry?.file_url && !receiptFile && (
											<div className="mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
												<span className="text-sm font-bold text-emerald-700 flex items-center gap-2">
													<FileText size={16} />
													Archivo guardado: {editingEntry.file_url.split("/").pop()}
												</span>
												<a
													href="#"
													onClick={(e) => {
														e.preventDefault();
														const input = document.getElementById("receipt-file-input");
														if (input) input.click();
													}}
													className="text-xs font-bold text-emerald-600 hover:underline">
													Cambiar
												</a>
											</div>
										)}
										<input
											id="receipt-file-input"
											required={formData.is_deductible && !editingEntry?.file_url}
											type="file"
											accept="image/*,.pdf"
											className="w-full p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:font-bold file:bg-rose-50 file:text-rose-600"
											onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
										/>
										{receiptFile && (
											<p className="mt-2 text-xs font-bold text-emerald-600">
												Nuevo archivo seleccionado: {receiptFile.name}
											</p>
										)}
									</div>
								</>
							)}
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Fecha
								</label>
								<input
									required
									type="date"
									className="w-full p-4 bg-gray-50 rounded-xl font-bold text-sm"
									value={formData.date}
									onChange={(e) =>
										setFormData({ ...formData, date: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Categoría
								</label>
								<select
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold"
									value={formData.category}
									onChange={(e) =>
										setFormData({ ...formData, category: e.target.value })
									}>
									{formData.type === "income" ? (
										<>
											<option>Servicio</option>
											<option>Producto</option>
											<option>Otros</option>
										</>
									) : (
										<>
											<option>Material</option>
											<option>Alquiler</option>
											<option>Marketing</option>
											<option>Suministros</option>
											<option>Otros</option>
										</>
									)}
								</select>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Notas
								</label>
								<textarea
									rows="2"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold resize-none"
									value={formData.notes}
									onChange={(e) =>
										setFormData({ ...formData, notes: e.target.value })
									}
								/>
							</div>
							<LoadingButton
								loading={savingEntry}
								type="submit"
								className={`w-full py-4 rounded-xl font-black text-white shadow-lg ${
									formData.type === "income" ? "bg-emerald-500" : "bg-rose-500"
								}`}>
								{savingEntry ? "Guardando..." : "Guardar"}
							</LoadingButton>
						</form>
			</AdaptiveModal>

			<AdaptiveModal
				isOpen={isConfigOpen}
				onClose={() => setIsConfigOpen(false)}
				title="Gastos Fijos"
				maxWidth="max-w-md">
				<form
					onSubmit={handleSaveConfig}
					className="space-y-6">
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
											<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">
												Concepto
											</label>
											<input
												required
												className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm"
												value={exp.category}
												onChange={(e) => {
													const newExps = [...recurringExpenses];
													newExps[idx].category = e.target.value;
													setRecurringExpenses(newExps);
												}}
											/>
										</div>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">
												Importe (€)
											</label>
											<input
												type="number"
												step="0.01"
												required
												placeholder="0.00 €"
												className="w-full p-3 bg-white border border-gray-100 rounded-xl font-black text-lg placeholder:text-gray-300"
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
									<Plus size={14} /> Añadir concepto
								</button>
							</div>
							<button
								type="submit"
								className="w-full bg-surface-dark text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg mt-4">
								Guardar
							</button>
						</form>
			</AdaptiveModal>

		</div>
	);
};
