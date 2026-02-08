import React from "react";
import {
	BarChart3,
	Syringe,
	Package,
	DollarSign,
	LogOut,
	Settings,
	Users,
	Landmark,
	Calendar,
} from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";

const NAV_ITEMS = [
	{ id: "dashboard", l: "Resumen", i: BarChart3 },
	{ id: "clients", l: "Clientes", i: Users },
	{ id: "treatments", l: "Tratamientos", i: Syringe },
	{ id: "inventory", l: "Stock", i: Package },
	{ id: "calendar", l: "Agenda", i: Calendar },
	{ id: "finance", l: "Finanzas", i: DollarSign },
	{ id: "taxes", l: "Fiscalidad", i: Landmark },
	{ id: "settings", l: "Configuración", i: Settings },
];

export const Sidebar = ({
	activeTab,
	setActiveTab,
	onLogout,
	companyName,
	clients = [],
	treatments = [],
	inventory = [],
}) => (
	<div className="hidden md:flex flex-col w-20 lg:w-64 shrink-0 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50 transition-all duration-200">
		{/* Header: compacto en md, completo en lg+ */}
		<div className="h-16 lg:h-20 flex items-center justify-center border-b shrink-0">
			<span
				className="text-lg font-black text-rose-500 lg:hidden"
				title={companyName || "DermoApp"}>
				{(companyName || "DM").slice(0, 2).toUpperCase()}
			</span>
			<h1 className="hidden lg:block text-xl font-bold text-rose-500 truncate px-2">
				{companyName || "DermoApp"}
			</h1>
		</div>
		{/* Búsqueda: solo en lg+ (sidebar ancho) */}
		<div className="hidden lg:block shrink-0 mt-2">
			<GlobalSearch
				clients={clients}
				treatments={treatments}
				inventory={inventory}
				activeTab={activeTab}
				setActiveTab={setActiveTab}
			/>
		</div>
		<nav className="p-2 lg:p-4 space-y-1 lg:space-y-2 flex-1 overflow-y-auto min-h-0">
			{NAV_ITEMS.map((t) => (
				<button
					key={t.id}
					onClick={() => setActiveTab(t.id)}
					title={t.l}
					className={`w-full flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-4 py-3 rounded-xl font-medium transition-colors ${
						activeTab === t.id
							? "bg-rose-500 text-white"
							: "text-gray-500 hover:bg-gray-50"
					}`}>
					<t.i size={22} className="shrink-0 lg:w-5 lg:h-5" />
					<span className="hidden lg:inline">{t.l}</span>
				</button>
			))}
		</nav>

		<div className="p-2 lg:p-4 border-t shrink-0">
			<button
				onClick={onLogout}
				title="Salir"
				className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 text-red-500 font-medium w-full p-2 rounded-lg hover:bg-red-50 transition-colors">
				<LogOut size={22} className="shrink-0 lg:w-5 lg:h-5" />
				<span className="hidden lg:inline">Salir</span>
			</button>
		</div>
	</div>
);
