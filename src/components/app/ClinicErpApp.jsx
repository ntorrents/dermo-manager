import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { logout } from "../../services/auth";
import { useSessionMutation } from "../../hooks/useSessionMutation";
import { useTreatments } from "../../hooks/useTreatments";
import { useInventory } from "../../hooks/useInventory";
import { useFinance } from "../../hooks/useFinance";
import { useRecurringConfig } from "../../hooks/useRecurringConfig";
import { useProfile } from "../../hooks/useProfile";
import { useClients } from "../../hooks/useClients";
import { useAppointments } from "../../hooks/useAppointments";
import { useInventoryBatches } from "../../hooks/useInventoryBatches";
import { useConsumeBono } from "../../hooks/useBonos";
import { Toast } from "../ui/Toast";
import { ConfirmModal } from "../ui/ConfirmModal";
import { SessionModal } from "../ui/SessionModal";
import { CommandPalette } from "../ui/CommandPalette";
import { QuickAppointmentPanel } from "../calendar/QuickAppointmentPanel";
import { Sidebar } from "../layout/Sidebar";
import { MobileNav } from "../layout/MobileNav";
import { AppHeader } from "../layout/AppHeader";
import { RouteFallback } from "../layout/RouteFallback";
import { PATH_MAP, resolveNavIdFromPath } from "../layout/navigationLabels";
import { TaxAlertsBanner } from "../taxes/shared/TaxAlertsBanner";
import { useTaxDeclarations } from "../../hooks/useTaxDeclarations";
import { HomeTab } from "../home/HomeTab";
import { useAppearance } from "../../context/AppearanceContext";
const DashboardTab = lazy(() =>
	import("../dashboard/DashboardTab").then((m) => ({ default: m.DashboardTab })),
);
const TreatmentsTab = lazy(() =>
	import("../treatments/TreatmentsTab").then((m) => ({
		default: m.TreatmentsTab,
	})),
);
const ProductsShell = lazy(() =>
	import("../products/ProductsShell").then((m) => ({ default: m.ProductsShell })),
);
const InventoryTab = lazy(() =>
	import("../inventory/InventoryTab").then((m) => ({ default: m.InventoryTab })),
);
const FinanceMovementsTab = lazy(() =>
	import("../finance/FinanceMovementsTab").then((m) => ({ default: m.FinanceMovementsTab })),
);

const FinancialAnalysisTab = lazy(() =>
	import("../finance/FinancialAnalysisTab").then((m) => ({ default: m.FinancialAnalysisTab })),
);
const TaxesShell = lazy(() =>
	import("../taxes/TaxesShell").then((m) => ({ default: m.TaxesShell })),
);
const InvoicesTab = lazy(() =>
	import("../invoices/InvoicesTab").then((m) => ({ default: m.InvoicesTab })),
);
const SettingsTab = lazy(() =>
	import("../settings/SettingsTab").then((m) => ({ default: m.SettingsTab })),
);
const ClientsTab = lazy(() =>
	import("../clients/ClientsTab").then((m) => ({ default: m.ClientsTab })),
);
const CalendarTab = lazy(() =>
	import("../calendar/CalendarTab").then((m) => ({ default: m.CalendarTab })),
);
const SuppliersTab = lazy(() =>
	import("../suppliers/SuppliersTab").then((m) => ({
		default: m.SuppliersTab,
	})),
);
const BonosTab = lazy(() =>
	import("../bonos/BonosTab").then((m) => ({ default: m.BonosTab })),
);
import { RequirePlan } from "../guards/RequirePlan";
import { RequireModule } from "../guards/RequireModule";
const ConsentTemplatesTab = lazy(() =>
	import("../documents/ConsentTemplatesTab").then((m) => ({ default: m.ConsentTemplatesTab })),
);
const BudgetsTab = lazy(() =>
	import("../budgets/BudgetsTab").then((m) => ({ default: m.BudgetsTab })),
);
const MarketingShell = lazy(() =>
	import("../marketing/MarketingShell").then((m) => ({ default: m.MarketingShell })),
);
import { getReportingRange } from "../../utils/dateUtils";
import {
	companyMissingFiscalAddress,
	COMPANY_FISCAL_ADDRESS_MSG,
} from "../../utils/companyFiscal";
import { useClinicSeguimientos } from "../../hooks/useClinicSeguimientos";
import {
	useSeguimientoNotifications,
	requestSeguimientoNotificationPermission,
} from "../../hooks/useSeguimientoNotifications";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

