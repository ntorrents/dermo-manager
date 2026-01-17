// /Users/nilto/Documents/GitHub/DermoManager/src/components/layout/MobileNav.jsx
import React from "react";
import {
	BarChart3,
	Syringe,
	Package,
	DollarSign,
	Settings,
} from "lucide-react";

export const MobileNav = ({ activeTab, setActiveTab }) => (
	<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
		{[
			{ id: "dashboard", l: "Inicio", i: BarChart3 },
			{ id: "treatments", l: "Tratar", i: Syringe },
			{ id: "inventory", l: "Stock", i: Package },
			{ id: "finance", l: "Finanzas", i: DollarSign },
			{ id: "settings", l: "Ajustes", i: Settings },
		].map((t) => (
			<button
				key={t.id}
				onClick={() => setActiveTab(t.id)}
				className={`flex flex-col items-center gap-1 ${activeTab === t.id ? "text-rose-500" : "text-gray-400"}`}>
				<t.i size={20} /> <span className="text-[10px] font-medium">{t.l}</span>
			</button>
		))}
	</div>
);
