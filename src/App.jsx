import React, { useState, useEffect } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { logout } from "./services/auth";
import { useSessionMutation } from "./hooks/useSessionMutation";
import { useTreatments } from "./hooks/useTreatments";
import { useInventory } from "./hooks/useInventory";
import { useFinance } from "./hooks/useFinance";
import { useRecurringConfig } from "./hooks/useRecurringConfig";
import { useProfile } from "./hooks/useProfile";
import { useClients } from "./hooks/useClients";
import { useAppointments } from "./hooks/useAppointments";
import { useInventoryBatches } from "./hooks/useInventoryBatches";
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
import { CalendarTab } from "./components/calendar/CalendarTab";
import { TaxesTab } from "./components/taxes/TaxesTab";

const DermoManager = () => {
	const { user, loading: authLoading } = useAuth();

	const { inventory, loading: inventoryLoading, refreshInventory } = useInventory(user);
	const { treatments, loading: treatmentsLoading, refreshTreatments } = useTreatments(user);
	const { entries, loading: financeLoading, refreshFinance } = useFinance(user);
	const { recurringConfig, loading: recurringLoading, refreshRecurringConfig } =
		useRecurringConfig(user);
	const profile = useProfile(user);
	const { clients, loading: clientsLoading, refreshClients } = useClients(user);
	const { appointments, loading: appointmentsLoading, refreshAppointments } =
		useAppointments(user?.id);
	const { batches } = useInventoryBatches(user?.id);

	const dataLoading =
		inventoryLoading ||
		treatmentsLoading ||
		financeLoading ||
		recurringLoading ||
		clientsLoading ||
		appointmentsLoading;

	const refreshData = async () => {
		await Promise.all([
			refreshInventory(),
			refreshTreatments(),
			refreshFinance(),
			refreshRecurringConfig(),
			refreshAppointments(),
		]);
	};

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

	const sessionMutation = useSessionMutation(user?.id, inventory);

	// Favicon dinámico según logo del perfil
	useEffect(() => {
		const link = document.querySelector("link[rel~='icon']");
		if (!link) return;
		if (profile?.logo_url && /^https?:\/\//i.test(profile.logo_url)) {
			link.href = profile.logo_url;
			link.type = profile.logo_url.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
		} else {
			link.href = "/vite.svg";
			link.type = "image/svg+xml";
		}
	}, [profile?.logo_url]);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });

	const handleSession = async (
		treatment,
		clientData,
		finalPrice,
		date,
		extras = [],
		internal_notes = ""
	) => {
		// 1. Unificamos receta base + extras en una sola lista de consumo
		const baseRecipe = treatment.recipe || [];

		// Convertimos la lista en un array plano de objetos { materialId, quantity }
		const totalConsumption = [...baseRecipe, ...extras];

		// VALIDACIÓN: Verificar si hay stock suficiente para TODO (receta + extras)
		// Agrupamos por materialId por si el mismo material está en receta y en extras
		const combinedQuantities = totalConsumption.reduce((acc, item) => {
			const qty = Number(item.quantity) || 0;
			if (!item.materialId) return acc;
			acc[item.materialId] = (acc[item.materialId] || 0) + qty;
			return acc;
		}, {});

		const missing = Object.entries(combinedQuantities).find(
			([matId, qtyNeeded]) => {
				const item = inventory.find((i) => i.id === matId);
				return !item || Number(item.stock) < qtyNeeded;
			}
		);

		if (missing) {
			const item = inventory.find((i) => i.id === missing[0]);
			showToastMsg(
				`Falta stock: ${item ? item.name : "Material desconocido"}`,
				"error"
			);
			return;
		}

		try {
			await sessionMutation.mutateAsync({
				treatment,
				clientData,
				finalPrice,
				date,
				extras,
				internal_notes,
			});
			showToastMsg(`Sesión guardada (Fecha: ${date})`);
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
						Sincronizando Datos...
					</p>
				</div>
			</div>
		);

	if (!user) return <LoginScreen />;

	return (
		<div className="min-h-[100dvh] bg-gray-50 pb-24 md:pb-0 font-sans text-gray-800 overflow-x-hidden pl-0 md:pl-20 lg:pl-64">
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
				isSubmitting={sessionMutation.isPending}
			/>
			<Sidebar
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				onLogout={() => setShowLogout(true)}
				companyName={profile?.company_name}
				clients={clients}
				treatments={treatments}
				inventory={inventory}
			/>
			<div className="md:hidden h-16 bg-white border-b sticky top-0 z-40 px-4 flex items-center justify-between shadow-sm">
				{/* Header móvil visible hasta XL */}
				<span className="font-bold text-xl text-rose-500 uppercase tracking-tighter">
					{profile?.company_name || "DermoManager"}
				</span>
				<button onClick={() => setShowLogout(true)} className="p-2">
					<LogOut size={18} className="text-gray-400" />
				</button>
			</div>
			<main className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6 min-h-screen">
				{activeTab === "dashboard" && (
					<DashboardTab
						user={user}
						entries={entries}
						inventory={inventory}
						batches={batches ?? []}
						treatments={treatments}
						appointments={appointments}
						clients={clients}
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
						entries={entries}
						showToast={showToastMsg}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "finance" && (
					<FinanceTab
						user={user}
						entries={entries}
						clients={clients}
						recurringConfig={recurringConfig}
						currentDate={currentDate}
						setCurrentDate={setCurrentDate}
						viewMode={viewMode}
						setViewMode={setViewMode}
						showToast={showToastMsg}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "calendar" && (
					<CalendarTab
						user={user}
						entries={entries}
						appointments={appointments}
						clients={clients}
						treatments={treatments}
						showToast={showToastMsg}
						onRefresh={refreshAppointments}
					/>
				)}
				{activeTab === "taxes" && (
					<TaxesTab
						entries={entries}
						clients={clients}
						user={user}
						showToast={showToastMsg}
					/>
				)}
				{activeTab === "settings" && (
					<SettingsTab user={user} profile={profile} showToast={showToastMsg} />
				)}
			</main>
			<MobileNav
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				className="md:hidden"
			/>
		</div>
	);
};
export default DermoManager;
