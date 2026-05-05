import React, { useMemo, useState } from "react";
import { useTenant } from "../../context/TenantContext";
import {
	LayoutDashboard,
	Users,
	Sparkles,
	Package,
	MoreHorizontal,
} from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { NAV_LABELS } from "./navigationLabels";

const MAIN_NAV_ITEMS = [
	{ id: "dashboard", label: NAV_LABELS.dashboard, icon: <LayoutDashboard size={20} /> },
	{ id: "clients", label: NAV_LABELS.clients, icon: <Users size={20} /> },
	{ id: "treatments", label: NAV_LABELS.treatments, icon: <Sparkles size={20} /> },
	{ id: "inventory", label: NAV_LABELS.inventory, icon: <Package size={20} /> },
];

export const MobileNav = ({ activeTab, setActiveTab }) => {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { allowsPresupuestosBonos, loading: tenantLoading } = useTenant();

	const drawerTabIds = useMemo(() => {
		const base = ["calendar", "documents", "finance", "suppliers", "taxes", "settings"];
		if (tenantLoading || allowsPresupuestosBonos) {
			return [...base, "bonos"];
		}
		return base;
	}, [tenantLoading, allowsPresupuestosBonos]);

	const isInDrawer = drawerTabIds.includes(activeTab);

	return (
		<>
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
				<div className="grid grid-cols-5 h-16 max-w-xl mx-auto">
					{MAIN_NAV_ITEMS.map((item) => (
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
					<button
						onClick={() => setDrawerOpen(true)}
						className={`flex flex-col items-center justify-center gap-1 transition-all ${
							isInDrawer ? "text-rose-500" : "text-gray-400"
						}`}>
						<div
							className={`p-1.5 rounded-xl ${
								isInDrawer ? "bg-rose-50" : ""
							}`}>
							<MoreHorizontal size={20} />
						</div>
						<span className="text-[8px] font-black uppercase tracking-tighter">
							Más
						</span>
					</button>
				</div>
			</div>
			<MobileDrawer
				isOpen={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				activeTab={activeTab}
				setActiveTab={setActiveTab}
			/>
		</>
	);
};
