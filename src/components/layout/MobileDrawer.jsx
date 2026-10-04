import React, { useEffect, useMemo } from "react";
import {
	Settings,
	X,
	Calendar,
	FolderOpen,
	BarChart3,
	Megaphone,
	ShoppingBag,
	Package,
	Wallet,
	Users,
} from "lucide-react";
import { NAV_LABELS, PATH_MAP } from "./navigationLabels";
import { useNavigate } from "react-router-dom";

const ICONS = {
	dashboard: BarChart3,
	calendar: Calendar,
	clients: Users,
	catalog: ShoppingBag,
	inventory: Package,
	finance: Wallet,
	documents: FolderOpen,
	marketing: Megaphone,
	settings: Settings,
};

/** Mismos 9 ítems L1 que el Sidebar. */
const DRAWER_SECTIONS = [
	{
		id: "main",
		title: null,
		items: [
			{ id: "dashboard", label: "Dashboard", to: "/dashboard" },
			{ id: "calendar", label: "Agenda", to: "/agenda" },
			{ id: "clients", label: "Pacientes", to: "/clientes" },
			{ id: "catalog", label: "Catálogo", to: "/catalogo" },
			{ id: "inventory", label: "Inventario", to: "/inventario" },
			{ id: "finance", label: "Finanzas", to: "/finanzas/movimientos" },
			{ id: "documents", label: "Documentos", to: "/documentos" },
			{ id: "marketing", label: "Marketing", to: "/marketing/campanas" },
			{ id: "settings", label: "Configuración", to: "/configuracion" },
		],
	},
];

export const DRAWER_NAV_IDS = DRAWER_SECTIONS.flatMap((s) =>
	s.items.map((i) => i.id),
);

export const MobileDrawer = ({ isOpen, onClose, activeTabId }) => {
	const navigate = useNavigate();

	const sections = useMemo(() => DRAWER_SECTIONS, []);

	useEffect(() => {
		if (!isOpen) return undefined;
		const onKeyDown = (event) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const resolveActive = (item) => {
		if (item.id === "finance") return activeTabId?.startsWith?.("finance") || activeTabId?.startsWith?.("tax") || activeTabId === "invoices" || activeTabId === "assets";
		if (item.id === "catalog") return ["catalog", "treatments", "products", "products_ventas", "bonos"].includes(activeTabId);
		if (item.id === "documents") return ["documents", "budgets", "consents"].includes(activeTabId);
		if (item.id === "inventory") return ["inventory", "inventory_compras", "inventory_trazabilidad", "suppliers"].includes(activeTabId);
		return activeTabId === item.id;
	};

	return (
		<div className="fixed inset-0 z-[70] md:hidden">
			<button
				type="button"
				aria-label="Cerrar menú"
				className="absolute inset-0 bg-slate-900/40"
				onClick={onClose}
			/>
			<div className="absolute bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl pb-safe">
				<div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
					<p className="text-sm font-bold text-slate-900">Menú</p>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"
						aria-label="Cerrar">
						<X size={18} />
					</button>
				</div>
				{sections.map((section) => (
					<div key={section.id} className="px-3 py-3 space-y-0.5">
						{section.items.map((item) => {
							const Icon = ICONS[item.id] || FolderOpen;
							const active = resolveActive(item);
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => {
										navigate(item.to || PATH_MAP[item.id] || "/");
										onClose();
									}}
									className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${
										active
											? "bg-slate-900 text-white"
											: "text-slate-600 hover:bg-slate-50"
									}`}>
									<Icon size={18} strokeWidth={1.5} />
									{item.label || NAV_LABELS[item.id]}
								</button>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
};
