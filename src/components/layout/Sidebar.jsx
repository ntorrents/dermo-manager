import React, { useState, useEffect } from "react";
import { useTenant } from "../../context/TenantContext";
import {
	BarChart3,
	Users,
	Package,
	DollarSign,
	Landmark,
	FolderOpen,
	Settings,
	ChevronDown
} from "lucide-react";
import { NAV_LABELS, PATH_MAP } from "./navigationLabels";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

const NAV_GROUPS = [
	{
		id: "dashboard-group",
		label: "Dashboard",
		icon: BarChart3,
		items: [
			{ id: "dashboard", l: NAV_LABELS.dashboard }
		]
	},
	{
		id: "clinic-group",
		label: "Clínica & Pacientes",
		icon: Users,
		items: [
			{ id: "clients", l: NAV_LABELS.clients },
			{ id: "calendar", l: NAV_LABELS.calendar },
			{ id: "treatments", l: NAV_LABELS.treatments }
		]
	},
	{
		id: "sales-group",
		label: "Documentos & Ventas",
		icon: FolderOpen,
		items: [
			{ id: "bonos", l: NAV_LABELS.bonos, requireBonos: true },
			{ id: "consents", l: NAV_LABELS.consents },
			{ id: "budgets", l: NAV_LABELS.budgets }
		]
	},
	{
		id: "inventory-group",
		label: "Inventario & Compras",
		icon: Package,
		items: [
			{ id: "inventory", l: NAV_LABELS.inventory },
			{ id: "suppliers", l: NAV_LABELS.suppliers }
		]
	},
	{
		id: "finance-group",
		label: "Finanzas & Caja",
		icon: DollarSign,
		items: [

			{ id: "finance_movements", l: NAV_LABELS.finance_movements },
			{ id: "financial_analysis", l: NAV_LABELS.financial_analysis },
			{ id: "invoices", l: NAV_LABELS.invoices }
		]
	},
	{
		id: "taxes-group",
		label: "Fiscalidad & AEAT",
		icon: Landmark,
		items: [
			{ id: "taxes", l: NAV_LABELS.taxes },
			{ id: "assets", l: NAV_LABELS.assets }
		]
	},
	{
		id: "settings-group",
		label: "Configuración",
		icon: Settings,
		items: [
			{ id: "settings", l: NAV_LABELS.settings }
		]
	}
];

export const Sidebar = ({
	companyName,
	collapsed,
	setCollapsed
}) => {
	const [tempExpanded, setTempExpanded] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	const { allowsPresupuestosBonos, loading: tenantLoading } = useTenant();
	
	// Por defecto, abrimos el grupo que contenga el tab activo
	const [expandedGroups, setExpandedGroups] = useState({});

	const activeTab = location.pathname;

	// Abrir el grupo activo al cambiar de tab o al montar
	useEffect(() => {
		setExpandedGroups(prev => {
			const next = { ...prev };
			for (const group of NAV_GROUPS) {
				if (group.items.some(item => activeTab.startsWith(PATH_MAP[item.id]))) {
					next[group.id] = true;
				}
			}
			return next;
		});
	}, [activeTab]);

	const narrow = Boolean(collapsed);

	const toggleGroup = (groupId) => {
		setExpandedGroups(prev => ({
			...prev,
			[groupId]: !prev[groupId]
		}));
	};

	return (
		<div
			className={`hidden md:flex flex-col shrink-0 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 z-50 transition-[width] duration-200 ease-out ${
				narrow ? "w-[4.5rem]" : "w-60 lg:w-64"
			}`}>
			<div
				className={`h-16 flex items-center border-b border-slate-100 shrink-0 ${narrow ? "justify-center px-1" : "px-4"}`}>
				<button
					type="button"
					onClick={() => navigate("/")}
					className="flex items-center gap-2 truncate hover:opacity-80 transition-opacity cursor-pointer"
					title="Ir a inicio">
					{narrow ? (
						<span
							className="text-sm font-black text-rose-700"
							title={companyName || "DermoApp"}>
							{(companyName || "DM").slice(0, 2).toUpperCase()}
						</span>
					) : (
						<h1 className="text-lg font-bold text-rose-700 truncate">{companyName || "DermoApp"}</h1>
					)}
				</button>
			</div>
			<nav className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-2 ${narrow ? "p-2" : "p-3 lg:p-4"}`}>
				{NAV_GROUPS.map((group) => {
					// Filtrar items según permisos
					const validItems = group.items.filter(item => {
						if (tenantLoading) return true;
						if (item.requireBonos) return allowsPresupuestosBonos;
						return true;
					});
					
					if (validItems.length === 0) return null;
					
					const isExpanded = !!expandedGroups[group.id];
					// Considerar el grupo activo si alguno de sus hijos está activo
					const isGroupActive = validItems.some(item => activeTab.startsWith(PATH_MAP[item.id]));

					const hasMultipleItems = validItems.length > 1;

					return (
						<div key={group.id} className="space-y-1">
							<button
								onClick={() => {
									if (narrow) {
										if (hasMultipleItems) {
											setCollapsed(false);
											setTempExpanded(true);
											setExpandedGroups(prev => ({...prev, [group.id]: true}));
										} else {
											navigate(PATH_MAP[validItems[0].id]);
										}
									} else if (hasMultipleItems) {
										toggleGroup(group.id);
									} else {
										navigate(PATH_MAP[validItems[0].id]);
										if (tempExpanded) {
											setCollapsed(true);
											setTempExpanded(false);
										}
									}
								}}
								title={group.label}
								className={`w-full flex items-center justify-between rounded-xl font-semibold transition-colors ${
									narrow ? "px-0 py-3 justify-center" : "px-3 py-2.5"
								} ${
									isGroupActive && (!isExpanded || !hasMultipleItems)
										? "text-rose-700 bg-rose-50 shadow-sm"
										: "text-slate-600 hover:bg-slate-50"
								}`}>
								<div className="flex items-center gap-3">
									<group.icon size={narrow ? 22 : 18} strokeWidth={1.5} className={isGroupActive ? "text-rose-700" : "text-slate-400"} />
									{!narrow && <span className="text-[13px] truncate">{group.label}</span>}
								</div>
								{!narrow && hasMultipleItems && (
									<ChevronDown 
										size={16} 
										className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
									/>
								)}
							</button>

							{!narrow && isExpanded && hasMultipleItems && (
								<div className="pl-9 space-y-1 mt-1">
									{validItems.map((item) => {
										
										return (
											<NavLink
												key={item.id}
												to={PATH_MAP[item.id]}
												onClick={() => {
													if (tempExpanded) {
														setCollapsed(true);
														setTempExpanded(false);
													}
												}}
												className={({ isActive }) => `w-full block text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
													isActive || activeTab.startsWith(PATH_MAP[item.id]) && PATH_MAP[item.id] !== "/" 
														? "bg-rose-700 text-white shadow-sm"
														: "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
												}`}>
												{item.l}
											</NavLink>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</nav>
		</div>
	);
};
