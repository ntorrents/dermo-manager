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
import { buildBreadcrumbs } from "../layout/breadcrumbs";
import { FinanceShell } from "../finance/FinanceShell";
import { InventoryShell } from "../inventory/InventoryShell";
import { CatalogShell } from "../catalog/CatalogShell";
import { DocumentsShell } from "../documents/DocumentsShell";
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
const ProductsCatalogView = lazy(() =>
	import("../products/catalog/ProductsCatalogView").then((m) => ({
		default: m.ProductsCatalogView,
	})),
);
const ProductsSalesView = lazy(() =>
	import("../products/sales/ProductsSalesView").then((m) => ({
		default: m.ProductsSalesView,
	})),
);
const InventoryTab = lazy(() =>
	import("../inventory/InventoryTab").then((m) => ({ default: m.InventoryTab })),
);
const TraceabilityTab = lazy(() =>
	import("../inventory/TraceabilityTab").then((m) => ({
		default: m.TraceabilityTab,
	})),
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

	const breadcrumbs = useMemo(
		() => buildBreadcrumbs(location.pathname, { clients }),
		[location.pathname, clients],
	);

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
	const [quickApptClientId, setQuickApptClientId] = useState("");
	const [selectedTreatment, setSelectedTreatment] = useState(null);
	const [pendingSession, setPendingSession] = useState(null);
	const [stockForceConfirm, setStockForceConfirm] = useState(null);

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
			navigate("/catalogo/tratamientos");
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
				showToastMsg("Google Calendar conectado. Usa «Sincronizar» en Integraciones.");
				navigate("/configuracion?section=integrations", { replace: true });
			} else if (g === "error") {
				const msg = params.get("message") || "error";
				showToastMsg(`Google Calendar: ${decodeURIComponent(msg)}`, "error");
				navigate("/configuracion?section=integrations", { replace: true });
			}
		} catch {
			/* ignore */
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cargar sesión tras redirect OAuth
	}, [user]);

	const runSession = async (payload) => {
		const {
			treatment,
			clientData,
			finalPrice,
			date,
			extras = [],
			internal_notes = "",
			planAmigo = false,
			consumeBonoId = null,
			scheduleReviewReminder = false,
		} = payload;
		try {
			await sessionMutation.mutateAsync({
				treatment,
				clientData,
				finalPrice,
				date,
				extras,
				internal_notes,
				planAmigo,
				allowShortfall: true,
				scheduleReviewReminder,
			});
			if (consumeBonoId) {
				await consumeBonoMutation.mutateAsync(consumeBonoId);
				showToastMsg(
					scheduleReviewReminder
						? "Sesión y bono guardados · recordatorio +15 días"
						: "Sesión guardada y sesión de bono consumida",
				);
			} else {
				showToastMsg(
					scheduleReviewReminder
						? planAmigo
							? "Sesión (Plan Amigo) + recordatorio de revisión en 15 días"
							: `Sesión guardada · recordatorio de revisión en 15 días`
						: planAmigo
							? `Sesión guardada (Plan Amigo, sin factura)`
							: `Sesión guardada (Fecha: ${date})`,
				);
			}
			setSelectedTreatment(null);
			setSessionBootstrap(null);
			setPendingSession(null);
			setStockForceConfirm(null);
			await refreshData();
		} catch (e) {
			console.error("Error en handleSession:", e);
			showToastMsg(e?.message || "Error al procesar la sesión", "error");
		}
	};

	const handleSession = async (
		treatment,
		clientData,
		finalPrice,
		date,
		extras = [],
		internal_notes = "",
		planAmigo = false,
		consumeBonoId = null,
		scheduleReviewReminder = false,
	) => {
		const baseRecipe = treatment.recipe || [];
		const totalConsumption = [...baseRecipe, ...extras];
		const combinedQuantities = totalConsumption.reduce((acc, item) => {
			const qty = Number(item.quantity) || 0;
			if (!item.materialId) return acc;
			acc[item.materialId] = (acc[item.materialId] || 0) + qty;
			return acc;
		}, {});

		const shortages = Object.entries(combinedQuantities)
			.map(([matId, qtyNeeded]) => {
				const item = inventory.find((i) => i.id === matId);
				if (!item) return { name: "Material desconocido", stock: 0, need: qtyNeeded };
				if ((item.item_type || "material") === "maquina") return null;
				if (Number(item.stock) < qtyNeeded) {
					return {
						name: item.name,
						stock: Number(item.stock),
						need: qtyNeeded,
					};
				}
				return null;
			})
			.filter(Boolean);

		if (!planAmigo && companyMissingFiscalAddress(clientData)) {
			showToastMsg(COMPANY_FISCAL_ADDRESS_MSG, "error");
			return;
		}

		const payload = {
			treatment,
			clientData,
			finalPrice,
			date,
			extras,
			internal_notes,
			planAmigo,
			consumeBonoId,
			scheduleReviewReminder: !!scheduleReviewReminder,
		};

		if (shortages.length > 0) {
			const lines = shortages
				.map((s) => `· ${s.name}: hay ${s.stock}, se necesitan ${s.need}`)
				.join("\n");
			setPendingSession(payload);
			setStockForceConfirm(lines);
			return;
		}

		await runSession(payload);
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
			<ConfirmModal
				isOpen={Boolean(stockForceConfirm)}
				title="Stock insuficiente"
				message={`Hay materiales con stock insuficiente:\n\n${stockForceConfirm || ""}\n\nPuedes forzar la sesión: el stock quedará en negativo y se registrará el consumo en trazabilidad.\n\n¿Continuar de todos modos?`}
				onCancel={() => {
					setStockForceConfirm(null);
					setPendingSession(null);
				}}
				onConfirm={async () => {
					if (pendingSession) await runSession(pendingSession);
				}}
				isDestructive
				confirmLabel="Forzar sesión"
			/>
			<CommandPalette
				open={commandOpen}
				onOpenChange={setCommandOpen}
				clients={clients}
				treatments={treatments}
				inventory={inventory}
				onQuickAction={(action) => {
					if (action === "new-appointment") {
						setQuickApptClientId("");
						setQuickApptOpen(true);
					}
				}}
			/>
			<QuickAppointmentPanel
				isOpen={quickApptOpen}
				onClose={() => {
					setQuickApptOpen(false);
					setQuickApptClientId("");
				}}
				user={user}
				clients={clients}
				treatments={treatments}
				showToast={showToastMsg}
				onSaved={refreshAppointments}
				initialClientId={quickApptClientId}
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
				user={user}
				profile={profile}
				clinic={clinic}
				onLogout={() => setShowLogout(true)}
				onOpenSettings={goSettings}
			/>
			<AppHeader
				breadcrumbs={breadcrumbs}
				setActiveTab={setActiveTab}
				sidebarCollapsed={sidebarCollapsed}
				onToggleSidebar={toggleSidebarCollapsed}
				inventory={inventory}
				appointments={appointments}
				batches={batches ?? []}
				taxDeclarations={taxDeclarations}
			/>
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
							entries={entries}
							appointments={appointments}
							onRefresh={refreshClients}
							onNavigateToInvoices={navigateToClientInvoices}
							onNewAppointment={(clientId) => {
								setQuickApptClientId(clientId || "");
								setQuickApptOpen(true);
							}}
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
							entries={entries}
							appointments={appointments}
							onRefresh={refreshClients}
							onNavigateToInvoices={navigateToClientInvoices}
							onNewAppointment={(clientId) => {
								setQuickApptClientId(clientId || "");
								setQuickApptOpen(true);
							}}
						/>
						</RequireModule>
					} />
						{/* Catálogo: Tratamientos | Productos | Bonos */}
						<Route path="/catalogo" element={<CatalogShell />}>
							<Route
								index
								element={<Navigate to="/catalogo/tratamientos" replace />}
							/>
							<Route
								path="tratamientos"
								element={
									<TreatmentsTab
										user={user}
										treatments={treatments}
										inventory={inventory}
										showToast={showToastMsg}
										onSelectTreatment={setSelectedTreatment}
										onRefresh={refreshData}
									/>
								}
							/>
							<Route
								path="productos"
								element={
									<RequireModule module="products_catalog">
										<ProductsShell />
									</RequireModule>
								}>
								<Route
									index
									element={
										<ProductsCatalogView
											user={user}
											showToast={showToastMsg}
											clinic={clinic}
											profile={profile}
											entries={entries}
										/>
									}
								/>
								<Route
									path="ventas"
									element={
										<ProductsSalesView
											user={user}
											showToast={showToastMsg}
											clinic={clinic}
											profile={profile}
										/>
									}
								/>
							</Route>
							<Route
								path="bonos"
								element={
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
								}
							/>
						</Route>
						{/* Redirects legacy catálogo */}
						<Route
							path="/tratamientos"
							element={<Navigate to="/catalogo/tratamientos" replace />}
						/>
						<Route
							path="/productos/*"
							element={<Navigate to="/catalogo/productos" replace />}
						/>
						<Route
							path="/bonos"
							element={<Navigate to="/catalogo/bonos" replace />}
						/>

						{/* Inventario: Stock | Compras */}
						<Route element={<InventoryShell />}>
							<Route
								path="/inventario"
								element={
									<RequireModule module="inventory_core">
										<InventoryTab
											user={user}
											inventory={inventory}
											entries={entries}
											showToast={showToastMsg}
											onRefresh={refreshData}
										/>
									</RequireModule>
								}
							/>
							<Route
								path="/inventario/compras"
								element={
									<RequireModule module="suppliers_manager">
										<SuppliersTab
											entries={entries}
											showToast={showToastMsg}
											onRefresh={refreshData}
										/>
									</RequireModule>
								}
							/>
							<Route
								path="/inventario/trazabilidad"
								element={
									<RequireModule module="inventory_core">
										<TraceabilityTab
											user={user}
											reportingRange={reportingRange}
											reportingPreset={reportingPreset}
											reportingAnchorYm={reportingAnchorYm}
											reportingCustomFrom={reportingCustomFrom}
											reportingCustomTo={reportingCustomTo}
										/>
									</RequireModule>
								}
							/>
						</Route>
						<Route
							path="/proveedores"
							element={<Navigate to="/inventario/compras" replace />}
						/>

						{/* Finanzas: Movimientos | Facturas | Fiscalidad */}
						<Route
							path="/finanzas"
							element={
								<FinanceShell
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
							}>
							<Route
								index
								element={<Navigate to="/finanzas/movimientos" replace />}
							/>
							<Route
								path="movimientos"
								element={
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
								}
							/>
							<Route
								path="facturas"
								element={
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
								}
							/>
							<Route
								path="analisis"
								element={
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
								}
							/>
							<Route
								path="fiscalidad/*"
								element={
									<RequireModule module="taxes_aeat">
										<TaxesShell
											entries={entries}
											clients={clients}
											user={user}
											showToast={showToastMsg}
											onNavigateFinanceIssues={navigateFinanceFromTaxChecklist}
										/>
									</RequireModule>
								}
							/>
						</Route>
						<Route
							path="/fiscalidad/*"
							element={<Navigate to="/finanzas/fiscalidad" replace />}
						/>

						{/* Documentos: Presupuestos | Consentimientos */}
						<Route path="/documentos" element={<DocumentsShell />}>
							<Route
								index
								element={<Navigate to="/documentos/presupuestos" replace />}
							/>
							<Route
								path="presupuestos"
								element={
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
								}
							/>
							<Route
								path="consentimientos"
								element={
									<RequireModule module="legal_signatures">
										<ConsentTemplatesTab
											user={user}
											showToast={showToastMsg}
										/>
									</RequireModule>
								}
							/>
						</Route>
						<Route
							path="/presupuestos"
							element={<Navigate to="/documentos/presupuestos" replace />}
						/>
						<Route
							path="/consentimientos"
							element={<Navigate to="/documentos/consentimientos" replace />}
						/>

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

