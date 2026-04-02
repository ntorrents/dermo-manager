import React from "react";
import { useTenant } from "../../context/TenantContext";
import {
	BarChart3,
	Syringe,
	Package,
	DollarSign,
	Users,
	Landmark,
	Calendar,
	Ticket,
	FolderOpen,
} from "lucide-react";

const NAV_ITEMS = [
	{ id: "dashboard", l: "Resumen", i: BarChart3 },
	{ id: "clients", l: "Clientes", i: Users },
	{ id: "treatments", l: "Tratamientos", i: Syringe },
	{ id: "bonos", l: "Bonos", i: Ticket },
	{ id: "documents", l: "Documentos", i: FolderOpen },
	{ id: "inventory", l: "Stock", i: Package },
	{ id: "calendar", l: "Agenda", i: Calendar },
	{ id: "finance", l: "Finanzas", i: DollarSign },
	{ id: "taxes", l: "Fiscalidad", i: Landmark },
];

export const Sidebar = ({
	activeTab,
	setActiveTab,
	companyName,
	collapsed,
}) => {
	const { allowsPresupuestosBonos, loading: tenantLoading } = useTenant();

	const navItems = NAV_ITEMS.filter((t) => {
		if (tenantLoading) return true;
		if (t.id === "bonos") return allowsPresupuestosBonos;
		return true;
	});

	const narrow = Boolean(collapsed);

	return (
		<div
			className={`hidden md:flex flex-col shrink-0 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50 transition-[width] duration-200 ease-out ${
				narrow ? "w-[4.5rem]" : "w-60 lg:w-64"
			}`}>
			<div
				className={`h-16 flex items-center border-b shrink-0 ${narrow ? "justify-center px-1" : "px-4"}`}>
				{narrow ? (
					<span
						className="text-sm font-black text-rose-500"
						title={companyName || "DermoApp"}>
						{(companyName || "DM").slice(0, 2).toUpperCase()}
					</span>
				) : (
					<h1 className="text-lg font-bold text-rose-500 truncate">{companyName || "DermoApp"}</h1>
				)}
			</div>
			<nav className={`flex-1 overflow-y-auto min-h-0 space-y-1 ${narrow ? "p-2" : "p-3 lg:p-4"}`}>
				{navItems.map((t) => (
					<button
						key={t.id}
						onClick={() => setActiveTab(t.id)}
						title={t.l}
						className={`w-full flex items-center rounded-xl font-medium transition-colors ${
							narrow ? "justify-center px-0 py-3" : "justify-start gap-3 px-4 py-3"
						} ${
							activeTab === t.id
								? "bg-rose-500 text-white shadow-sm"
								: "text-gray-500 hover:bg-gray-50"
						}`}>
						<t.i size={22} className="shrink-0" />
						{!narrow && <span className="truncate">{t.l}</span>}
					</button>
				))}
			</nav>
		</div>
	);
};
