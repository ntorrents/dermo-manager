import React, { useState, useEffect, useMemo } from "react";
import {
	Plus,
	Trash2,
	TrendingUp,
	TrendingDown,
	DollarSign,
	Package,
	Syringe,
	BarChart3,
	AlertCircle,
	CheckCircle,
	Loader2,
	X,
	Search,
	Sparkles,
	LogOut,
	Lock,
	Mail,
	User,
	Zap,
	Armchair,
	Home,
	Briefcase,
	RefreshCw,
	Check,
	Pencil,
	ChevronRight,
	MoreHorizontal,
	Tag,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
	getAuth,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	GoogleAuthProvider,
	signInWithPopup,
} from "firebase/auth";
import {
	getFirestore,
	collection,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	orderBy,
} from "firebase/firestore";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
	apiKey: "AIzaSyAb1p23xRpeoR6Ycshis8C7r8eBO-IgIqc",
	authDomain: "dermo-gestion-christine.firebaseapp.com",
	projectId: "dermo-gestion-christine",
	storageBucket: "dermo-gestion-christine.firebasestorage.app",
	messagingSenderId: "890222498918",
	appId: "1:890222498918:web:71e34f4587e0fff209c9a7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UTILIDADES ---
const formatCurrency = (amount) =>
	new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(amount);

// --- COMPONENTES UI ---