const TAB_META = {
	home: { title: "Inicio", subtitle: "Bienvenido" },
	dashboard: { title: "Dashboard", subtitle: "Indicadores y widgets" },
	clients: { title: "Clientes", subtitle: "Ficha, historial y documentos" },
	treatments: { title: "Tratamientos", subtitle: "Servicios y sesiones" },
	products: { title: "Productos", subtitle: "Catálogo y ventas" },
	products_ventas: { title: "Ventas de productos", subtitle: "Historial y tickets" },
	bonos: { title: "Bonos de Sesiones", subtitle: "Plantillas y bonos de clientes" },
	consents: { title: "Consentimientos", subtitle: "Plantillas de consentimiento informado" },
	budgets: { title: "Presupuestos", subtitle: "Presupuestos para clientes" },
	inventory: { title: "Inventario", subtitle: "Materiales, stock y lotes" },
	calendar: { title: "Agenda", subtitle: "Citas y recordatorios" },

	finance_movements: { title: "Movimientos", subtitle: "Ingresos, gastos y recurrentes" },
	finance: { title: "Movimientos", subtitle: "Ingresos, gastos y recurrentes" },
	invoices: { title: "Facturas", subtitle: "Emitidas, filtros y estadísticas" },
	financial_analysis: { title: "Análisis Financiero", subtitle: "Gráficos y reportes" },
	suppliers: { title: "Proveedores", subtitle: "KPI de compras y facturas" },
	taxes: { title: "Fiscalidad & AEAT", subtitle: "Modelos, plazos y declaraciones" },
	taxes_130: { title: "Modelo 130", subtitle: "IRPF · Estimación Directa" },
	taxes_303: { title: "Modelo 303", subtitle: "IVA trimestral" },
	taxes_115: { title: "Modelo 115", subtitle: "Retenciones alquiler" },
	taxes_390: { title: "Modelo 390", subtitle: "Resumen anual IVA" },
	taxes_180: { title: "Modelo 180", subtitle: "Resumen anual retenciones" },
	taxes_renta: { title: "Preparación Renta", subtitle: "Acumulado del ejercicio" },
	taxes_declaraciones: { title: "Declaraciones", subtitle: "Estado de presentación AEAT" },
	assets: { title: "Bienes de Inversión", subtitle: "Amortizaciones en curso" },
	settings: { title: "Configuración", subtitle: "Apariencia, clínica, perfil y seguridad" },
	marketing: { title: "Marketing", subtitle: "Campañas, seguimiento y plantillas" },
	marketing_campanas: { title: "Campañas", subtitle: "Envío a destinatarios elegidos" },
	marketing_seguimiento: { title: "Seguimiento", subtitle: "Correo 1:1 a un paciente" },
	marketing_plantillas: { title: "Plantillas", subtitle: "Gestión y previsualización" },
};

