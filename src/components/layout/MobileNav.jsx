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
		{ id: "treatments", label: "Tratamientos", icon: <Sparkles size={20} /> },
		{ id: "inventory", label: "Stock", icon: <Package size={20} /> },
		{ id: "finance", label: "Finanzas", icon: <Euro size={20} /> },
		{ id: "settings", label: "Ajustes", icon: <Settings size={20} /> },
	];

	return (
		<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
			<div className="grid grid-cols-6 h-16">
				{" "}
				{/* <--- grid-cols-6 IMPORTANTE */}
				{navItems.map((item) => (
					<button
						key={item.id}
						onClick={() => setActiveTab(item.id)}
						className={`flex flex-col items-center justify-center gap-1 transition-colors ${
							activeTab === item.id
								? "text-rose-500"
								: "text-gray-400 hover:text-gray-600"
						}`}>
						{item.icon}
						<span className="text-[9px] font-bold tracking-wide">
							{item.label}
						</span>
					</button>
				))}
			</div>
		</div>
	);
};