const Toast = ({ message, type, onClose }) => {
	useEffect(() => {
		const t = setTimeout(onClose, 3000);
		return () => clearTimeout(t);
	}, [onClose]);
	return (
		<div
			className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-5 fade-in duration-300 ${
				type === "success"
					? "bg-emerald-50 text-emerald-800 border border-emerald-100"
					: "bg-rose-50 text-rose-800 border border-rose-100"
			}`}>
			{type === "success" ? (
				<CheckCircle size={20} />
			) : (
				<AlertCircle size={20} />
			)}
			<span className="font-medium text-sm">{message}</span>
		</div>
	);
};

const ConfirmModal = ({
	isOpen,
	title,
	message,
	onConfirm,
	onCancel,
	isDestructive = false,
}) => {
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="p-6 text-center">
					<div
						className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${
							isDestructive
								? "bg-red-100 text-red-600"
								: "bg-rose-100 text-rose-600"
						}`}>
						{isDestructive ? <LogOut size={24} /> : <AlertCircle size={24} />}
					</div>
					<h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
					<p className="text-sm text-gray-500 mb-6">{message}</p>
					<div className="flex gap-3">
						<button
							onClick={onCancel}
							className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
							Cancelar
						</button>
						<button
							onClick={onConfirm}
							className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl shadow-sm active:scale-95 ${
								isDestructive ? "bg-red-500" : "bg-rose-500"
							}`}>
							Confirmar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const SessionModal = ({ isOpen, treatment, onClose, onConfirm }) => {
	const [clientName, setClientName] = useState("");
	if (!isOpen || !treatment) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="p-6">
					<h3 className="text-lg font-bold text-gray-900 mb-1">
						Registrar Sesión
					</h3>
					<p className="text-sm text-gray-500 mb-4">
						{treatment.name} -{" "}
						<span className="font-bold text-rose-500">{treatment.price}€</span>
					</p>
					<div className="mb-4">
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Nombre del Cliente (Opcional)
						</label>
						<div className="relative">
							<User
								className="absolute left-3 top-2.5 text-gray-400"
								size={16}
							/>
							<input
								type="text"
								placeholder="Ej: María García"
								className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-rose-500 outline-none text-sm"
								value={clientName}
								onChange={(e) => setClientName(e.target.value)}
								autoFocus
							/>
						</div>
					</div>
					<div className="flex gap-3">
						<button
							onClick={onClose}
							className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
							Cancelar
						</button>
						<button
							onClick={() => onConfirm(treatment, clientName)}
							className="flex-1 px-4 py-2 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 shadow-sm">
							Confirmar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const StatCard = ({ title, value, subtext, gradient, icon: Icon }) => (
	<div
		className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
		<div className="relative z-10">
			<div className="flex justify-between items-start mb-2">
				<div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
					<Icon size={20} className="text-white" />
				</div>
				<span className="text-xs font-bold uppercase tracking-wider opacity-80">
					{title}
				</span>
			</div>
			<h3 className="text-2xl font-bold tracking-tight">{value}</h3>
			{subtext && (
				<p className="text-white/80 text-xs mt-1 font-medium">{subtext}</p>
			)}
		</div>
		<div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
	</div>
);

// Gráfica de Área Suave (SVG Puro)
const SmoothAreaChart = ({ data }) => {
	const height = 100;
	const width = 300;
	const maxVal = Math.max(...data.map((d) => d.value), 10);

	const points = data
		.map((d, i) => {
			const x = (i / (data.length - 1)) * width;
			const y = height - (d.value / maxVal) * height;
			return `${x},${y}`;
		})
		.join(" ");

	const areaPoints = `${points} ${width},${height} 0,${height}`;

	return (
		<div className="w-full mt-4">
			<div className="relative h-40 w-full overflow-hidden">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					className="w-full h-full overflow-visible"
					preserveAspectRatio="none">
					<defs>
						<linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
							<stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
						</linearGradient>
					</defs>
					<polygon points={areaPoints} fill="url(#gradient)" />
					<polyline
						points={points}
						fill="none"
						stroke="#f43f5e"
						strokeWidth="3"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					{data.map((d, i) => {
						const x = (i / (data.length - 1)) * width;
						const y = height - (d.value / maxVal) * height;
						return (
							<g key={i}>
								<circle
									cx={x}
									cy={y}
									r="3"
									fill="white"
									stroke="#f43f5e"
									strokeWidth="2"
									vectorEffect="non-scaling-stroke"
								/>
							</g>
						);
					})}
				</svg>
			</div>
			<div className="flex justify-between mt-2 text-xs text-gray-400 font-medium px-1">
				{data.map((d, i) => (
					<div key={i} className="flex flex-col items-center">
						<span>{d.label}</span>
						<span className="text-[10px] text-gray-300 font-normal">
							{formatCurrency(d.value)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
};

// --- LOGIN ---
const LoginScreen = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [isRegistering, setIsRegistering] = useState(false);

	const handleAuth = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			if (isRegistering)
				await createUserWithEmailAndPassword(auth, email, password);
			else await signInWithEmailAndPassword(auth, email, password);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	const handleGoogle = async () => {
		try {
			await signInWithPopup(auth, new GoogleAuthProvider());
		} catch (e) {
			setError("Error Google");
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
			<div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-rose-100">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-purple-600">
						DermoApp
					</h1>
					<p className="text-gray-400 text-sm">
						Gestión inteligente para esteticistas
					</p>
				</div>
				<button
					onClick={handleGoogle}
					className="w-full mb-4 py-3 rounded-xl border border-gray-200 flex justify-center items-center gap-2 hover:bg-gray-50 font-medium text-gray-700">
					<span className="text-lg">G</span> Continuar con Google
				</button>
				<div className="relative flex py-2 items-center">
					<div className="flex-grow border-t"></div>
					<span className="flex-shrink-0 mx-4 text-gray-400 text-xs">
						O usa tu email
					</span>
					<div className="flex-grow border-t"></div>
				</div>
				<form onSubmit={handleAuth} className="space-y-4 mt-4">
					<div className="relative">
						<Mail className="absolute left-3 top-3 text-gray-400" size={18} />
						<input
							type="email"
							placeholder="Email"
							className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="relative">
						<Lock className="absolute left-3 top-3 text-gray-400" size={18} />
						<input
							type="password"
							placeholder="Contraseña"
							className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					{error && <p className="text-red-500 text-xs">{error}</p>}
					<button className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600">
						{loading ? (
							<Loader2 className="animate-spin mx-auto" />
						) : isRegistering ? (
							"Crear Cuenta"
						) : (
							"Entrar"
						)}
					</button>
				</form>
				<button
					onClick={() => setIsRegistering(!isRegistering)}
					className="mt-4 text-sm text-rose-500 hover:underline w-full text-center">
					{isRegistering ? "¿Ya tienes cuenta?" : "Crear cuenta nueva"}
				</button>
			</div>
		</div>
	);
};

// --- CONSTANTES ---
const EXPENSE_TYPES = {
	STOCK: {
		label: "Material (Stock)",
		icon: Package,
		color: "text-blue-600",
		bg: "bg-blue-50",
	},
	RECURRING: {
		label: "Recurrente (Alquiler/Luz)",
		icon: Zap,
		color: "text-orange-600",
		bg: "bg-orange-50",
	},
	INVESTMENT: {
		label: "Inversión (Mobiliario)",
		icon: Armchair,
		color: "text-purple-600",
		bg: "bg-purple-50",
	},
};

// --- APP PRINCIPAL ---
const DermoManager = () => {
	const [user, setUser] = useState(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("dashboard");
	const [financeSubTab, setFinanceSubTab] = useState("income"); // 'income' | 'expense' (para móvil/organización)
	const [currentMonth, setCurrentMonth] = useState(
		new Date().toISOString().slice(0, 7)
	);
	const [toast, setToast] = useState(null);

	// Datos
	const [inventory, setInventory] = useState([]);
	const [treatments, setTreatments] = useState([]);
	const [entries, setEntries] = useState([]);
	const [recurringConfig, setRecurringConfig] = useState([]);

	// Modales y Estados UI
	const [showLogout, setShowLogout] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);
	const [clientName, setClientName] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);

	// Modales Configuración
	const [showRecurringModal, setShowRecurringModal] = useState(false);
	const [newRecurring, setNewRecurring] = useState({ name: "", amount: "" });

	// Inputs Finanzas Manuales
	const [manualEntry, setManualEntry] = useState({
		description: "",
		amount: "",
		category: "Otros",
		type: "expense",
	}); // Unified
	const [showManualEntryModal, setShowManualEntryModal] = useState(false);

	// Inputs Inventario/Tratamientos
	const [showAddInv, setShowAddInv] = useState(false);
	const [editingInv, setEditingInv] = useState(null);
	const [newInv, setNewInv] = useState({ name: "", unitCost: "", stock: "" });

	const [showAddTreat, setShowAddTreat] = useState(false);
	const [editingTreat, setEditingTreat] = useState(null);
	const [newTreat, setNewTreat] = useState({ name: "", price: "" });
	const [tempRecipe, setTempRecipe] = useState([]);
	const [recipeItem, setRecipeItem] = useState({ materialId: "", quantity: 1 });

	// --- CONEXIÓN ---
	useEffect(() => {
		return onAuthStateChanged(auth, (u) => {
			setUser(u);
			setAuthLoading(false);
		});
	}, []);

	useEffect(() => {
		if (!user) return;
		const base = `users/${user.uid}`;

		const unsub1 = onSnapshot(
			query(collection(db, `${base}/inventory`), orderBy("name")),
			(s) => setInventory(s.docs.map((d) => ({ ...d.data(), id: d.id })))
		);
		const unsub2 = onSnapshot(
			query(collection(db, `${base}/treatments`), orderBy("name")),
			(s) => setTreatments(s.docs.map((d) => ({ ...d.data(), id: d.id })))
		);
		const unsub3 = onSnapshot(
			query(collection(db, `${base}/finance_entries`), orderBy("date", "desc")),
			(s) => setEntries(s.docs.map((d) => ({ ...d.data(), id: d.id })))
		);
		const unsub4 = onSnapshot(
			query(collection(db, `${base}/recurring_config`), orderBy("name")),
			(s) => setRecurringConfig(s.docs.map((d) => ({ ...d.data(), id: d.id })))
		);

		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	}, [user]);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });
	const handleLogout = async () => {
		await signOut(auth);
		setShowLogout(false);
	};

	// --- LÓGICA DE NEGOCIO ---

	const calculateTreatmentCost = (recipe) =>
		recipe?.reduce((total, r) => {
			const item = inventory.find((m) => m.id === r.materialId);
			return total + (item ? item.unitCost * r.quantity : 0);
		}, 0) || 0;

	// 1. SESIONES
	const handleSession = async () => {
		if (!selectedTreatment) return;
		const missing = selectedTreatment.recipe?.find((r) => {
			const item = inventory.find((i) => i.id === r.materialId);
			return !item || item.stock < r.quantity;
		});

		if (missing) {
			showToastMsg("Falta material en inventario", "error");
			return;
		}

		try {
			selectedTreatment.recipe?.forEach(async (r) => {
				const item = inventory.find((i) => i.id === r.materialId);
				if (item)
					await updateDoc(
						doc(db, `users/${user.uid}/inventory`, r.materialId),
						{ stock: item.stock - r.quantity }
					);
			});

			const cost = calculateTreatmentCost(selectedTreatment.recipe);

			await addDoc(collection(db, `users/${user.uid}/finance_entries`), {
				date: new Date().toISOString().split("T")[0],
				type: "income",
				category: "Servicio",
				description: clientName
					? `${selectedTreatment.name} (${clientName})`
					: selectedTreatment.name,
				amount: Number(selectedTreatment.price),
				relatedCost: cost,
				recipeSnapshot: selectedTreatment.recipe,
				createdAt: new Date().toISOString(),
			});

			if (cost > 0) {
				await addDoc(collection(db, `users/${user.uid}/finance_entries`), {
					date: new Date().toISOString().split("T")[0],
					type: "expense",
					category: "Material",
					isAutomatic: true,
					description: `Material: ${selectedTreatment.name}`,
					amount: cost,
				});
			}

			showToastMsg("Sesión registrada");
			setSelectedTreatment(null);
			setClientName("");
		} catch (e) {
			showToastMsg("Error", "error");
		}
	};

	// 2. INVENTARIO CRUD
	const saveInventory = async () => {
		if (!newInv.name) return;
		try {
			if (editingInv)
				await updateDoc(doc(db, `users/${user.uid}/inventory`, editingInv.id), {
					...newInv,
					unitCost: Number(newInv.unitCost),
					stock: Number(newInv.stock),
				});
			else
				await addDoc(collection(db, `users/${user.uid}/inventory`), {
					...newInv,
					unitCost: Number(newInv.unitCost),
					stock: Number(newInv.stock),
					createdAt: new Date().toISOString(),
				});
			setNewInv({ name: "", unitCost: "", stock: "" });
			setEditingInv(null);
			setShowAddInv(false);
		} catch (e) {
			showToastMsg("Error al guardar", "error");
		}
	};

	const handleAddStock = async (item, qty, cost) => {
		await updateDoc(doc(db, `users/${user.uid}/inventory`, item.id), {
			stock: item.stock + Number(qty),
		});
		if (cost > 0)
			await addDoc(collection(db, `users/${user.uid}/finance_entries`), {
				date: new Date().toISOString().split("T")[0],
				type: "expense",
				expenseType: "STOCK",
				category: "Material",
				description: `Compra Stock: ${item.name}`,
				amount: Number(cost),
				createdAt: new Date().toISOString(),
			});
		showToastMsg("Stock actualizado");
	};

	// 3. TRATAMIENTOS CRUD
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
				await updateDoc(
					doc(db, `users/${user.uid}/treatments`, editingTreat.id),
					data
				);
			else
				await addDoc(collection(db, `users/${user.uid}/treatments`), {
					...data,
					createdAt: new Date().toISOString(),
				});
			setNewTreat({ name: "", price: "" });
			setTempRecipe([]);
			setEditingTreat(null);
			setShowAddTreat(false);
		} catch (e) {
			showToastMsg("Error al guardar", "error");
		}
	};

	const deleteItem = async (col, id) => {
		if (confirm("¿Seguro que quieres borrarlo?"))
			await deleteDoc(doc(db, `users/${user.uid}/${col}`, id));
	};

	// 4. FINANZAS
	const addRecurringConfig = async () => {
		if (!newRecurring.name || !newRecurring.amount) return;
		await addDoc(collection(db, `users/${user.uid}/recurring_config`), {
			name: newRecurring.name,
			amount: Number(newRecurring.amount),
		});
		setNewRecurring({ name: "", amount: "" });
	};

	const payRecurring = async (configItem) => {
		await addDoc(collection(db, `users/${user.uid}/finance_entries`), {
			date: new Date().toISOString().split("T")[0],
			type: "expense",
			category: "Fijo",
			description: configItem.name,
			amount: configItem.amount,
			recurringId: configItem.id,
			monthKey: currentMonth,
		});
		showToastMsg("Pago registrado");
	};

	// Nuevo: Añadir Ingreso/Gasto Manual Unificado
	const openManualEntryModal = (type) => {
		setManualEntry({
			description: "",
			amount: "",
			category: type === "income" ? "Extra" : "Otros",
			type: type,
		});
		setShowManualEntryModal(true);
	};

	const addManualEntry = async () => {
		if (!manualEntry.amount) return;
		await addDoc(collection(db, `users/${user.uid}/finance_entries`), {
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
		await deleteDoc(doc(db, `users/${user.uid}/finance_entries`, id));
		setConfirmDeleteId(null);
	};

	// --- CALCULOS ---
	const filteredEntries = useMemo(
		() => entries.filter((e) => e.date.startsWith(currentMonth)),
		[entries, currentMonth]
	);

	const income = filteredEntries
		.filter((e) => e.type === "income")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenseMaterial = filteredEntries
		.filter((e) => e.category === "Material")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenseFixed = filteredEntries
		.filter((e) => e.category === "Fijo")
		.reduce((acc, c) => acc + c.amount, 0);
	// Otros gastos ahora incluye todo lo que no sea Material ni Fijo
	const expenseOther = filteredEntries
		.filter(
			(e) =>
				e.type === "expense" &&
				e.category !== "Material" &&
				e.category !== "Fijo"
		)
		.reduce((acc, c) => acc + c.amount, 0);

	const netProfit = income - (expenseMaterial + expenseFixed + expenseOther);

	const chartData = useMemo(() => {
		const data = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const key = d.toISOString().slice(0, 7);
			const val = entries
				.filter((e) => e.date.startsWith(key) && e.type === "income")
				.reduce((acc, c) => acc + c.amount, 0);
			data.push({
				label: d.toLocaleString("es-ES", { month: "short" }),
				value: val,
			});
		}
		return data;
	}, [entries]);

	if (authLoading)
		return (
			<div className="min-h-screen flex items-center justify-center bg-rose-50">
				<Loader2 className="animate-spin text-rose-500" />
			</div>
		);
	if (!user) return <LoginScreen />;

	return (
		<div className="min-h-[100dvh] bg-gray-50 pb-24 md:pb-0 font-sans text-gray-800">
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
				/>
			)}
			<ConfirmModal
				isOpen={showLogout}
				title="Salir"
				message="¿Cerrar sesión?"
				onCancel={() => setShowLogout(false)}
				onConfirm={handleLogout}
				isDestructive
			/>
			<SessionModal
				isOpen={!!selectedTreatment}
				treatment={selectedTreatment}
				onClose={() => setSelectedTreatment(null)}
				onConfirm={handleSession}
			/>

			{/* NAVBARS */}
			<div className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:bg-white md:border-r z-20">
				<div className="h-20 flex items-center justify-center border-b">
					<h1 className="text-2xl font-bold text-rose-500">DermoApp</h1>
				</div>
				<nav className="p-4 space-y-2 flex-1">
					{[
						{ id: "dashboard", l: "Resumen", i: BarChart3 },
						{ id: "treatments", l: "Tratamientos", i: Syringe },
						{ id: "inventory", l: "Stock", i: Package },
						{ id: "finance", l: "Finanzas", i: DollarSign },
					].map((t) => (
						<button
							key={t.id}
							onClick={() => setActiveTab(t.id)}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
								activeTab === t.id
									? "bg-rose-500 text-white"
									: "text-gray-500 hover:bg-gray-50"
							}`}>
							<t.i size={20} /> {t.l}
						</button>
					))}
				</nav>
				<div className="p-4 border-t">
					<button
						onClick={() => setShowLogout(true)}
						className="flex items-center gap-3 text-red-500 font-medium">
						<LogOut size={20} /> Salir
					</button>
				</div>
			</div>
			<div className="md:hidden h-16 bg-white border-b sticky top-0 z-40 px-4 flex items-center justify-between shadow-sm">
				<span className="font-bold text-xl text-rose-500">DermoApp</span>
				<button onClick={() => setShowLogout(true)}>
					<LogOut size={16} className="text-gray-400" />
				</button>
			</div>

			<main className="md:pl-64 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
				{activeTab === "dashboard" && (
					<div className="space-y-6 animate-in fade-in">
						<div className="flex justify-between items-center">
							<div>
								<h2 className="text-2xl font-bold">
									Hola, {user.email?.split("@")[0]}
								</h2>
								<p className="text-sm text-gray-500">
									Tu negocio en {new Date().getFullYear()}
								</p>
							</div>
							<input
								type="month"
								value={currentMonth}
								onChange={(e) => setCurrentMonth(e.target.value)}
								className="bg-white border rounded-lg p-2 text-sm font-bold shadow-sm"
							/>
						</div>

						{/* CARDS REORDERED FOR UX */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
							<div className="lg:col-span-1">
								<StatCard
									title="Facturación"
									value={formatCurrency(income)}
									subtext="Bruto Total"
									gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
									icon={TrendingUp}
								/>
							</div>
							<div className="lg:col-span-1">
								<StatCard
									title="Beneficio Neto"
									value={formatCurrency(netProfit)}
									subtext="En Caja"
									gradient="bg-gradient-to-br from-rose-500 to-purple-600"
									icon={Sparkles}
								/>
							</div>
							<div className="lg:col-span-1">
								<StatCard
									title="Material"
									value={formatCurrency(expenseMaterial)}
									subtext="Variable"
									gradient="bg-gradient-to-br from-blue-400 to-blue-600"
									icon={Package}
								/>
							</div>
							<div className="lg:col-span-1">
								<StatCard
									title="Gastos Fijos"
									value={formatCurrency(expenseFixed)}
									subtext="Estructura"
									gradient="bg-gradient-to-br from-orange-400 to-orange-600"
									icon={Home}
								/>
							</div>
							<div className="lg:col-span-1">
								<StatCard
									title="Otros/Inv."
									value={formatCurrency(expenseOther)}
									subtext="Extras"
									gradient="bg-gradient-to-br from-gray-500 to-gray-700"
									icon={Tag}
								/>
							</div>
						</div>

						<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
							<h3 className="font-bold text-gray-700 mb-2">
								Tendencia de Ingresos
							</h3>
							<SmoothAreaChart data={chartData} />
						</div>
					</div>
				)}

				{/* --- PESTAÑA TRATAMIENTOS --- */}
				{activeTab === "treatments" && (
					<div className="space-y-6 animate-in fade-in">
						<div className="flex justify-between items-center gap-4">
							<div className="relative flex-1">
								<Search
									className="absolute left-3 top-3 text-gray-400"
									size={18}
								/>
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
												setRecipeItem({
													...recipeItem,
													materialId: e.target.value,
												})
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
												setRecipeItem({
													...recipeItem,
													quantity: e.target.value,
												})
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
													{mat?.name}{" "}
													<b className="text-rose-500">x{r.quantity}</b>{" "}
													<button
														onClick={() =>
															setTempRecipe(
																tempRecipe.filter((_, ix) => ix !== i)
															)
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
									t.name.toLowerCase().includes(searchTerm.toLowerCase())
								)
								.map((t) => {
									const cost = calculateTreatmentCost(t.recipe);
									const profit = t.price - cost;
									return (
										<div
											key={t.id}
											className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
											<div className="flex justify-between items-start mb-2">
												<h3 className="font-bold text-gray-800 text-lg">
													{t.name}
												</h3>
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
												<div className="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden flex">
													<div
														className="bg-rose-300 h-full"
														style={{
															width: `${(cost / t.price) * 100}%`,
														}}></div>
													<div
														className="bg-emerald-400 h-full"
														style={{
															width: `${(profit / t.price) * 100}%`,
														}}></div>
												</div>
											</div>
											<div className="flex gap-2">
												<button
													onClick={() => deleteItem("treatments", t.id)}
													className="p-2 text-gray-300 hover:text-red-500 bg-gray-50 rounded-lg">
													<Trash2 size={18} />
												</button>
												<button
													onClick={() => setSelectedTreatment(t)}
													className="flex-1 bg-gray-900 text-white rounded-lg font-bold text-sm py-2 hover:bg-black">
													Realizar Sesión
												</button>
											</div>
										</div>
									);
								})}
						</div>
					</div>
				)}

				{/* --- PESTAÑA INVENTARIO --- */}
				{activeTab === "inventory" && (
					<div className="space-y-6 animate-in fade-in">
						<div className="flex justify-between items-center gap-4">
							<div className="relative flex-1">
								<Search
									className="absolute left-3 top-3 text-gray-400"
									size={18}
								/>
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
										<label className="text-xs font-bold text-gray-500">
											Nombre
										</label>
										<input
											className="w-full p-3 border rounded-xl"
											value={newInv.name}
											onChange={(e) =>
												setNewInv({ ...newInv, name: e.target.value })
											}
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
										<label className="text-xs font-bold text-gray-500">
											Stock
										</label>
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
									i.name.toLowerCase().includes(searchTerm.toLowerCase())
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
												className={`flex flex-col items-end ${
													item.stock < 5 ? "text-red-500" : "text-gray-600"
												}`}>
												<span className="text-xl font-bold">{item.stock}</span>
												<span className="text-[10px] font-bold uppercase tracking-wider">
													Stock
												</span>
											</div>
											<button
												onClick={() => {
													const q = prompt("Cant?");
													if (q)
														handleAddStock(item, q, prompt("Coste total?"));
												}}
												className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100">
												<Plus size={20} />
											</button>
										</div>
									</div>
								))}
						</div>
					</div>
				)}

				{/* --- PESTAÑA FINANZAS (DIVIDIDA) --- */}
				{activeTab === "finance" && (
					<div className="space-y-6 animate-in fade-in">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold">Finanzas</h2>
							<div className="flex gap-2">
								<button
									onClick={() => setShowRecurringModal(!showRecurringModal)}
									className="bg-white border text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2">
									<Briefcase size={16} /> Config. Fijos
								</button>
							</div>
						</div>

						{/* MODAL CONFIG RECURRENTES */}
						{showRecurringModal && (
							<div className="bg-gray-100 p-4 rounded-2xl border border-gray-200 animate-in fade-in">
								<h4 className="font-bold text-sm text-gray-700 mb-3">
									Configurar gasto mensual
								</h4>
								<div className="flex gap-2 mb-4">
									<input
										placeholder="Nombre (ej. Alquiler)"
										className="flex-1 p-2 rounded-lg border text-sm"
										value={newRecurring.name}
										onChange={(e) =>
											setNewRecurring({ ...newRecurring, name: e.target.value })
										}
									/>
									<input
										type="number"
										placeholder="Importe (€)"
										className="w-24 p-2 rounded-lg border text-sm"
										value={newRecurring.amount}
										onChange={(e) =>
											setNewRecurring({
												...newRecurring,
												amount: e.target.value,
											})
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
												onClick={() => deleteItem("recurring_config", c.id)}
												className="text-red-400 hover:text-red-600">
												<Trash2 size={14} />
											</button>
										</div>
									))}
								</div>
							</div>
						)}

						{/* MODAL GASTO/INGRESO MANUAL */}
						{showManualEntryModal && (
							<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 animate-in zoom-in-95 mb-4">
								<div className="flex justify-between mb-4">
									<h3 className="font-bold">
										{manualEntry.type === "income"
											? "Registrar Ingreso Extra"
											: "Registrar Gasto"}
									</h3>
									<button onClick={() => setShowManualEntryModal(false)}>
										<X size={20} />
									</button>
								</div>
								<div className="grid gap-4">
									<input
										className="w-full p-3 border rounded-xl"
										placeholder={
											manualEntry.type === "income"
												? "Concepto (ej. Bono Regalo)"
												: "Concepto (ej. Silla nueva)"
										}
										value={manualEntry.description}
										onChange={(e) =>
											setManualEntry({
												...manualEntry,
												description: e.target.value,
											})
										}
									/>
									<div className="flex gap-2">
										<input
											type="number"
											className="flex-1 p-3 border rounded-xl"
											placeholder="Importe (€)"
											value={manualEntry.amount}
											onChange={(e) =>
												setManualEntry({
													...manualEntry,
													amount: e.target.value,
												})
											}
										/>
										{manualEntry.type === "expense" && (
											<select
												className="flex-1 p-3 border rounded-xl bg-white"
												value={manualEntry.category}
												onChange={(e) =>
													setManualEntry({
														...manualEntry,
														category: e.target.value,
													})
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
										className={`w-full text-white font-bold py-3 rounded-xl ${
											manualEntry.type === "income"
												? "bg-emerald-500 hover:bg-emerald-600"
												: "bg-rose-500 hover:bg-rose-600"
										}`}>
										{manualEntry.type === "income"
											? "Guardar Ingreso"
											: "Guardar Gasto"}
									</button>
								</div>
							</div>
						)}

						{/* GASTOS RECURRENTES (Avisos) */}
						{recurringConfig.length > 0 && (
							<div className="mb-6">
								<h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
									Pagos Recurrentes (
									{new Date(currentMonth).toLocaleString("es-ES", {
										month: "long",
									})}
									)
								</h3>
								<div className="flex gap-3 overflow-x-auto pb-2">
									{recurringConfig.map((conf) => {
										const isPaid = filteredEntries.some(
											(e) => e.recurringId === conf.id
										);
										return (
											<button
												key={conf.id}
												onClick={() => !isPaid && payRecurring(conf)}
												disabled={isPaid}
												className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
													isPaid
														? "bg-emerald-50 border-emerald-200 text-emerald-700"
														: "bg-white border-orange-200 text-gray-700 hover:border-orange-400 shadow-sm"
												}`}>
												{isPaid ? (
													<Check size={14} />
												) : (
													<Zap size={14} className="text-orange-500" />
												)}
												{conf.name}
											</button>
										);
									})}
								</div>
							</div>
						)}

						{/* LISTAS SEPARADAS: INGRESOS vs GASTOS */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* COLUMNA INGRESOS */}
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
										onClick={() => openManualEntryModal("income")}
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
										{filteredEntries.filter((e) => e.type === "income")
											.length === 0 && (
											<p className="p-4 text-center text-sm text-gray-400">
												Sin ingresos este mes.
											</p>
										)}
									</div>
								</div>
							</div>

							{/* COLUMNA GASTOS */}
							<div className="flex flex-col gap-4">
								<div className="flex justify-between items-end">
									<div>
										<h3 className="font-bold text-gray-700 flex items-center gap-2">
											<TrendingDown className="text-rose-500" /> Gastos
										</h3>
										<p className="text-2xl font-bold text-rose-600">
											{formatCurrency(
												expenseMaterial + expenseFixed + expenseOther
											)}
										</p>
									</div>
									<button
										onClick={() => openManualEntryModal("expense")}
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
															className={`w-1.5 h-1.5 rounded-full ${
																e.category === "Material"
																	? "bg-blue-400"
																	: e.category === "Fijo"
																	? "bg-orange-400"
																	: "bg-purple-400"
															}`}></div>
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
															className={`text-gray-300 hover:text-red-400 transition-all ${
																confirmDeleteId === e.id
																	? "text-red-500 scale-125"
																	: ""
															}`}>
															<Trash2 size={14} />
														</button>
													</div>
												</div>
											))}
										{filteredEntries.filter((e) => e.type === "expense")
											.length === 0 && (
											<p className="p-4 text-center text-sm text-gray-400">
												Sin gastos este mes.
											</p>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</main>

			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
				{[
					{ id: "dashboard", l: "Inicio", i: BarChart3 },
					{ id: "treatments", l: "Tratar", i: Syringe },
					{ id: "inventory", l: "Stock", i: Package },
					{ id: "finance", l: "Finanzas", i: DollarSign },
				].map((t) => (
					<button
						key={t.id}
						onClick={() => setActiveTab(t.id)}
						className={`flex flex-col items-center gap-1 ${
							activeTab === t.id ? "text-rose-500" : "text-gray-400"
						}`}>
						<t.i size={20} />{" "}
						<span className="text-[10px] font-medium">{t.l}</span>
					</button>
				))}
			</div>
		</div>
	);
};

export default DermoManager;
