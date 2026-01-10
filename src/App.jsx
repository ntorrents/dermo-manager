import React, { useState, useEffect, useMemo } from "react";
import {
	Plus,
	Trash2,
	TrendingUp,
	TrendingDown,
	DollarSign,
	FileText,
	Download,
	Package,
	Syringe,
	Calendar,
	BarChart3,
	AlertCircle,
	CheckCircle,
	Loader2,
	X,
	Search,
	Sparkles,
	Minus,
	AlertTriangle,
	LogOut,
	Lock,
	Mail,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
	getAuth,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	GoogleAuthProvider, // Importamos el proveedor de Google
	signInWithPopup, // Importamos la función de ventana emergente
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
	getDoc,
} from "firebase/firestore";

// --- CONFIGURACIÓN FIREBASE (Directa) ---
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

// --- COMPONENTES UI ---

const Toast = ({ message, type, onClose }) => {
	useEffect(() => {
		const timer = setTimeout(onClose, 3000);
		return () => clearTimeout(timer);
	}, [onClose]);

	return (
		<div
			className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-in slide-in-from-top-5 fade-in duration-300 ${
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

// Modal de Confirmación Genérico (Elegante)
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
							className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">
							Cancelar
						</button>
						<button
							onClick={onConfirm}
							className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl shadow-sm transition-transform active:scale-95 ${
								isDestructive
									? "bg-red-500 hover:bg-red-600"
									: "bg-rose-500 hover:bg-rose-600"
							}`}>
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
		className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${gradient}`}>
		<div className="relative z-10 flex justify-between items-start">
			<div>
				<p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">
					{title}
				</p>
				<h3 className="text-3xl font-bold tracking-tight">{value}</h3>
				{subtext && (
					<p className="text-white/70 text-xs mt-2 font-medium">{subtext}</p>
				)}
			</div>
			<div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
				<Icon size={24} className="text-white" />
			</div>
		</div>
		<div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
	</div>
);

// --- COMPONENTE DE LOGIN ---
const LoginScreen = () => {
	const [isRegistering, setIsRegistering] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	// Manejador para Login con Google
	const handleGoogleLogin = async () => {
		setError("");
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
			// El onAuthStateChanged se encargará del resto
		} catch (err) {
			console.error(err);
			setError("No se pudo iniciar sesión con Google.");
		}
	};

	const handleAuth = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			if (isRegistering) {
				await createUserWithEmailAndPassword(auth, email, password);
			} else {
				await signInWithEmailAndPassword(auth, email, password);
			}
		} catch (err) {
			console.error(err);
			if (err.code === "auth/invalid-credential")
				setError("Email o contraseña incorrectos.");
			else if (err.code === "auth/email-already-in-use")
				setError("Este email ya está registrado.");
			else if (err.code === "auth/weak-password")
				setError("La contraseña debe tener al menos 6 caracteres.");
			else setError("Error de conexión. Inténtalo de nuevo.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
			<div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-rose-100">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent mb-2">
						DermoApp
					</h1>
					<p className="text-gray-500 text-sm">
						Gestión profesional para tu negocio
					</p>
				</div>

				<form onSubmit={handleAuth} className="space-y-4">
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">
							Email
						</label>
						<div className="relative">
							<Mail className="absolute left-3 top-3 text-gray-400" size={18} />
							<input
								type="email"
								required
								className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all bg-gray-50 focus:bg-white"
								placeholder="ejemplo@dermo.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
					</div>
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">
							Contraseña
						</label>
						<div className="relative">
							<Lock className="absolute left-3 top-3 text-gray-400" size={18} />
							<input
								type="password"
								required
								className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all bg-gray-50 focus:bg-white"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
					</div>

					{error && (
						<div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
							<AlertTriangle size={16} /> {error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-rose-500 text-white font-bold py-3.5 rounded-xl hover:bg-rose-600 transition-transform active:scale-95 shadow-lg shadow-rose-200 flex justify-center items-center">
						{loading ? (
							<Loader2 className="animate-spin" />
						) : isRegistering ? (
							"Crear Cuenta"
						) : (
							"Iniciar Sesión"
						)}
					</button>
				</form>

				{/* Separador */}
				<div className="relative flex py-5 items-center">
					<div className="flex-grow border-t border-gray-200"></div>
					<span className="flex-shrink-0 mx-4 text-gray-400 text-xs">
						O continúa con
					</span>
					<div className="flex-grow border-t border-gray-200"></div>
				</div>

				{/* Botón de Google */}
				<button
					onClick={handleGoogleLogin}
					type="button"
					className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-transform active:scale-95 shadow-sm flex justify-center items-center gap-3">
					<svg className="w-5 h-5" viewBox="0 0 24 24">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Google
				</button>

				<div className="mt-6 text-center">
					<p className="text-sm text-gray-500">
						{isRegistering ? "¿Ya tienes cuenta?" : "¿Eres nueva aquí?"}
						<button
							onClick={() => {
								setIsRegistering(!isRegistering);
								setError("");
							}}
							className="ml-2 text-rose-600 font-bold hover:underline">
							{isRegistering ? "Inicia Sesión" : "Regístrate con Email"}
						</button>
					</p>
				</div>
			</div>
		</div>
	);
};

// --- APP PRINCIPAL ---

const DermoManager = () => {
	const [user, setUser] = useState(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("dashboard");
	const [currentMonth, setCurrentMonth] = useState(
		new Date().toISOString().slice(0, 7)
	);
	const [toast, setToast] = useState(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Nuevo estado para el modal

	const [inventory, setInventory] = useState([]);
	const [treatments, setTreatments] = useState([]);
	const [entries, setEntries] = useState([]);

	const [showAddMaterial, setShowAddMaterial] = useState(false);
	const [showAddTreatment, setShowAddTreatment] = useState(false);
	const [showAddEntry, setShowAddEntry] = useState(false);

	const [newMaterial, setNewMaterial] = useState({
		name: "",
		unitCost: "",
		stock: "",
		unit: "ud",
	});
	const [newTreatmentName, setNewTreatmentName] = useState("");
	const [newTreatmentPrice, setNewTreatmentPrice] = useState("");
	const [newRecipeItem, setNewRecipeItem] = useState({
		materialId: "",
		quantity: 1,
	});
	const [tempRecipe, setTempRecipe] = useState([]);
	const [newEntry, setNewEntry] = useState({
		date: new Date().toISOString().split("T")[0],
		type: "expense",
		category: "Otros",
		description: "",
		amount: "",
	});

	// --- CONEXIÓN ---
	useEffect(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setAuthLoading(false);
		});
		return () => unsubscribeAuth();
	}, []);

	useEffect(() => {
		if (!user) {
			setInventory([]);
			setTreatments([]);
			setEntries([]);
			return;
		}
		const inventoryRef = collection(db, "users", user.uid, "inventory");
		const treatmentsRef = collection(db, "users", user.uid, "treatments");
		const entriesRef = collection(db, "users", user.uid, "finance_entries");

		const unsub1 = onSnapshot(query(inventoryRef, orderBy("name")), (snap) =>
			setInventory(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
		);
		const unsub2 = onSnapshot(query(treatmentsRef, orderBy("name")), (snap) =>
			setTreatments(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
		);
		const unsub3 = onSnapshot(
			query(entriesRef, orderBy("date", "desc")),
			(snap) => setEntries(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
		);

		return () => {
			unsub1();
			unsub2();
			unsub3();
		};
	}, [user]);

	const showToast = (message, type = "success") => setToast({ message, type });

	// Función Logout actualizada para usar Modal
	const handleLogout = async () => {
		await signOut(auth);
		setShowLogoutConfirm(false);
	};

	// --- LÓGICA DE NEGOCIO ---

	const handleAddMaterial = async () => {
		if (!newMaterial.name) return;
		try {
			await addDoc(collection(db, "users", user.uid, "inventory"), {
				...newMaterial,
				unitCost: Number(newMaterial.unitCost),
				stock: Number(newMaterial.stock),
				createdAt: new Date().toISOString(),
			});
			setNewMaterial({ name: "", unitCost: "", stock: "", unit: "ud" });
			setShowAddMaterial(false);
			showToast("Material añadido");
		} catch (e) {
			showToast("Error al guardar", "error");
		}
	};

	const handleAddStock = async (item, qty, cost) => {
		try {
			await updateDoc(doc(db, "users", user.uid, "inventory", item.id), {
				stock: item.stock + Number(qty),
			});
			await addDoc(collection(db, "users", user.uid, "finance_entries"), {
				date: new Date().toISOString().split("T")[0],
				type: "expense",
				category: "Material",
				description: `Compra Stock: ${item.name}`,
				amount: Number(cost),
				createdAt: new Date().toISOString(),
			});
			showToast(`Stock de ${item.name} aumentado`);
		} catch (e) {
			showToast("Error en la compra", "error");
		}
	};

	const handleReduceStock = async (item) => {
		const qty = prompt(
			`¿Cuántas unidades de ${item.name} vas a dar de baja (rotura, pérdida, etc.)?`
		);
		if (!qty) return;

		const reason = prompt("Motivo de la baja (opcional):", "Rotura/Merma");

		try {
			await updateDoc(doc(db, "users", user.uid, "inventory", item.id), {
				stock: Math.max(0, item.stock - Number(qty)),
			});
			await addDoc(collection(db, "users", user.uid, "finance_entries"), {
				date: new Date().toISOString().split("T")[0],
				type: "expense",
				category: "Merma",
				description: `Baja Stock (${qty} ${item.unit}): ${reason || "Merma"}`,
				amount: 0,
				createdAt: new Date().toISOString(),
			});

			showToast(`Dadas de baja ${qty} uds de ${item.name}`);
		} catch (e) {
			showToast("Error al actualizar", "error");
		}
	};

	const handleSaveTreatment = async () => {
		if (!newTreatmentName || !newTreatmentPrice) return;
		try {
			await addDoc(collection(db, "users", user.uid, "treatments"), {
				name: newTreatmentName,
				price: Number(newTreatmentPrice),
				recipe: tempRecipe,
				createdAt: new Date().toISOString(),
			});
			setNewTreatmentName("");
			setNewTreatmentPrice("");
			setTempRecipe([]);
			setShowAddTreatment(false);
			showToast("Tratamiento creado");
		} catch (e) {
			showToast("Error al crear", "error");
		}
	};

	const handleRegisterSession = async (treatment) => {
		const missingStock = treatment.recipe.find((item) => {
			const material = inventory.find((m) => m.id === item.materialId);
			return !material || material.stock < item.quantity;
		});

		if (missingStock) {
			const matName =
				inventory.find((m) => m.id === missingStock.materialId)?.name ||
				"Material desconocido";
			showToast(`¡Falta stock de ${matName}!`, "error");
			return;
		}

		try {
			for (const item of treatment.recipe) {
				const material = inventory.find((m) => m.id === item.materialId);
				if (material) {
					await updateDoc(
						doc(db, "users", user.uid, "inventory", item.materialId),
						{ stock: material.stock - item.quantity }
					);
				}
			}
			await addDoc(collection(db, "users", user.uid, "finance_entries"), {
				date: new Date().toISOString().split("T")[0],
				type: "income",
				category: "Servicio",
				description: `Sesión: ${treatment.name}`,
				amount: treatment.price,
				recipeSnapshot: treatment.recipe,
				createdAt: new Date().toISOString(),
			});
			showToast(`Sesión de ${treatment.name} registrada`);
		} catch (e) {
			showToast("Error al registrar sesión", "error");
		}
	};

	const handleAddEntry = async () => {
		if (!newEntry.amount) return;
		try {
			await addDoc(collection(db, "users", user.uid, "finance_entries"), {
				...newEntry,
				amount: Number(newEntry.amount),
				createdAt: new Date().toISOString(),
			});
			setNewEntry({ ...newEntry, description: "", amount: "" });
			setShowAddEntry(false);
			showToast("Movimiento registrado");
		} catch (e) {
			showToast("Error al guardar", "error");
		}
	};

	const handleDeleteEntry = async (entry) => {
		if (confirmDeleteId !== entry.id) {
			setConfirmDeleteId(entry.id);
			setTimeout(() => setConfirmDeleteId(null), 4000);
			return;
		}

		try {
			if (entry.recipeSnapshot && Array.isArray(entry.recipeSnapshot)) {
				for (const item of entry.recipeSnapshot) {
					const material = inventory.find((m) => m.id === item.materialId);
					if (material) {
						await updateDoc(
							doc(db, "users", user.uid, "inventory", item.materialId),
							{
								stock: material.stock + item.quantity,
							}
						);
					}
				}
				showToast("Sesión eliminada y stock restaurado");
			} else {
				showToast("Movimiento eliminado");
			}
			await deleteDoc(doc(db, "users", user.uid, "finance_entries", entry.id));
			setConfirmDeleteId(null);
		} catch (e) {
			showToast("Error al borrar", "error");
		}
	};

	const calculateTreatmentCost = (recipe) =>
		recipe.reduce((total, item) => {
			const material = inventory.find((m) => m.id === item.materialId);
			return total + (material ? material.unitCost * item.quantity : 0);
		}, 0);

	const addToRecipe = () => {
		if (!newRecipeItem.materialId) return;
		setTempRecipe([
			...tempRecipe,
			{
				materialId: newRecipeItem.materialId,
				quantity: Number(newRecipeItem.quantity),
			},
		]);
		setNewRecipeItem({ materialId: "", quantity: 1 });
	};

	const filteredEntries = useMemo(
		() => entries.filter((e) => e.date && e.date.startsWith(currentMonth)),
		[entries, currentMonth]
	);
	const totalIncome = filteredEntries
		.filter((e) => e.type === "income")
		.reduce((acc, curr) => acc + curr.amount, 0);
	const totalExpense = filteredEntries
		.filter((e) => e.type === "expense")
		.reduce((acc, curr) => acc + curr.amount, 0);

	const exportData = () => {
		let csv = "Tipo,Fecha,Categoria,Descripcion,Importe\n";
		entries.forEach(
			(e) =>
				(csv += `${e.type},${e.date},${e.category},${e.description},${e.amount}\n`)
		);
		const link = document.createElement("a");
		link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
		link.download = `dermo_data_${currentMonth}.csv`;
		link.click();
	};

	// --- RENDERIZADO CONDICIONAL ---

	// 1. Cargando...
	if (authLoading)
		return (
			<div className="min-h-screen flex items-center justify-center bg-rose-50">
				<Loader2 className="animate-spin text-rose-500" size={48} />
			</div>
		);

	// 2. Si no hay usuario, mostrar Login
	if (!user) return <LoginScreen />;

	// 3. Si hay usuario, mostrar la App completa (Dashboard)
	return (
		<div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:pb-0">
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
				/>
			)}

			{/* MODAL CONFIRMACIÓN LOGOUT */}
			<ConfirmModal
				isOpen={showLogoutConfirm}
				title="Cerrar Sesión"
				message="¿Seguro que quieres salir? Tendrás que volver a ingresar tus datos."
				onCancel={() => setShowLogoutConfirm(false)}
				onConfirm={handleLogout}
				isDestructive={true}
			/>

			{/* SIDEBAR DESKTOP */}
			<div className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:bg-white md:border-r md:shadow-sm z-20">
				<div className="flex items-center justify-center h-20 border-b bg-rose-50">
					<h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">
						DermoApp
					</h1>
				</div>
				<nav className="flex-1 space-y-2 p-4">
					{[
						{ id: "dashboard", icon: BarChart3, label: "Resumen" },
						{ id: "treatments", icon: Syringe, label: "Tratamientos" },
						{ id: "inventory", icon: Package, label: "Inventario" },
						{ id: "finance", icon: DollarSign, label: "Finanzas" },
					].map((item) => (
						<button
							key={item.id}
							onClick={() => setActiveTab(item.id)}
							className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
								activeTab === item.id
									? "bg-rose-500 text-white shadow-lg shadow-rose-200"
									: "text-gray-500 hover:bg-rose-50 hover:text-rose-600"
							}`}>
							<item.icon size={20} /> <span>{item.label}</span>
						</button>
					))}
				</nav>
				<div className="p-4 border-t">
					<button
						onClick={() => setShowLogoutConfirm(true)}
						className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium">
						<LogOut size={20} /> <span>Cerrar Sesión</span>
					</button>
				</div>
			</div>

			{/* HEADER MOBILE */}
			<div className="md:hidden bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between shadow-sm">
				<span className="font-bold text-xl bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">
					DermoApp
				</span>
				<button
					onClick={() => setShowLogoutConfirm(true)}
					className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-red-100 hover:text-red-500 transition-colors">
					<LogOut size={16} />
				</button>
			</div>

			{/* MAIN */}
			<main className="md:pl-64 p-4 md:p-8 max-w-7xl mx-auto space-y-6">
				{/* DASHBOARD */}
				{activeTab === "dashboard" && (
					<div className="space-y-6 animate-in fade-in duration-500">
						<div className="flex justify-between items-center">
							<div>
								<h2 className="text-2xl font-bold text-gray-800">
									Hola, {user.email?.split("@")[0]} 👋
								</h2>
								<p className="text-gray-500 text-sm">
									Resumen de {currentMonth}
								</p>
							</div>
							<input
								type="month"
								value={currentMonth}
								onChange={(e) => setCurrentMonth(e.target.value)}
								className="bg-white border-none shadow-sm rounded-lg px-3 py-2 text-sm font-medium text-gray-600 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer hover:bg-gray-50"
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<StatCard
								title="Ingresos"
								value={`${totalIncome.toFixed(0)}€`}
								subtext={`${
									filteredEntries.filter((e) => e.type === "income").length
								} sesiones`}
								gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
								icon={TrendingUp}
							/>
							<StatCard
								title="Gastos"
								value={`${totalExpense.toFixed(0)}€`}
								subtext="Material y Fijos"
								gradient="bg-gradient-to-br from-rose-400 to-rose-600"
								icon={TrendingDown}
							/>
							<StatCard
								title="Beneficio Neto"
								value={`${(totalIncome - totalExpense).toFixed(0)}€`}
								subtext={`Margen: ${
									totalIncome > 0
										? (
												((totalIncome - totalExpense) / totalIncome) *
												100
										  ).toFixed(0)
										: 0
								}%`}
								gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
								icon={Sparkles}
							/>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
								<h3 className="font-bold text-gray-800 mb-4 flex items-center">
									<Syringe className="mr-2 text-rose-500" size={20} />
									Sesión Rápida
								</h3>
								{treatments.length === 0 ? (
									<div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
										<p className="text-gray-400 text-sm mb-2">
											No hay tratamientos creados
										</p>
										<button
											onClick={() => setActiveTab("treatments")}
											className="text-rose-500 font-medium text-sm hover:underline">
											Crear el primero
										</button>
									</div>
								) : (
									<div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
										{treatments.map((t) => (
											<div
												key={t.id}
												className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-transparent hover:border-rose-100 transition-all">
												<span className="font-semibold text-gray-700">
													{t.name}
												</span>
												<div className="flex items-center space-x-2">
													<button
														onClick={() => handleRegisterSession(t)}
														className="bg-white text-gray-700 hover:bg-rose-500 hover:text-white border hover:border-rose-500 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
														<span>Registrar</span>
														<span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-bold">
															{t.price}€
														</span>
													</button>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
								<h3 className="font-bold text-gray-800 mb-4 flex items-center">
									<AlertCircle className="mr-2 text-orange-400" size={20} />
									Aviso de Stock
								</h3>
								<div className="space-y-3">
									{inventory.filter((i) => i.stock < 10).length === 0 ? (
										<div className="flex flex-col items-center justify-center h-40 text-gray-400">
											<CheckCircle
												size={40}
												className="mb-2 text-emerald-100"
											/>
											<p className="text-sm">
												Todo el inventario está correcto
											</p>
										</div>
									) : (
										inventory
											.filter((i) => i.stock < 10)
											.map((item) => (
												<div
													key={item.id}
													className="flex justify-between items-center p-3 bg-orange-50/50 rounded-xl border border-orange-100">
													<div className="flex items-center space-x-3">
														<div
															className={`w-2 h-2 rounded-full ${
																item.stock === 0
																	? "bg-red-500"
																	: "bg-orange-400"
															}`}></div>
														<span className="text-gray-700 font-medium">
															{item.name}
														</span>
													</div>
													<span
														className={`px-2 py-1 rounded-lg text-xs font-bold ${
															item.stock === 0
																? "bg-red-100 text-red-600"
																: "bg-orange-100 text-orange-600"
														}`}>
														{item.stock} {item.unit}
													</span>
												</div>
											))
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* TRATAMIENTOS */}
				{activeTab === "treatments" && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold text-gray-800">Tratamientos</h2>
							<button
								onClick={() => setShowAddTreatment(!showAddTreatment)}
								className="bg-rose-500 text-white p-3 rounded-full shadow-lg shadow-rose-200 hover:bg-rose-600 hover:scale-105 transition-all">
								{showAddTreatment ? <X size={24} /> : <Plus size={24} />}
							</button>
						</div>

						{showAddTreatment && (
							<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 animate-in zoom-in-95 duration-200">
								<h3 className="font-bold text-gray-800 mb-4">
									Diseñar Nuevo Tratamiento
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
									<input
										className="input-field"
										placeholder="Nombre (ej. Botox Completo)"
										value={newTreatmentName}
										onChange={(e) => setNewTreatmentName(e.target.value)}
									/>
									<input
										type="number"
										className="input-field"
										placeholder="Precio Venta (€)"
										value={newTreatmentPrice}
										onChange={(e) => setNewTreatmentPrice(e.target.value)}
									/>
								</div>
								<div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
									<p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
										Materiales necesarios (Receta)
									</p>
									<div className="flex gap-2 mb-3">
										<select
											className="input-field flex-1"
											value={newRecipeItem.materialId}
											onChange={(e) =>
												setNewRecipeItem({
													...newRecipeItem,
													materialId: e.target.value,
												})
											}>
											<option value="">Añadir material...</option>
											{inventory.map((m) => (
												<option key={m.id} value={m.id}>
													{m.name} ({m.unitCost}€)
												</option>
											))}
										</select>
										<input
											type="number"
											placeholder="Cant."
											className="input-field w-20 text-center"
											value={newRecipeItem.quantity}
											onChange={(e) =>
												setNewRecipeItem({
													...newRecipeItem,
													quantity: e.target.value,
												})
											}
										/>
										<button
											onClick={addToRecipe}
											className="bg-gray-200 hover:bg-gray-300 px-4 rounded-xl transition-colors">
											<Plus size={20} />
										</button>
									</div>
									<div className="flex flex-wrap gap-2">
										{tempRecipe.map((r, i) => {
											const mat = inventory.find((m) => m.id === r.materialId);
											return (
												<span
													key={i}
													className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white border shadow-sm text-gray-700">
													{mat?.name}{" "}
													<span className="text-rose-500 ml-1 font-bold">
														x{r.quantity}
													</span>
												</span>
											);
										})}
									</div>
								</div>
								<button
									onClick={handleSaveTreatment}
									className="w-full btn-primary py-3">
									Guardar Tratamiento
								</button>
							</div>
						)}

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{treatments.map((t) => {
								const cost = calculateTreatmentCost(t.recipe);
								const profit = t.price - cost;
								return (
									<div
										key={t.id}
										className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
										<div className="relative z-10">
											<h3 className="font-bold text-lg text-gray-800 mb-1">
												{t.name}
											</h3>
											<div className="flex items-baseline space-x-2 mb-4">
												<span className="text-2xl font-bold text-rose-500">
													{t.price}€
												</span>
												<span className="text-xs text-gray-400">PVP</span>
											</div>

											<div className="space-y-2 mb-4">
												<div className="flex justify-between text-sm">
													<span className="text-gray-500">Coste Material</span>
													<span className="font-medium text-gray-700">
														{cost.toFixed(2)}€
													</span>
												</div>
												<div className="flex justify-between text-sm">
													<span className="text-gray-500">Beneficio Neto</span>
													<span className="font-bold text-emerald-600">
														{profit.toFixed(2)}€
													</span>
												</div>
												<div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
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

											<button
												onClick={() => handleRegisterSession(t)}
												className="w-full py-2 rounded-lg bg-gray-800 text-white font-medium text-sm hover:bg-gray-900 transition-colors shadow-sm">
												Realizar Sesión
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* INVENTARIO */}
				{activeTab === "inventory" && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold text-gray-800">Almacén</h2>
							<button
								onClick={() => setShowAddMaterial(!showAddMaterial)}
								className="bg-rose-500 text-white p-3 rounded-full shadow-lg shadow-rose-200 hover:bg-rose-600 hover:scale-105 transition-all">
								{showAddMaterial ? <X size={24} /> : <Plus size={24} />}
							</button>
						</div>

						{showAddMaterial && (
							<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 animate-in zoom-in-95 duration-200">
								<h3 className="font-bold text-gray-800 mb-4">Nuevo Material</h3>
								<div className="flex flex-wrap gap-4 items-end">
									<div className="flex-1 min-w-[200px]">
										<label className="label">Nombre</label>
										<input
											placeholder="Ej. Agujas 12p"
											className="input-field w-full"
											value={newMaterial.name}
											onChange={(e) =>
												setNewMaterial({ ...newMaterial, name: e.target.value })
											}
										/>
									</div>
									<div className="w-24">
										<label className="label">Coste Unit.</label>
										<input
											type="number"
											placeholder="0.00"
											className="input-field w-full"
											value={newMaterial.unitCost}
											onChange={(e) =>
												setNewMaterial({
													...newMaterial,
													unitCost: e.target.value,
												})
											}
										/>
									</div>
									<div className="w-24">
										<label className="label">Stock Ini.</label>
										<input
											type="number"
											placeholder="0"
											className="input-field w-full"
											value={newMaterial.stock}
											onChange={(e) =>
												setNewMaterial({
													...newMaterial,
													stock: e.target.value,
												})
											}
										/>
									</div>
									<button
										onClick={handleAddMaterial}
										className="btn-primary px-6 py-2.5 h-[42px] mb-[1px]">
										Guardar
									</button>
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{inventory.map((item) => (
								<div
									key={item.id}
									className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
									<div>
										<p className="font-bold text-gray-800">{item.name}</p>
										<p className="text-sm text-gray-400">
											Coste: {item.unitCost}€ / ud
										</p>
									</div>
									<div className="flex items-center gap-2">
										<div
											className={`flex flex-col items-end mr-3 ${
												item.stock < 5 ? "text-red-500" : "text-gray-600"
											}`}>
											<span className="text-xl font-bold">{item.stock}</span>
											<span className="text-[10px] uppercase font-bold tracking-wider">
												Stock
											</span>
										</div>
										<button
											onClick={() => handleReduceStock(item)}
											className="bg-gray-50 text-gray-500 p-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors border border-gray-100"
											title="Restar Stock (Rotura/Pérdida)">
											<Minus size={18} />
										</button>
										<button
											onClick={() => {
												const qty = prompt(
													`¿Cuántas unidades de ${item.name} has comprado?`
												);
												if (qty) {
													const cost = prompt("¿Coste TOTAL de esta compra?");
													if (cost) handleAddStock(item, qty, cost);
												}
											}}
											className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100 transition-colors border border-rose-100"
											title="Añadir Compra">
											<Plus size={18} />
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* FINANZAS */}
				{activeTab === "finance" && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold text-gray-800">Libro Diario</h2>
							<div className="flex space-x-2">
								<button
									onClick={exportData}
									className="bg-white border border-gray-200 text-gray-600 p-2 rounded-xl hover:bg-gray-50">
									<Download size={20} />
								</button>
								<button
									onClick={() => setShowAddEntry(!showAddEntry)}
									className="bg-rose-500 text-white p-3 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600">
									{showAddEntry ? <X size={20} /> : <Plus size={20} />}
								</button>
							</div>
						</div>

						{showAddEntry && (
							<div className="bg-white p-6 rounded-2xl shadow-lg border border-rose-100 animate-in zoom-in-95 duration-200">
								<h3 className="font-bold text-gray-800 mb-4">
									Añadir Movimiento Manual
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
									<input
										type="date"
										className="input-field"
										value={newEntry.date}
										onChange={(e) =>
											setNewEntry({ ...newEntry, date: e.target.value })
										}
									/>
									<select
										className="input-field"
										value={newEntry.type}
										onChange={(e) =>
											setNewEntry({ ...newEntry, type: e.target.value })
										}>
										<option value="income">Ingreso (+)</option>
										<option value="expense">Gasto (-)</option>
									</select>
									<input
										className="input-field md:col-span-2"
										placeholder="Concepto (ej. Alquiler cabina)"
										value={newEntry.description}
										onChange={(e) =>
											setNewEntry({ ...newEntry, description: e.target.value })
										}
									/>
									<input
										type="number"
										className="input-field"
										placeholder="Importe (€)"
										value={newEntry.amount}
										onChange={(e) =>
											setNewEntry({ ...newEntry, amount: e.target.value })
										}
									/>
									<button onClick={handleAddEntry} className="btn-primary">
										Registrar
									</button>
								</div>
							</div>
						)}

						<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
							{filteredEntries.map((entry, index) => (
								<div
									key={entry.id}
									className={`p-4 flex justify-between items-center hover:bg-gray-50 transition-colors ${
										index !== filteredEntries.length - 1
											? "border-b border-gray-100"
											: ""
									}`}>
									<div className="flex items-center space-x-4">
										<div
											className={`p-2 rounded-full ${
												entry.type === "income"
													? "bg-emerald-100 text-emerald-600"
													: "bg-rose-100 text-rose-600"
											}`}>
											{entry.category === "Merma" ? (
												<AlertTriangle size={18} />
											) : entry.type === "income" ? (
												<TrendingUp size={18} />
											) : (
												<TrendingDown size={18} />
											)}
										</div>
										<div>
											<p className="font-bold text-gray-800 text-sm md:text-base">
												{entry.description}
											</p>
											<p className="text-xs text-gray-400">
												{entry.date} • {entry.category}
											</p>
										</div>
									</div>
									<div className="flex items-center space-x-4">
										<span
											className={`font-bold text-sm md:text-base ${
												entry.category === "Merma"
													? "text-orange-500"
													: entry.type === "income"
													? "text-emerald-600"
													: "text-rose-600"
											}`}>
											{entry.type === "income" ? "+" : "-"}
											{entry.amount}€
										</span>
										{/* Botón de Borrado Suave */}
										<button
											onClick={() => handleDeleteEntry(entry)}
											className={`transition-all duration-200 flex items-center gap-1 ${
												confirmDeleteId === entry.id
													? "bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold"
													: "text-gray-300 hover:text-red-400"
											}`}>
											{confirmDeleteId === entry.id ? (
												"¿Borrar?"
											) : (
												<Trash2 size={16} />
											)}
										</button>
									</div>
								</div>
							))}
							{filteredEntries.length === 0 && (
								<div className="p-8 text-center text-gray-400">
									<p>No hay movimientos este mes</p>
								</div>
							)}
						</div>
					</div>
				)}
			</main>

			{/* BOTTOM NAV MOBILE */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 z-50 px-2 pb-safe">
				{[
					{ id: "dashboard", icon: BarChart3, label: "Inicio" },
					{ id: "treatments", icon: Syringe, label: "Tratar" },
					{ id: "inventory", icon: Package, label: "Stock" },
					{ id: "finance", icon: DollarSign, label: "Caja" },
				].map((item) => (
					<button
						key={item.id}
						onClick={() => setActiveTab(item.id)}
						className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
							activeTab === item.id ? "text-rose-500" : "text-gray-400"
						}`}>
						<item.icon
							size={activeTab === item.id ? 24 : 22}
							strokeWidth={activeTab === item.id ? 2.5 : 2}
						/>
						<span className="text-[10px] font-medium">{item.label}</span>
					</button>
				))}
			</div>
		</div>
	);
};

export default DermoManager;
