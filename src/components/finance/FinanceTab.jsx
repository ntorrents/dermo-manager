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
	Calendar, // Icono nuevo
} from "lucide-react";
import {
	addDocument,
	deleteDocument,
	updateDocument,
} from "../../services/firestore";
import { formatCurrency, formatDate } from "../../utils/format";
import { exportToCSV } from "../../utils/export";

// Importaciones directas de Firebase
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";

// AÑADIDO: Recibimos setCurrentMonth
export const FinanceTab = ({
	user,
	entries,
	currentMonth,
	setCurrentMonth,
	showToast,
}) => {
	// --- ESTADOS ---
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isConfigOpen, setIsConfigOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");

	// Nuevo estado para el filtro de vista (Preparado para el futuro)
	const [viewMode, setViewMode] = useState("month"); // 'month' | 'year'

	// Estado de configuración (Auto-gestionado)
	const [activeConfig, setActiveConfig] = useState({
		rent: 0,
		insurance: 0,
		others: 0,
	});
	const [configId, setConfigId] = useState(null);
	const [loadingConfig, setLoadingConfig] = useState(true);

	// Estado temporal para el formulario de edición
	const [tempConfig, setTempConfig] = useState({
		rent: 0,
		insurance: 0,
		others: 0,
	});

	const [formData, setFormData] = useState({
		type: "expense",
		amount: "",
		category: "General",
		description: "",
		date: new Date().toISOString().split("T")[0],
	});

	// --- 1. CARGA DE CONFIGURACIÓN ---
	useEffect(() => {
		const fetchConfig = async () => {
			try {
				const q = query(
					collection(db, `users/${user.uid}/settings`),
					where("type", "==", "finance_config"),
				);
				const snapshot = await getDocs(q);

				if (!snapshot.empty) {
					const docData = snapshot.docs[0].data();
					setActiveConfig({
						rent: Number(docData.rent) || 0,
						insurance: Number(docData.insurance) || 0,
						others: Number(docData.others) || 0,
					});
					setConfigId(snapshot.docs[0].id);
				} else {
					setActiveConfig({ rent: 0, insurance: 0, others: 0 });
					setConfigId(null);
				}
			} catch (error) {
				console.error("Error cargando config de finanzas:", error);
			} finally {
				setLoadingConfig(false);
			}
		};

		if (user) fetchConfig();
	}, [user]);

	// --- LÓGICA DE DATOS PRINCIPAL ---
	const filteredEntries = useMemo(() => {
		// Si la vista es 'month', filtramos por currentMonth. Si es 'year', mostramos todo.
		let data = entries;

		if (viewMode === "month") {
			data = data.filter((e) => e.date.startsWith(currentMonth));
		} else if (viewMode === "year") {
			const year = currentMonth.split("-")[0];
			data = data.filter((e) => e.date.startsWith(year));
		}

		return data
			.filter(
				(e) =>
					e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					e.category?.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			.sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [entries, currentMonth, searchTerm, viewMode]);

	const incomes = filteredEntries.filter((e) => e.type === "income");
	const expenses = filteredEntries.filter((e) => e.type === "expense");

	const totalIncome = incomes.reduce((acc, curr) => acc + curr.amount, 0);
	const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);
	const netProfit = totalIncome - totalExpense;

	// --- LÓGICA DE ESTADO DE PAGOS (MEJORADA) ---
	const checkPaymentStatus = (concept, amount) => {
		if (!amount || Number(amount) === 0) return { status: "disabled" };

		// Busca si hay un gasto ESTE MES (currentMonth) que sea 'Fijo'
		const found = entries
			.filter((e) => e.date.startsWith(currentMonth)) // Aseguramos que miramos el mes seleccionado
			.find(
				(e) =>
					e.category === "Fijo" &&
					e.description.toLowerCase().includes(concept.toLowerCase()),
			);

		return found
			? { status: "paid", id: found.id, date: found.date }
			: { status: "pending", amount: amount };
	};

	const fixedStatus = {
		rent: checkPaymentStatus("Alquiler", activeConfig.rent),
		insurance: checkPaymentStatus("Cuota/Seguro", activeConfig.insurance),
		others: checkPaymentStatus("Otros Fijos", activeConfig.others),
	};

	// --- MANEJADORES ---
	const openModal = (type) => {
		setFormData({
			type,
			amount: "",
			category: type === "income" ? "Servicio" : "Material",
			description: "",
			date: currentMonth + "-01", // Por defecto, día 1 del mes seleccionado
		});
		setIsModalOpen(true);
	};

	const handleSaveEntry = async (e) => {
		e.preventDefault();
		if (!formData.amount || !formData.description) return;
		try {
			await addDocument(user.uid, "finance_entries", {
				...formData,
				amount: Number(formData.amount),
				createdAt: new Date().toISOString(),
			});
			showToast("Movimiento registrado");
			setIsModalOpen(false);
		} catch (error) {
			console.error(error);
			showToast("Error al guardar", "error");
		}
	};

	// --- MEJORA: PAGO DE GASTOS FIJOS ---
	const payFixedExpense = async (description, amount) => {
		if (
			confirm(
				`¿Confirmar pago de ${description} por ${formatCurrency(amount)} en ${currentMonth}?`,
			)
		) {
			try {
				// 1. Calculamos la fecha real de hoy para la nota
				const now = new Date();
				const day = String(now.getDate()).padStart(2, "0");
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const paidDateString = `${day}/${month}`;

				// 2. Calculamos la fecha de imputación (para que caiga en el mes que estamos viendo)
				// Si el mes seleccionado es el actual, usamos hoy. Si es otro, usamos el día 1.
				const selectedDate =
					currentMonth === new Date().toISOString().slice(0, 7)
						? new Date().toISOString().split("T")[0]
						: `${currentMonth}-01`;

				await addDocument(user.uid, "finance_entries", {
					type: "expense",
					amount: Number(amount),
					category: "Fijo",
					description: `${description} (Pagado el ${paidDateString})`, // Nota visual
					date: selectedDate, // Fecha lógica para la contabilidad
					createdAt: new Date().toISOString(),
				});

				showToast("Gasto fijo registrado ✅");
			} catch (error) {
				console.error(error);
				showToast("Error al registrar pago", "error");
			}
		}
	};

	const handleDelete = async (id) => {
		if (confirm("¿Eliminar este movimiento?")) {
			await deleteDocument(user.uid, "finance_entries", id);
			showToast("Movimiento eliminado");
		}
	};

	// --- GUARDADO DE CONFIGURACIÓN ---
	const handleSaveConfig = async (e) => {
		e.preventDefault();

		const newConfig = {
			rent: Number(tempConfig.rent) || 0,
			insurance: Number(tempConfig.insurance) || 0,
			others: Number(tempConfig.others) || 0,
			type: "finance_config",
		};

		setActiveConfig(newConfig);

		try {
			if (configId) {
				await updateDocument(user.uid, "settings", configId, newConfig);
				showToast("Configuración actualizada");
			} else {
				const docRef = await addDocument(user.uid, "settings", newConfig);
				setConfigId(docRef.id);
				showToast("Configuración creada");
			}
			setIsConfigOpen(false);
		} catch (error) {
			console.error(error);
			showToast("Error al guardar configuración", "error");
		}
	};

	const handleExport = () => {
		exportToCSV(filteredEntries, `Contabilidad_${currentMonth}.csv`);
		showToast("Excel descargado");
	};

	const openConfigModal = () => {
		setTempConfig(activeConfig);
		setIsConfigOpen(true);
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* Header: Balance */}
			<div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
				<div>
					<p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
						Flujo de Caja ({viewMode === "month" ? "Mensual" : "Anual"})
					</p>
					<h2
						className={`text-3xl font-bold ${netProfit >= 0 ? "text-gray-800" : "text-red-500"}`}>
						{formatCurrency(netProfit)}
					</h2>
				</div>

				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
					{/* SELECTOR DE FECHA (AÑADIDO) */}
					<div className="relative">
						<Calendar
							className="absolute left-3 top-2.5 text-gray-400"
							size={16}
						/>
						<input
							type="month"
							value={currentMonth}
							onChange={(e) => setCurrentMonth(e.target.value)}
							className="pl-9 p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-rose-100 cursor-pointer"
						/>
					</div>

					{/* FILTRO DE VISTA (AÑADIDO) */}
					{
						<select
							value={viewMode}
							onChange={(e) => setViewMode(e.target.value)}
							className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none">
							<option value="month">Mes</option>
							<option value="year">Año</option>
						</select>
					}

					<div className="relative flex-1 md:w-48">
						<Search
							className="absolute left-3 top-2.5 text-gray-400"
							size={16}
						/>
						<input
							placeholder="Buscar..."
							className="w-full pl-9 p-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 ring-rose-100 outline-none text-sm"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
					<button
						onClick={handleExport}
						className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm">
						<FileSpreadsheet size={18} />
					</button>
				</div>
			</div>

			{/* GRID PRINCIPAL */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* COLUMNA IZQUIERDA: INGRESOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-2">
						<h3 className="font-bold text-gray-700 flex items-center gap-2">
							<div className="bg-green-100 p-1.5 rounded-lg text-green-600">
								<TrendingUp size={16} />
							</div>
							Ingresos
						</h3>
						<span className="text-green-600 font-bold">
							{formatCurrency(totalIncome)}
						</span>
					</div>

					<button
						onClick={() => openModal("income")}
						className="w-full py-3 border-2 border-dashed border-green-200 bg-green-50 text-green-600 rounded-xl font-bold hover:bg-green-100 transition-colors flex justify-center items-center gap-2">
						<Plus size={18} /> Añadir Ingreso
					</button>

					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[200px]">
						{incomes.length > 0 ? (
							<div className="divide-y divide-gray-100">
								{incomes.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center group">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-xs text-gray-400">
												{formatDate(entry.date)}
											</p>
										</div>
										<div className="flex items-center gap-3">
											<span className="font-bold text-green-600">
												+{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => handleDelete(entry.id)}
												className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="p-8 text-center text-gray-400 text-sm">
								Sin ingresos
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA CENTRAL: GASTOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-2">
						<h3 className="font-bold text-gray-700 flex items-center gap-2">
							<div className="bg-red-100 p-1.5 rounded-lg text-red-600">
								<TrendingDown size={16} />
							</div>
							Gastos
						</h3>
						<span className="text-red-600 font-bold">
							{formatCurrency(totalExpense)}
						</span>
					</div>

					<button
						onClick={() => openModal("expense")}
						className="w-full py-3 border-2 border-dashed border-red-200 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex justify-center items-center gap-2">
						<Plus size={18} /> Añadir Gasto
					</button>

					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[200px]">
						{expenses.length > 0 ? (
							<div className="divide-y divide-gray-100">
								{expenses.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center group">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-xs text-gray-400">
												{formatDate(entry.date)} •
												<span
													className={`${entry.category === "Fijo" ? "text-purple-600 font-bold bg-purple-50 px-1 rounded" : ""}`}>
													{" "}
													{entry.category}
												</span>
											</p>
										</div>
										<div className="flex items-center gap-3">
											<span className="font-bold text-red-600">
												-{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => handleDelete(entry.id)}
												className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="p-8 text-center text-gray-400 text-sm">
								Sin gastos
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA DERECHA: CONTROL DE FIJOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-2 h-[28px]">
						<h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
							Control de Fijos
						</h3>
						<button
							onClick={openConfigModal}
							className="text-xs text-gray-400 hover:text-rose-500 flex items-center gap-1">
							<Settings size={14} /> Configurar
						</button>
					</div>

					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
						{loadingConfig ? (
							<div className="flex justify-center py-4 text-rose-500">
								<Loader2 className="animate-spin" />
							</div>
						) : (
							<>
								<div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
									<CheckCircle2 size={12} className="text-green-500" /> Pagado
									<span className="text-gray-300">|</span>
									<ArrowRight size={12} className="text-rose-500" /> Pendiente
								</div>

								{/* LISTA DE FIJOS */}
								{[
									{
										id: "rent",
										label: "Alquiler",
										val: activeConfig.rent,
										status: fixedStatus.rent,
									},
									{
										id: "insurance",
										label: "Cuota/Seguro",
										val: activeConfig.insurance,
										status: fixedStatus.insurance,
									},
									{
										id: "others",
										label: "Otros Fijos",
										val: activeConfig.others,
										status: fixedStatus.others,
									},
								].map(
									(item) =>
										item.status.status !== "disabled" && (
											<div
												key={item.id}
												className={`flex justify-between items-center p-3 rounded-xl border ${item.status.status === "paid" ? "bg-green-50 border-green-100" : "bg-white border-gray-100 shadow-sm"}`}>
												<div>
													<p className="font-bold text-gray-800 text-sm">
														{item.label}
													</p>
													<p className="text-xs text-gray-500">
														{formatCurrency(item.val)}
													</p>
													{/* Si está pagado, mostramos la fecha real del pago */}
													{item.status.status === "paid" && (
														<p className="text-[10px] text-green-600 font-medium">
															{/* Extraemos la fecha de la descripción si existe, sino usamos la fecha del registro */}
															Registrado
														</p>
													)}
												</div>
												{item.status.status === "paid" ? (
													<span className="flex items-center gap-1 text-xs font-bold text-green-600">
														<CheckCircle2 size={16} />
													</span>
												) : (
													<button
														onClick={() =>
															payFixedExpense(item.label, item.val)
														}
														className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-rose-600 shadow-sm">
														Pagar
													</button>
												)}
											</div>
										),
								)}

								{activeConfig.rent === 0 &&
									activeConfig.insurance === 0 &&
									activeConfig.others === 0 && (
										<div className="text-center py-4">
											<AlertCircle className="mx-auto text-gray-300 mb-2" />
											<p className="text-xs text-gray-400">
												Sin gastos fijos configurados.
											</p>
											<button
												onClick={openConfigModal}
												className="text-rose-500 font-bold text-xs mt-2 underline">
												Configurar
											</button>
										</div>
									)}
							</>
						)}
					</div>
				</div>
			</div>

			{/* MODALES */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
						<div className="flex justify-between items-center mb-4">
							<h3
								className={`font-bold text-lg ${formData.type === "income" ? "text-green-600" : "text-red-600"}`}>
								{formData.type === "income" ? "Nuevo Ingreso" : "Nuevo Gasto"}
							</h3>
							<button onClick={() => setIsModalOpen(false)}>
								<X className="text-gray-400" />
							</button>
						</div>
						<form onSubmit={handleSaveEntry} className="space-y-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Concepto
								</label>
								<input
									required
									className="w-full p-3 border rounded-xl mt-1"
									placeholder="Ej: Tratamiento..."
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-500 uppercase">
										Importe (€)
									</label>
									<input
										required
										type="number"
										step="0.01"
										className="w-full p-3 border rounded-xl mt-1"
										placeholder="0.00"
										value={formData.amount}
										onChange={(e) =>
											setFormData({ ...formData, amount: e.target.value })
										}
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-500 uppercase">
										Fecha
									</label>
									<input
										type="date"
										className="w-full p-3 border rounded-xl mt-1"
										value={formData.date}
										onChange={(e) =>
											setFormData({ ...formData, date: e.target.value })
										}
									/>
								</div>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Categoría
								</label>
								<select
									className="w-full p-3 border rounded-xl mt-1 bg-white"
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
											<option>Impuestos</option>
											<option>Fijo</option>
											<option>Otros</option>
										</>
									)}
								</select>
							</div>
							<button
								className={`w-full text-white font-bold py-3 rounded-xl mt-2 ${formData.type === "income" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
								Guardar
							</button>
						</form>
					</div>
				</div>
			)}

			{isConfigOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsConfigOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-bold text-lg text-gray-800">
								Gastos Fijos Mensuales
							</h3>
							<button onClick={() => setIsConfigOpen(false)}>
								<X className="text-gray-400" />
							</button>
						</div>
						<p className="text-xs text-gray-500 mb-4">
							Configura los importes. Cada mes podrás confirmar el pago con un
							clic.
						</p>
						<form onSubmit={handleSaveConfig} className="space-y-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Alquiler Local
								</label>
								<input
									type="number"
									className="w-full p-3 border rounded-xl mt-1"
									value={tempConfig.rent}
									onChange={(e) =>
										setTempConfig({ ...tempConfig, rent: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Seguros / Cuota
								</label>
								<input
									type="number"
									className="w-full p-3 border rounded-xl mt-1"
									value={tempConfig.insurance}
									onChange={(e) =>
										setTempConfig({ ...tempConfig, insurance: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Otros
								</label>
								<input
									type="number"
									className="w-full p-3 border rounded-xl mt-1"
									value={tempConfig.others}
									onChange={(e) =>
										setTempConfig({ ...tempConfig, others: e.target.value })
									}
								/>
							</div>
							<button className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black mt-2">
								Guardar Configuración
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
