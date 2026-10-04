import React from "react";
import {
	BarChart3,
	Users,
	Package,
	DollarSign,
	Settings,
	Megaphone,
	ShoppingBag,
	Calendar,
	FileText,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { UserMenu } from "./UserMenu";

/** Exactamente 9 elementos de Nivel 1. */
const NAV_ITEMS = [
	{ id: "dashboard", label: "Dashboard", icon: BarChart3, to: "/dashboard" },
	{ id: "calendar", label: "Agenda", icon: Calendar, to: "/agenda" },
	{ id: "clients", label: "Pacientes", icon: Users, to: "/clientes" },
	{ id: "catalog", label: "Catálogo", icon: ShoppingBag, to: "/catalogo" },
	{ id: "inventory", label: "Inventario", icon: Package, to: "/inventario" },
	{ id: "finance", label: "Finanzas", icon: DollarSign, to: "/finanzas/movimientos" },
	{ id: "documents", label: "Documentos", icon: FileText, to: "/documentos" },
	{ id: "marketing", label: "Marketing", icon: Megaphone, to: "/marketing/campanas" },
	{ id: "settings", label: "Configuración", icon: Settings, to: "/configuracion" },
];

const isItemActive = (pathname, item) => {
	if (item.id === "finance") return pathname.startsWith("/finanzas");
	if (item.id === "inventory") {
		return pathname.startsWith("/inventario") || pathname.startsWith("/proveedores");
	}
	if (item.id === "catalog") {
		return (
			pathname.startsWith("/catalogo") ||
			pathname.startsWith("/productos") ||
			pathname.startsWith("/tratamientos") ||
			pathname.startsWith("/bonos")
		);
	}
	if (item.id === "documents") {
		return (
			pathname.startsWith("/documentos") ||
			pathname.startsWith("/presupuestos") ||
			pathname.startsWith("/consentimientos")
		);
	}
	if (item.id === "marketing") return pathname.startsWith("/marketing");
	if (item.id === "clients") return pathname.startsWith("/clientes");
	if (item.id === "calendar") return pathname.startsWith("/agenda");
	if (item.id === "settings") return pathname.startsWith("/configuracion");
	if (item.id === "dashboard") return pathname === "/dashboard";
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

export const Sidebar = ({
	companyName,
	collapsed,
	setCollapsed,
	user,
	profile,
	clinic,
	onLogout,
	onOpenSettings,
}) => {
	const location = useLocation();
	const navigate = useNavigate();
	const narrow = Boolean(collapsed);

	return (
		<aside
			className={`hidden md:flex flex-col shrink-0 bg-surface border-r border-edge h-screen fixed left-0 top-0 z-50 transition-[width] duration-200 ease-out ${
				narrow ? "w-[4.5rem]" : "w-60 lg:w-64"
			}`}>
			<div
				className={`h-16 flex items-center border-b border-edge shrink-0 ${
					narrow ? "justify-center px-1" : "px-4"
				}`}>
				<button
					type="button"
					onClick={() => navigate("/")}
					className="flex items-center gap-2.5 truncate hover:opacity-80 transition-opacity min-w-0"
					title="Ir a inicio">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary text-xs font-black">
						{(companyName || "CL").slice(0, 2).toUpperCase()}
					</span>
					{!narrow && (
						<span className="text-[15px] font-bold text-fg truncate tracking-tight">
							{companyName || "Clínica"}
						</span>
					)}
				</button>
			</div>

			<nav
				className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-0.5 ${
					narrow ? "p-2" : "p-3"
				}`}>
				{NAV_ITEMS.map((item) => {
					const active = isItemActive(location.pathname, item);
					const Icon = item.icon;
					return (
						<NavLink
							key={item.id}
							to={item.to}
							title={item.label}
							onClick={() => {
								if (narrow) setCollapsed?.(true);
							}}
							className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-semibold transition-colors ${
								narrow ? "justify-center px-0 py-3" : "px-3 py-2.5"
							} ${
								active
									? "bg-[var(--ui-sidebar-active-bg)] text-[var(--ui-sidebar-active-fg)]"
									: "text-muted hover:bg-surface-2 hover:text-fg"
							}`}>
							<Icon
								size={narrow ? 22 : 18}
								strokeWidth={1.5}
								className={
									active
										? "text-[var(--ui-sidebar-active-fg)]"
										: "text-muted"
								}
							/>
							{!narrow && <span className="truncate">{item.label}</span>}
						</NavLink>
					);
				})}
			</nav>

			<div className={`shrink-0 border-t border-edge ${narrow ? "p-2" : "p-3"}`}>
				<UserMenu
					user={user}
					profile={profile}
					clinic={clinic}
					onLogout={onLogout}
					onOpenSettings={onOpenSettings}
					compact={narrow}
					placement="top"
					variant="sidebar"
				/>
			</div>
		</aside>
	);
};
