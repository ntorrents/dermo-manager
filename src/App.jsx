import React, { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

// Contexto y Autenticación
import { useAuth } from "./context/AuthContext";
import { logout } from "./services/auth";
import { supabase } from "./services/supabase"; // Importación esencial corregida

// Hooks de datos (Migrados a Supabase)
import { useData } from "./hooks/useData";
import { useProfile } from "./hooks/useProfile";
import { useClients } from "./hooks/useClients";

// UI Components
import { Toast } from "./components/ui/Toast";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { SessionModal } from "./components/ui/SessionModal";
import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";

// Tabs
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { TreatmentsTab } from "./components/treatments/TreatmentsTab";
import { InventoryTab } from "./components/inventory/InventoryTab";
import { FinanceTab } from "./components/finance/FinanceTab";
import { SettingsTab } from "./components/settings/SettingsTab";
import { ClientsTab } from "./components/clients/ClientsTab";

const DermoManager = () => {
	const { user, loading: authLoading } = useAuth();

	// Hooks de datos
	const {
		inventory,
		treatments,
		entries,
		recurringConfig,
		loading: dataLoading,
	} = useData(user);
	const profile = useProfile(user);
	const { clients } = useClients(user);

	const [activeTab, setActiveTab] = useState("dashboard");
	const [currentMonth, setCurrentMonth] = useState(
		new Date().toISOString().slice(0, 7)
	);
	const [toast, setToast] = useState(null);
	const [showLogout, setShowLogout] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });

	// --- LÓGICA DE SESIÓN (SUPABASE TRANSACTIONAL LOGIC) ---
	const handleSession = async (treatment, clientData) => {
		// 1. Validar Stock localmente antes de intentar la operación
		const missing = treatment.recipe?.find((r) => {
			const item = inventory.find((i) => i.id === r.materialId);
			return !item || item.stock < r.quantity;
		});

		if (missing) {
			showToastMsg("Falta material en inventario", "error");
			return;
		}

		try {
			// 2. Descontar Stock en Supabase
			if (treatment.recipe && treatment.recipe.length > 0) {
				for (const r of treatment.recipe) {
					const item = inventory.find((i) => i.id === r.materialId);
					if (item) {
						const { error: invError } = await supabase
							.from("inventory")
							.update({ stock: Number(item.stock) - Number(r.quantity) })
							.eq("id", r.materialId);
						if (invError) throw invError;
					}
				}
			}

			// 3. Calcular Coste basado en el inventario actual
			const cost =
				treatment.recipe?.reduce((total, r) => {
					const item = inventory.find((m) => m.id === r.materialId);
					return (
						total +
						(item ? (Number(item.unit_cost) || 0) * Number(r.quantity) : 0)
					);
				}, 0) || 0;

			const displayName = clientData.id
				? `${treatment.name} (${clientData.name} ${clientData.surname || ""})`
				: `${treatment.name} (${clientData.name})`;

			// 4. Registrar Ingreso en Supabase (finance_entries)
			const { error: finError } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: user.uid, // Mantenemos el ID de Firebase para el campo user_id (TEXT)
						date: new Date().toISOString().split("T")[0],
						type: "income",
						category: "Servicio",
						description: displayName,
						amount: Number(treatment.price),
						related_cost: Number(cost),
						client_id: clientData.id || null,
					},
				]);

			if (finError) throw finError;

			// 5. Registrar Gasto Automático si hay coste asociado
			if (cost > 0) {
				const { error: expError } = await supabase
					.from("finance_entries")
					.insert([
						{
							user_id: user.uid,
							date: new Date().toISOString().split("T")[0],
							type: "expense",
							category: "Material",
							description: `Consumo material: ${treatment.name}`,
							amount: Number(cost),
							is_automatic: true,
						},
					]);
				if (expError) throw expError;
			}

			showToastMsg("Sesión registrada y stock actualizado");
			setSelectedTreatment(null);
		} catch (e) {
			console.error("Error en handleSession:", e.message);
			showToastMsg("Error al procesar la sesión", "error");
		}
	};

	// --- ESTADOS DE CARGA ---
	if (authLoading || (user && dataLoading))
		return (
			<div className="min-h-screen flex items-center justify-center bg-rose-50">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="animate-spin text-rose-500" size={40} />
					<p className="text-rose-400 font-medium">
						Sincronizando con Supabase...
					</p>
				</div>
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
				title="Cerrar Sesión"
				message="¿Estás seguro de que quieres salir del gestor?"
				onCancel={() => setShowLogout(false)}
				onConfirm={() => {
					logout();
					setShowLogout(false);
				}}
				isDestructive
			/>

			{/* Modal de Registro de Sesión */}
			<SessionModal
				isOpen={!!selectedTreatment}
				treatment={selectedTreatment}
				clients={clients}
				onClose={() => setSelectedTreatment(null)}
				onConfirm={handleSession}
			/>

			<Sidebar
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				onLogout={() => setShowLogout(true)}
				companyName={profile?.companyName}
			/>

			{/* Header Móvil */}
			<div className="md:hidden h-16 bg-white border-b sticky top-0 z-40 px-4 flex items-center justify-between shadow-sm">
				<span className="font-bold text-xl text-rose-500 uppercase tracking-tighter">
					{profile?.companyName || "DermoManager"}
				</span>
				<button onClick={() => setShowLogout(true)} className="p-2">
					<LogOut size={18} className="text-gray-400" />
				</button>
			</div>

			<main className="md:pl-64 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
				{activeTab === "dashboard" && (
					<DashboardTab
						user={user}
						entries={entries}
						inventory={inventory}
						treatments={treatments}
						currentMonth={currentMonth}
						setCurrentMonth={setCurrentMonth}
						userName={
							profile?.name ? `${profile.name} ${profile.surname || ""}` : null
						}
					/>
				)}

				{activeTab === "clients" && (
					<ClientsTab user={user} showToast={showToastMsg} profile={profile} />
				)}

				{activeTab === "treatments" && (
					<TreatmentsTab
						user={user}
						treatments={treatments}
						inventory={inventory}
						showToast={showToastMsg}
						onSelectTreatment={setSelectedTreatment}
					/>
				)}

				{activeTab === "inventory" && (
					<InventoryTab
						user={user}
						inventory={inventory}
						showToast={showToastMsg}
					/>
				)}

				{activeTab === "finance" && (
					<FinanceTab
						user={user}
						entries={entries}
						recurringConfig={recurringConfig}
						currentMonth={currentMonth}
						setCurrentMonth={setCurrentMonth}
						showToast={showToastMsg}
					/>
				)}

				{activeTab === "settings" && (
					<SettingsTab user={user} profile={profile} showToast={showToastMsg} />
				)}
			</main>

			<MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
		</div>
	);
};

export default DermoManager;
