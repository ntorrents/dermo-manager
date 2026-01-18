// src/App.jsx
import React, { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useData } from "./hooks/useData";
import { useProfile } from "./hooks/useProfile";
import { useClients } from "./hooks/useClients";
import { logout } from "./services/auth";
import { addDocument, updateDocument } from "./services/firestore";

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
	const { user, loading } = useAuth();

	// Hooks de datos
	const { inventory, treatments, entries, recurringConfig } = useData(user);
	const profile = useProfile(user);
	const { clients } = useClients(user);

	const [activeTab, setActiveTab] = useState("dashboard");
	const [currentMonth, setCurrentMonth] = useState(
		new Date().toISOString().slice(0, 7),
	);
	const [toast, setToast] = useState(null);
	const [showLogout, setShowLogout] = useState(false);
	const [selectedTreatment, setSelectedTreatment] = useState(null);

	const showToastMsg = (msg, type = "success") =>
		setToast({ message: msg, type });

	// --- LÓGICA DE SESIÓN ---
	const handleSession = async (treatment, clientData) => {
		// 1. Validar Stock
		const missing = treatment.recipe?.find((r) => {
			const item = inventory.find((i) => i.id === r.materialId);
			return !item || item.stock < r.quantity;
		});

		if (missing) {
			showToastMsg("Falta material en inventario", "error");
			return;
		}

		try {
			// 2. Descontar Stock
			if (treatment.recipe) {
				for (const r of treatment.recipe) {
					const item = inventory.find((i) => i.id === r.materialId);
					if (item) {
						await updateDocument(user.uid, "inventory", r.materialId, {
							stock: item.stock - r.quantity,
						});
					}
				}
			}

			// 3. Calcular Coste
			const cost =
				treatment.recipe?.reduce((total, r) => {
					const item = inventory.find((m) => m.id === r.materialId);
					return total + (item ? item.unitCost * r.quantity : 0);
				}, 0) || 0;

			// Preparar nombre
			const displayName = clientData.id
				? `${treatment.name} (${clientData.name} ${clientData.surname || ""})`
				: `${treatment.name} (${clientData.name})`;

			// 4. Registrar Ingreso
			await addDocument(user.uid, "finance_entries", {
				date: new Date().toISOString().split("T")[0],
				type: "income",
				category: "Servicio",
				description: displayName,
				amount: Number(treatment.price),
				relatedCost: cost,
				clientId: clientData.id || null,
				clientNameSnapshot: clientData.name,
				recipeSnapshot: treatment.recipe || [],
				createdAt: new Date().toISOString(),
			});

			// 5. Registrar Gasto
			if (cost > 0) {
				await addDocument(user.uid, "finance_entries", {
					date: new Date().toISOString().split("T")[0],
					type: "expense",
					category: "Material",
					isAutomatic: true,
					description: `Material: ${treatment.name}`,
					amount: cost,
				});
			}

			showToastMsg("Sesión registrada con éxito");
			setSelectedTreatment(null);
		} catch (e) {
			console.error("Error en handleSession:", e);
			showToastMsg("Error al registrar sesión", "error");
		}
	};

	if (loading)
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
				<span className="font-bold text-xl text-rose-500">
					{profile?.companyName || "DermoApp"}
				</span>
				<button onClick={() => setShowLogout(true)}>
					<LogOut size={16} className="text-gray-400" />
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
