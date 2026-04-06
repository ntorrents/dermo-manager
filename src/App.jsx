import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useTenant } from "./context/TenantContext";
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
import { useConsumeBono } from "./hooks/useBonos";
import { Toast } from "./components/ui/Toast";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { SessionModal } from "./components/ui/SessionModal";
import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { AppHeader } from "./components/layout/AppHeader";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { TreatmentsTab } from "./components/treatments/TreatmentsTab";
import { InventoryTab } from "./components/inventory/InventoryTab";
import { FinanceTab } from "./components/finance/FinanceTab";
import { SettingsTab } from "./components/settings/SettingsTab";
import { ClientsTab } from "./components/clients/ClientsTab";
import { CalendarTab } from "./components/calendar/CalendarTab";
import { TaxesTab } from "./components/taxes/TaxesTab";
import { BonosTab } from "./components/bonos/BonosTab";
import { RequirePlan } from "./components/guards/RequirePlan";
import { DocumentsTab } from "./components/documents/DocumentsTab";
import { getReportingRange } from "./utils/dateUtils";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

const TAB_META = {
	dashboard: { title: "Resumen", subtitle: "Indicadores y widgets" },
	clients: { title: "Clientes", subtitle: "Ficha, historial y documentos" },
	treatments: { title: "Tratamientos", subtitle: "Servicios y sesiones" },
	bonos: { title: "Bonos", subtitle: "Plantillas y bonos de clientes" },
	documents: { title: "Documentos", subtitle: "Presupuestos y plantillas" },
	inventory: { title: "Stock", subtitle: "Materiales y lotes" },
	calendar: { title: "Agenda", subtitle: "Citas y recordatorios" },
	finance: { title: "Finanzas", subtitle: "Ingresos, gastos y fijos" },
	taxes: { title: "Fiscalidad", subtitle: "Resúmenes fiscales" },
	settings: { title: "Configuración", subtitle: "Clínica, perfil y seguridad" },
};

