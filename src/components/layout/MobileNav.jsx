import React from "react";
import {
	LayoutDashboard,
	Users,
	Sparkles,
	Package,
	Euro,
	Settings,
} from "lucide-react";

export const MobileNav = ({ activeTab, setActiveTab }) => {
	const navItems = [
		{ id: "dashboard", label: "Inicio", icon: <LayoutDashboard size={20} /> },
		{ id: "clients", label: "Clientes", icon: <Users size={20} /> },
		{ id: "treatments", label: "Servicios", icon: <Sparkles size={20} /> },
		{ id: "inventory", label: "Stock", icon: <Package size={20} /> },
		{ id: "finance", label: "Finanzas", icon: <Euro size={20} /> },
		{ id: "settings", label: "Ajustes", icon: <Settings size={20} /> },
	];

	return (
		<div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
			<div className="grid grid-cols-6 h-16 max-w-xl mx-auto">
				{" "}
				{/* Fix: Centrado */}
				{navItems.map((item) => (
					<button
						key={item.id}
						onClick={() => setActiveTab(item.id)}
						className={`flex flex-col items-center justify-center gap-1 transition-all ${
							activeTab === item.id ? "text-rose-500" : "text-gray-400"
						}`}>
						<div
							className={`p-1.5 rounded-xl ${
								activeTab === item.id ? "bg-rose-50" : ""
							}`}>
							{item.icon}
						</div>
						<span className="text-[8px] font-black uppercase tracking-tighter">
							{item.label}
						</span>
					</button>
				))}
			</div>
		</div>
	);
};
