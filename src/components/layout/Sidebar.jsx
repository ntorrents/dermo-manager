// /Users/nilto/Documents/GitHub/DermoManager/src/components/layout/Sidebar.jsx
import React from "react";
import {
	BarChart3,
	Syringe,
	Package,
	DollarSign,
	LogOut,
	Settings,
} from "lucide-react";

export const Sidebar = ({ activeTab, setActiveTab, onLogout, companyName }) => (
	<div className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:bg-white md:border-r z-20">
		<div className="h-20 flex items-center justify-center border-b">
			<h1 className="text-2xl font-bold text-rose-500">
				{companyName || "DermoApp"}
			</h1>
		</div>
		<nav className="p-4 space-y-2 flex-1">
			{[
				{ id: "dashboard", l: "Resumen", i: BarChart3 },
				{ id: "treatments", l: "Tratamientos", i: Syringe },
				{ id: "inventory", l: "Stock", i: Package },
				{ id: "finance", l: "Finanzas", i: DollarSign },
				{ id: "settings", l: "Configuración", i: Settings },
			].map((t) => (
				<button
					key={t.id}
					onClick={() => setActiveTab(t.id)}
					className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === t.id ? "bg-rose-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
					<t.i size={20} /> {t.l}
				</button>
			))}
		</nav>
		<div className="p-4 border-t">
			<button
				onClick={onLogout}
				className="flex items-center gap-3 text-red-500 font-medium">
				<LogOut size={20} /> Salir
			</button>
		</div>
	</div>
);