const DermoManager = () => {
	const { user, loading: authLoading } = useAuth();
	const { allowsPresupuestosBonos, loading: tenantLoading, clinic } = useTenant();

	const { inventory, loading: inventoryLoading, refreshInventory } = useInventory(user);
	const { treatments, loading: treatmentsLoading, refreshTreatments } = useTreatments(user);
	const { entries, loading: financeLoading, refreshFinance } = useFinance(user);
	const { loading: recurringLoading, refreshRecurringConfig } = useRecurringConfig(user);
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
	const [settingsAnchor, setSettingsAnchor] = useState(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
		try {
			return typeof localStorage !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
		} catch {
			return false;
		}
	});

	const toggleSidebarCollapsed = useCallback(() => {
		setSidebarCollapsed((c) => {
			const next = !c;
			try {
				localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
			} catch {
				/* ignore */
			}
			return next;
		});
	}, []);

	const mainPadClass = sidebarCollapsed ? "md:pl-[4.5rem]" : "md:pl-60 lg:pl-64";

	const pageMeta = TAB_META[activeTab] || { title: "DermoManager", subtitle: null };

	const goSettings = useCallback(() => setActiveTab("settings"), []);
	const clearSettingsAnchor = useCallback(() => setSettingsAnchor(null), []);

	useEffect(() => {
		if (!user || tenantLoading) return;
		// Compat: antiguo tab "budgets" ahora vive en "documents"
		if (activeTab === "budgets") setActiveTab("documents");
		if (!allowsPresupuestosBonos && activeTab === "bonos") setActiveTab("dashboard");
	}, [user, tenantLoading, allowsPresupuestosBonos, activeTab]);

	const [reportingPreset, setReportingPreset] = useState("month");
	const [reportingAnchorYm, setReportingAnchorYm] = useState(() =>
		new Date().toISOString().slice(0, 7),
	);
	const [reportingCustomFrom, setReportingCustomFrom] = useState(() => {
		const d = new Date();
		d.setMonth(d.getMonth() - 1);
		return d.toISOString().slice(0, 10);
	});
	const [reportingCustomTo, setReportingCustomTo] = useState(() =>
		new Date().toISOString().slice(0, 10),
	);
	const reportingRange = useMemo(
		() =>
			getReportingRange(
				reportingPreset,
				reportingAnchorYm,
				reportingCustomFrom,
				reportingCustomTo,
			),
		[reportingPreset, reportingAnchorYm, reportingCustomFrom, reportingCustomTo],
	);

	const goReportingToday = useCallback(() => {
		const d = new Date();
		const ym = d.toISOString().slice(0, 7);
		const ymd = d.toISOString().slice(0, 10);
		setReportingPreset("month");
		setReportingAnchorYm(ym);
		setReportingCustomFrom(ymd);
		setReportingCustomTo(ymd);
	}, []);

	const [toast, setToast] = useState(null);
	const [showLogout, setShowLogout] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);

	const sessionMutation = useSessionMutation(user?.id, inventory);
	const consumeBonoMutation = useConsumeBono();

	// Favicon dinámico según logo de la clínica (shared)
	useEffect(() => {
		const link = document.querySelector("link[rel~='icon']");
		if (!link) return;
		const logoUrl = clinic?.logo_url || null;
		if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
			link.href = logoUrl;
			link.type = logoUrl.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
		} else {
			link.href = "/vite.svg";
			link.type = "image/svg+xml";
		}
	}, [clinic?.logo_url]);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });

	// Vuelta desde OAuth de Google Calendar (?google_calendar=connected|error)
	useEffect(() => {
		if (!user) return;
		try {
			const params = new URLSearchParams(window.location.search);
			const g = params.get("google_calendar");
			if (!g) return;
			if (g === "connected") {
				setActiveTab("calendar");
				showToastMsg("Google Calendar conectado. Usa «Sincronizar» en la agenda.");
			} else if (g === "error") {
				const msg = params.get("message") || "error";
				setActiveTab("calendar");
				showToastMsg(`Google Calendar: ${decodeURIComponent(msg)}`, "error");
			}
			window.history.replaceState({}, "", window.location.pathname);
		} catch {
			/* ignore */
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cargar sesión tras redirect OAuth
	}, [user]);

	const handleSession = async (
		treatment,
		clientData,
		finalPrice,
		date,
		extras = [],
		internal_notes = "",
		planAmigo = false,
		consumeBonoId = null
	) => {
		// 1. Unificamos receta base + extras en una sola lista de consumo
		const baseRecipe = treatment.recipe || [];

		// Convertimos la lista en un array plano de objetos { materialId, quantity }
		const totalConsumption = [...baseRecipe, ...extras];

		// VALIDACIÓN: Verificar stock solo para materiales (las máquinas no consumen stock)
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
				if (!item) return true;
				// Máquinas (diatermia, etc.) no tienen stock; solo precio por sesión → no bloquear
				if ((item.item_type || "material") === "maquina") return false;
				return Number(item.stock) < qtyNeeded;
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
				planAmigo,
			});
			if (consumeBonoId) {
				await consumeBonoMutation.mutateAsync(consumeBonoId);
				showToastMsg("Sesión guardada y sesión de bono consumida");
			} else {
				showToastMsg(planAmigo ? `Sesión guardada (Plan Amigo, sin factura)` : `Sesión guardada (Fecha: ${date})`);
			}
			setSelectedTreatment(null);
			await refreshData();
		} catch (e) {
			console.error("Error en handleSession:", e);
			showToastMsg("Error al procesar la sesión", "error");
		}
	};

	if (authLoading || (user && dataLoading) || (user && tenantLoading))
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
		<div
			className={`min-h-[100dvh] bg-gray-50 pb-24 md:pb-0 font-sans text-gray-800 overflow-x-hidden pl-0 ${mainPadClass} antialiased text-[15px] leading-snug`}>
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
				user={user}
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
				companyName={clinic?.name}
				collapsed={sidebarCollapsed}
			/>
			<AppHeader
				title={pageMeta.title}
				subtitle={pageMeta.subtitle}
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				sidebarCollapsed={sidebarCollapsed}
				onToggleSidebar={toggleSidebarCollapsed}
				clients={clients}
				treatments={treatments}
				inventory={inventory}
				appointments={appointments}
				batches={batches ?? []}
				user={user}
				profile={profile}
				clinic={clinic}
				onLogout={() => setShowLogout(true)}
				onOpenSettings={goSettings}
			/>
			<main className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-5 min-h-[calc(100dvh-8rem)]">
				{activeTab === "dashboard" && (
					<DashboardTab
						user={user}
						entries={entries}
						inventory={inventory}
						batches={batches ?? []}
						treatments={treatments}
						appointments={appointments}
						clients={clients}
						reportingRange={reportingRange}
						reportingPreset={reportingPreset}
						setReportingPreset={setReportingPreset}
						reportingAnchorYm={reportingAnchorYm}
						setReportingAnchorYm={setReportingAnchorYm}
						reportingCustomFrom={reportingCustomFrom}
						setReportingCustomFrom={setReportingCustomFrom}
						reportingCustomTo={reportingCustomTo}
						setReportingCustomTo={setReportingCustomTo}
						onReportingGoToday={goReportingToday}
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
				{activeTab === "bonos" && (
					<RequirePlan>
						<BonosTab
							user={user}
							clients={clients}
							treatments={treatments}
							showToast={showToastMsg}
							onRefresh={refreshData}
						/>
					</RequirePlan>
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
						reportingRange={reportingRange}
						reportingPreset={reportingPreset}
						setReportingPreset={setReportingPreset}
						reportingAnchorYm={reportingAnchorYm}
						setReportingAnchorYm={setReportingAnchorYm}
						reportingCustomFrom={reportingCustomFrom}
						setReportingCustomFrom={setReportingCustomFrom}
						reportingCustomTo={reportingCustomTo}
						setReportingCustomTo={setReportingCustomTo}
						onReportingGoToday={goReportingToday}
						showToast={showToastMsg}
						onRefresh={refreshData}
					/>
				)}
				{activeTab === "documents" && (
					<DocumentsTab
						user={user}
						clients={clients}
						treatments={treatments}
						profile={profile}
						showToast={showToastMsg}
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
					<SettingsTab
						user={user}
						profile={profile}
						showToast={showToastMsg}
						navigateAnchor={settingsAnchor}
						onNavigateAnchorConsumed={clearSettingsAnchor}
					/>
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
