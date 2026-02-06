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

export const Sidebar = ({
	activeTab,
	setActiveTab,
	onLogout,
	companyName,
	clients = [],
	treatments = [],
	inventory = [],
}) => (
	<div className="hidden xl:flex flex-col w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50">
		<div className="h-20 flex items-center justify-center border-b">
			<h1 className="text-2xl font-bold text-rose-500">
				{companyName || "DermoApp"}
			</h1>
		</div>
		<GlobalSearch
			clients={clients}
			treatments={treatments}
			inventory={inventory}
			activeTab={activeTab}
			setActiveTab={setActiveTab}
		/>
		<nav className="p-4 space-y-2 flex-1">
			{[
				{ id: "dashboard", l: "Resumen", i: BarChart3 },
				{ id: "clients", l: "Clientes", i: Users },
				{ id: "treatments", l: "Tratamientos", i: Syringe },
				{ id: "inventory", l: "Stock", i: Package },
				{ id: "calendar", l: "Agenda", i: Calendar },
				{ id: "finance", l: "Finanzas", i: DollarSign },
				{ id: "taxes", l: "Fiscalidad", i: Landmark },
				{ id: "settings", l: "Configuración", i: Settings },
			].map((t) => (
				<button
					key={t.id}
					onClick={() => setActiveTab(t.id)}
					className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
						activeTab === t.id
							? "bg-rose-500 text-white"
							: "text-gray-500 hover:bg-gray-50"
					}`}>
					<t.i size={20} /> {t.l}
				</button>
			))}
		</nav>

		<div className="p-4 border-t">
			<button
				onClick={onLogout}
				className="flex items-center gap-3 text-red-500 font-medium w-full p-2 rounded-lg hover:bg-red-50 transition-colors">
				<LogOut size={20} /> Salir
			</button>
		</div>
	</div>
);
