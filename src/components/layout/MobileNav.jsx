import React, { useMemo, useState } from "react";
import { useTenant } from "../../context/TenantContext";
import {
	Home,
	Users,
	Sparkles,
	Package,
	MoreHorizontal,
} from "lucide-react";
import { MobileDrawer, DRAWER_NAV_IDS } from "./MobileDrawer";
import { NAV_LABELS, PATH_MAP, resolveNavIdFromPath } from "./navigationLabels";
import { filterNavItem } from "./navModules";
import { useNavigate, useLocation } from "react-router-dom";

const MAIN_NAV_ITEMS = [
	{ id: "home", label: NAV_LABELS.home, icon: <Home size={20} /> },
	{ id: "clients", label: NAV_LABELS.clients, icon: <Users size={20} /> },
	{ id: "treatments", label: NAV_LABELS.treatments, icon: <Sparkles size={20} /> },
	{ id: "inventory", label: NAV_LABELS.inventory, icon: <Package size={20} /> },
];

export const MobileNav = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const activeTabId = resolveNavIdFromPath(location.pathname);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { allowsPresupuestosBonos, loading: tenantLoading, hasModule } = useTenant();

	const mainItems = useMemo(
		() =>
			MAIN_NAV_ITEMS.filter((item) =>
				filterNavItem(item, {
					tenantLoading,
					allowsPresupuestosBonos,
					hasModuleFn: hasModule,
				}),
			),
		[tenantLoading, allowsPresupuestosBonos, hasModule],
	);

	const drawerTabIds = useMemo(() => {
		return DRAWER_NAV_IDS.filter((id) =>
			filterNavItem(
				{ id, requireBonos: id === "bonos" },
				{ tenantLoading, allowsPresupuestosBonos, hasModuleFn: hasModule },
			),
		);
	}, [tenantLoading, allowsPresupuestosBonos, hasModule]);

	const isInDrawer = drawerTabIds.includes(activeTabId);

	const colCount = Math.max(2, mainItems.length + 1);

	return (
		<>
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
				<div
					className="h-16 max-w-xl mx-auto grid"
					style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
					{mainItems.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => navigate(PATH_MAP[item.id] || "/")}
							className={`flex flex-col items-center justify-center gap-1 transition-all ${
								activeTabId === item.id ? "text-rose-700" : "text-gray-400"
							}`}>
							<div
								className={`p-1.5 rounded-xl ${
									activeTabId === item.id ? "bg-rose-50" : ""
								}`}>
								{item.icon}
							</div>
							<span className="text-[8px] font-black uppercase tracking-tighter">
								{item.label}
							</span>
						</button>
					))}
					<button
						type="button"
						onClick={() => setDrawerOpen(true)}
						className={`flex flex-col items-center justify-center gap-1 transition-all ${
							isInDrawer ? "text-rose-700" : "text-gray-400"
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
				activeTabId={activeTabId}
			/>
		</>
	);
};