export const ClinicErpApp = () => {
	const { user, loading: authLoading } = useAuth();
	const {
		allowsPresupuestosBonos,
		loading: tenantLoading,
		clinic,
		clinicActive,
	} = useTenant();
	const { density } = useAppearance();

	const { inventory, loading: inventoryLoading, refreshInventory } = useInventory(user);
	const { treatments, loading: treatmentsLoading, refreshTreatments } = useTreatments(user);
	const {
		entries,
		loading: financeLoading,
		error: financeQueryError,
		isError: financeQueryIsError,
		refreshFinance,
	} = useFinance(user);
	const { loading: recurringLoading, refreshRecurringConfig } = useRecurringConfig(user);
	const profile = useProfile(user);
	const {
		clients,
		loading: clientsLoading,
		error: clientsQueryError,
		isError: clientsQueryIsError,
		refreshClients,
	} = useClients(user);
	const { appointments, loading: appointmentsLoading, refreshAppointments } =
		useAppointments(user?.id);
	const { declarations: taxDeclarations } = useTaxDeclarations(user?.id);
	const { batches } = useInventoryBatches(user?.id);

	const dataLoading =
		inventoryLoading ||
		treatmentsLoading ||
		financeLoading ||
		recurringLoading ||
		clientsLoading ||
		appointmentsLoading;

	const dataFetchErrors = [
		financeQueryIsError && financeQueryError?.message
			? `Finanzas: ${financeQueryError.message}`
			: null,
		clientsQueryIsError && clientsQueryError?.message
			? `Clientes: ${clientsQueryError.message}`
			: null,
	].filter(Boolean);

	const refreshData = async () => {
		await Promise.all([
			refreshInventory(),
			refreshTreatments(),
			refreshFinance(),
			refreshRecurringConfig(),
			refreshAppointments(),
		]);
	};

	
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = useMemo(
		() => resolveNavIdFromPath(location.pathname),
		[location.pathname],
	);

	const setActiveTab = useCallback((tabId) => {
		const targetPath = PATH_MAP[tabId] || "/";
		navigate(targetPath);
	}, [navigate]);

	const [financeNavIntent, setFinanceNavIntent] = useState(null);
	const [invoicesNavIntent, setInvoicesNavIntent] = useState(null);
	const clearInvoicesNavIntent = useCallback(() => setInvoicesNavIntent(null), []);
	const clearFinanceNavIntent = useCallback(() => setFinanceNavIntent(null), []);
	const [sessionBootstrap, setSessionBootstrap] = useState(null);
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

	const pageMeta = TAB_META[activeTab] || { title: "BaseClínica", subtitle: null };

	const goSettings = useCallback(() => navigate("/configuracion"), [navigate]);
	const clearSettingsAnchor = useCallback(() => setSettingsAnchor(null), []);

	useEffect(() => {
		if (!user || tenantLoading) return;
		if (!allowsPresupuestosBonos && activeTab === "bonos") navigate("/");
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

	const navigateToClientInvoices = useCallback((clientId) => {
		if (!clientId) return;
		setInvoicesNavIntent({ clientId, appliedAt: Date.now() });
		navigate("/finanzas/facturas");
	}, []);

	const navigateFinanceFromTaxChecklist = useCallback(({ year, quarter, issue }) => {
		const startMonth = (quarter - 1) * 3;
		const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
		const endMonth = quarter * 3;
		const endDay = new Date(year, endMonth, 0).getDate();
		const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
		setReportingPreset("custom");
		setReportingCustomFrom(startDate);
		setReportingCustomTo(endDate);
		setFinanceNavIntent({
			source: "taxes",
			year,
			quarter,
			issue,
			appliedAt: Date.now(),
		});
		navigate("/finanzas/movimientos");
	}, []);

	const [toast, setToast] = useState(null);
	const [showLogout, setShowLogout] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	const [quickApptOpen, setQuickApptOpen] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);

	const { data: clinicSeguimientos = [] } = useClinicSeguimientos(user?.id);
	useSeguimientoNotifications(clinicSeguimientos, { enabled: !!user });

	useEffect(() => {
		if (!user) return;
		requestSeguimientoNotificationPermission();
	}, [user]);

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

	const startSessionFromBudget = useCallback(
		({ client, treatment, price }) => {
			if (!client?.id) {
				showToastMsg("Cliente no encontrado", "error");
				return;
			}
			if (!treatment?.id) {
				showToastMsg(
					"El presupuesto no tiene línea de tratamiento vinculada",
					"error",
				);
				return;
			}
			if (companyMissingFiscalAddress(client)) {
				showToastMsg(COMPANY_FISCAL_ADDRESS_MSG, "error");
				return;
			}
			setSessionBootstrap({
				clientId: client.id,
				price: price != null ? Number(price) : null,
			});
			setSelectedTreatment({
				...treatment,
				price:
					price != null && !Number.isNaN(Number(price))
						? Number(price)
						: treatment.price,
			});
			navigate("/tratamientos");
		},
		[],
	);

	// Vuelta desde OAuth de Google Calendar (?google_calendar=connected|error)
	useEffect(() => {
		if (!user) return;
		try {
			const params = new URLSearchParams(window.location.search);
			const g = params.get("google_calendar");
			if (!g) return;
			if (g === "connected") {
				navigate("/agenda");
				showToastMsg("Google Calendar conectado. Usa «Sincronizar» en la agenda.");
			} else if (g === "error") {
				const msg = params.get("message") || "error";
				navigate("/agenda");
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

		if (!planAmigo && companyMissingFiscalAddress(clientData)) {
			showToastMsg(COMPANY_FISCAL_ADDRESS_MSG, "error");
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
			setSessionBootstrap(null);
			await refreshData();
		} catch (e) {
			console.error("Error en handleSession:", e);
			showToastMsg("Error al procesar la sesión", "error");
		}
	};

	if (authLoading || (user && dataLoading && dataFetchErrors.length === 0) || (user && tenantLoading))
		return (
			<div className="min-h-screen flex items-center justify-center bg-app">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="animate-spin text-primary" size={40} />
					<p className="text-primary font-medium">
						Sincronizando Datos...
					</p>
				</div>
			</div>
		);

	if (!user) return null;

	return (
		<div
			className={`min-h-[100dvh] bg-app pb-24 md:pb-0 font-sans text-fg overflow-x-hidden pl-0 ${mainPadClass} antialiased ${
				density === "compact" ? "text-[13px] leading-snug" : "text-sm leading-relaxed"
			}`}>
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
				/>
			)}
			<ConfirmModal
				isOpen={showLogout}
				title="Cerrar sesión"
				message="Vas a salir de BaseClínica en este dispositivo. Tendrás que volver a iniciar sesión para acceder a pacientes, agenda y finanzas."
				onCancel={() => setShowLogout(false)}
				onConfirm={() => {
					logout();
					setShowLogout(false);
				}}
				isDestructive
				confirmLabel="Cerrar sesión"
			/>
			<CommandPalette
				open={commandOpen}
				onOpenChange={setCommandOpen}
				clients={clients}
				treatments={treatments}
				inventory={inventory}
				onQuickAction={(action) => {
					if (action === "new-appointment") setQuickApptOpen(true);
				}}
			/>
			<QuickAppointmentPanel
				isOpen={quickApptOpen}
				onClose={() => setQuickApptOpen(false)}
				user={user}
				clients={clients}
				treatments={treatments}
				showToast={showToastMsg}
				onSaved={refreshAppointments}
			/>
			<SessionModal
				isOpen={!!selectedTreatment}
				user={user}
				treatment={selectedTreatment}
				clients={clients}
				inventory={inventory}
				sessionBootstrap={sessionBootstrap}
				onBootstrapConsumed={() => setSessionBootstrap(null)}
				onClose={() => {
					setSelectedTreatment(null);
					setSessionBootstrap(null);
				}}
				onConfirm={handleSession}
				isSubmitting={sessionMutation.isPending}
			/>
			<Sidebar
				companyName={clinic?.name}
				collapsed={sidebarCollapsed}
				setCollapsed={setSidebarCollapsed}
			/>
			<AppHeader
				title={pageMeta.title}
				subtitle={pageMeta.subtitle}
				setActiveTab={setActiveTab}
				sidebarCollapsed={sidebarCollapsed}
				onToggleSidebar={toggleSidebarCollapsed}
				clients={clients}
				treatments={treatments}
				inventory={inventory}
				appointments={appointments}
				batches={batches ?? []}
				taxDeclarations={taxDeclarations}
				user={user}
				profile={profile}
				clinic={clinic}
				onLogout={() => setShowLogout(true)}
				onOpenSettings={goSettings}
				onOpenCommandPalette={() => setCommandOpen(true)}
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
			/>
			{(location.pathname === "/dashboard" ||
				location.pathname.startsWith("/fiscalidad")) && (
				<TaxAlertsBanner declarations={taxDeclarations} />
			)}
			{!tenantLoading && clinicActive === false && (
				<div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-5">
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
						<p className="font-black">Clínica desactivada</p>
						<p className="mt-1 text-xs font-medium text-rose-800/90">
							El acceso a módulos está restringido. Contacta con la plataforma.
						</p>
					</div>
				</div>
			)}
			<main
				className="w-full min-w-0 px-4 sm:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1600px] mx-auto ui-page-stack min-h-[calc(100dvh-8rem)]"
				style={{ paddingTop: "var(--space-page)", paddingBottom: "var(--space-page)" }}>
				{dataFetchErrors.length > 0 && (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<p className="font-black">No se pudieron cargar algunos datos</p>
							<ul className="mt-1 list-disc pl-5 text-xs font-medium space-y-0.5">
								{dataFetchErrors.map((msg) => (
									<li key={msg}>{msg}</li>
								))}
							</ul>
						</div>
						<button
							type="button"
							onClick={() => {
								refreshFinance();
								refreshClients();
							}}
							className="shrink-0 px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 font-bold hover:bg-amber-100">
							Reintentar
						</button>
					</div>
				)}
				<Suspense fallback={<RouteFallback />}>
				
					<Routes>
						<Route path="/" element={
							<HomeTab
								userName={profile?.name}
								appointments={appointments}
								clients={clients}
							/>
						} />
						<Route path="/dashboard" element={
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
								onNavigateTab={setActiveTab}
							/>
						} />
						<Route path="/clientes/:clientId" element={
						<RequireModule module="clients_crm">
						<ClientsTab
							user={user}
							showToast={showToastMsg}
							profile={profile}
							clients={clients}
							onRefresh={refreshClients}
							onNavigateToInvoices={navigateToClientInvoices}
						/>
						</RequireModule>
					} />
					<Route path="/clientes" element={
						<RequireModule module="clients_crm">
						<ClientsTab
							user={user}
							showToast={showToastMsg}
							profile={profile}
							clients={clients}
							onRefresh={refreshClients}
							onNavigateToInvoices={navigateToClientInvoices}
						/>
						</RequireModule>
					} />
						<Route path="/tratamientos" element={
							<TreatmentsTab
								user={user}
								treatments={treatments}
								inventory={inventory}
								showToast={showToastMsg}
								onSelectTreatment={setSelectedTreatment}
								onRefresh={refreshData}
							/>
						} />
						<Route path="/productos/*" element={
							<ProductsShell
								user={user}
								showToast={showToastMsg}
								clinic={clinic}
								profile={profile}
								entries={entries}
							/>
						} />
						<Route path="/bonos" element={
							<RequireModule module="bonos_manager">
							<RequirePlan>
								<BonosTab
									user={user}
									clients={clients}
									treatments={treatments}
									showToast={showToastMsg}
									onRefresh={refreshData}
								/>
							</RequirePlan>
							</RequireModule>
						} />
						<Route path="/inventario" element={
							<RequireModule module="inventory_core">
							<InventoryTab
								user={user}
								inventory={inventory}
								entries={entries}
								showToast={showToastMsg}
								onRefresh={refreshData}
							/>
							</RequireModule>
						} />
						<Route path="/finanzas/facturas" element={
							<RequireModule module="finance_invoices">
							<InvoicesTab
								user={user}
								entries={entries}
								clients={clients}
								profile={profile}
								clinic={clinic}
								showToast={showToastMsg}
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
								navIntent={invoicesNavIntent}
								onNavIntentConsumed={clearInvoicesNavIntent}
							/>
							</RequireModule>
						} />
						<Route path="/finanzas/movimientos" element={
							<RequireModule module="finance_basic">
							<FinanceMovementsTab
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
								navIntent={financeNavIntent}
								onNavIntentConsumed={clearFinanceNavIntent}
							/>
							</RequireModule>
						} />
						<Route path="/finanzas/analisis" element={
							<RequireModule module="finance_analytics">
							<FinancialAnalysisTab
								user={user}
								entries={entries}
								clients={clients}
								showToast={showToastMsg}
								reportingPreset={reportingPreset}
								setReportingPreset={setReportingPreset}
								reportingAnchorYm={reportingAnchorYm}
								setReportingAnchorYm={setReportingAnchorYm}
								reportingCustomFrom={reportingCustomFrom}
								setReportingCustomFrom={setReportingCustomFrom}
								reportingCustomTo={reportingCustomTo}
								setReportingCustomTo={setReportingCustomTo}
								reportingRange={reportingRange}
								onReportingGoToday={goReportingToday}
							/>
							</RequireModule>
						} />
						<Route path="/consentimientos" element={
							<RequireModule module="legal_signatures">
							<ConsentTemplatesTab
								user={user}
								showToast={showToastMsg}
							/>
							</RequireModule>
						} />
						<Route path="/presupuestos" element={
							<RequireModule module="bonos_manager">
							<RequirePlan>
								<BudgetsTab
									user={user}
									clients={clients}
									treatments={treatments}
									profile={profile}
									showToast={showToastMsg}
									onStartSessionFromBudget={startSessionFromBudget}
								/>
							</RequirePlan>
							</RequireModule>
						} />
						<Route path="/agenda/*" element={
							<RequireModule module="agenda_core">
							<CalendarTab
								user={user}
								entries={entries}
								appointments={appointments}
								clients={clients}
								treatments={treatments}
								showToast={showToastMsg}
								onRefresh={refreshAppointments}
							/>
							</RequireModule>
						} />
						<Route path="/fiscalidad/*" element={
							<RequireModule module="taxes_aeat">
							<TaxesShell
								entries={entries}
								clients={clients}
								user={user}
								showToast={showToastMsg}
								onNavigateFinanceIssues={navigateFinanceFromTaxChecklist}
							/>
							</RequireModule>
						} />
						<Route path="/proveedores" element={
							<RequireModule module="suppliers_manager">
							<SuppliersTab
								entries={entries}
								showToast={showToastMsg}
								onRefresh={refreshData}
							/>
							</RequireModule>
						} />
						<Route path="/marketing/*" element={
							<MarketingShell showToast={showToastMsg} />
						} />
						<Route path="/configuracion" element={
							<SettingsTab
								user={user}
								profile={profile}
								showToast={showToastMsg}
								navigateAnchor={settingsAnchor}
								onNavigateAnchorConsumed={clearSettingsAnchor}
							/>
						} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
</Suspense>
			</main>
			<MobileNav className="md:hidden" />
		</div>
	);
};

