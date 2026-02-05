import React, { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { logout } from "./services/auth";
import { supabase } from "./services/supabase";
import { useData } from "./hooks/useData";
import { useProfile } from "./hooks/useProfile";
import { useClients } from "./hooks/useClients";
import { Toast } from "./components/ui/Toast";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { SessionModal } from "./components/ui/SessionModal";
import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { TreatmentsTab } from "./components/treatments/TreatmentsTab";
import { InventoryTab } from "./components/inventory/InventoryTab";
import { FinanceTab } from "./components/finance/FinanceTab";
import { SettingsTab } from "./components/settings/SettingsTab";
import { ClientsTab } from "./components/clients/ClientsTab";

const DermoManager = () => {
	const { user, loading: authLoading } = useAuth();

	const {
		inventory,
		treatments,
		entries,
		recurringConfig,
		loading: dataLoading,
		refreshData,
	} = useData(user);

	const profile = useProfile(user);
	const { clients, refreshClients } = useClients(user);

	const [activeTab, setActiveTab] = useState("dashboard");

	// --- ESTADO ELEVADO (GLOBAL) ---
	const [viewMode, setViewMode] = useState("month"); // 'month', 'quarter', 'year'
	const [currentDate, setCurrentDate] = useState(
		new Date().toISOString().slice(0, 7) // "YYYY-MM"
	);
	// -------------------------------

	const [toast, setToast] = useState(null);
	const [showLogout, setShowLogout] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });

	// ACTUALIZADO: Acepta 'date' como cuarto argumento
	const handleSession = async (treatment, clientData, finalPrice, date) => {
		const missing = treatment.recipe?.find((r) => {
			const item = inventory.find((i) => i.id === r.materialId);
			return !item || Number(item.stock) < Number(r.quantity);
		});

		if (missing) {
			showToastMsg("Falta material en inventario", "error");
			return;
		}

		try {
			// 1. Descontar Stock
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

			// 2. Calcular Coste (Solo informativo)
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

			// 3. Registrar Ingreso (con precio final y fecha seleccionada)
			const { error: finError } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: user.id,
						date: date, // <--- AHORA USA LA FECHA DEL MODAL
						type: "income",
						category: "Servicio",
						description: displayName,
						amount: Number(finalPrice),
						related_cost: Number(cost),
						client_id: clientData.id || null,
					},
				]);

			if (finError) throw finError;

			showToastMsg(`Sesión registrada el ${date}`);
			setSelectedTreatment(null);

			await refreshData();
		} catch (e) {
			console.error("Error en handleSession:", e);
			showToastMsg("Error al procesar la sesión", "error");
		}
	};

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
				message="¿Estás seguro?"
				onCancel={() => setShowLogout(false)}
				onConfirm={() => {
					logout();
					setShowLogout(false);
				}}
				isDestructive
			/>
			<SessionModal
				isOpen={!!selectedTreatment}
				treatment={selectedTreatment}
				clients={clients}
				inventory={inventory}
				onClose={() => setSelectedTreatment(null)}
				onConfirm={handleSession}
			/>
			<Sidebar
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				onLogout={() => setShowLogout(true)}
				companyName={profile?.company_name}
				className="hidden xl:flex"
			/>
			<div className="xl:hidden h-16 bg-white border-b sticky top-0 z-40 px-4 flex items-center justify-between shadow-sm">
				{/* Header móvil visible hasta XL */}
				<span className="font-bold text-xl text-rose-500 uppercase tracking-tighter">
					{profile?.company_name || "DermoManager"}
				</span>
				<button onClick={() => setShowLogout(true)} className="p-2">
					<LogOut size={18} className="text-gray-400" />
				</button>
			</div>
			<main className="xl:pl-64 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
				{activeTab === "dashboard" && (
					<DashboardTab
						user={user}
						entries={entries}
						inventory={inventory}
						treatments={treatments}
						// Props Globales
						currentDate={currentDate}
						setCurrentDate={setCurrentDate}
						viewMode={viewMode}
						setViewMode={setViewMode}
						userName={profile?.name}
					/>
				)}
				{activeTab === "clients" && (
					<ClientsTab
						user={user}
						showToast={showToastMsg}
						profile={profile}
						clients={clients}
						onRefresh={refreshClients}
					/>
				)}
				{activeTab === "treatments" && (
					<TreatmentsTab
						user={user}
						treatments={treatments}
						inventory={inventory}
						showToast={showToastMsg}
						onSelectTreatment={setSelectedTreatment}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "inventory" && (
					<InventoryTab
						user={user}
						inventory={inventory}
						showToast={showToastMsg}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "finance" && (
					<FinanceTab
						user={user}
						entries={entries}
						recurringConfig={recurringConfig}
						// Props Globales
						currentDate={currentDate}
						setCurrentDate={setCurrentDate}
						viewMode={viewMode}
						setViewMode={setViewMode}
						showToast={showToastMsg}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "settings" && (
					<SettingsTab user={user} profile={profile} showToast={showToastMsg} />
				)}
			</main>
			<MobileNav
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				className="xl:hidden"
			/>
		</div>
	);
};
export default DermoManager;
