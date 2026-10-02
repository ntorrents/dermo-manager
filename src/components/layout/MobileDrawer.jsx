import React, { useEffect, useMemo } from "react";
import {
	Euro,
	Landmark,
	Settings,
	X,
	Calendar,
	Ticket,
	FolderOpen,
	Building2,
	FileText,
	BarChart3,
	ScrollText,
	FileSignature,
	PieChart,
	Wallet,
	Megaphone,
	ShoppingBag,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { NAV_LABELS, PATH_MAP } from "./navigationLabels";
import { useNavigate } from "react-router-dom";
import { filterNavItem } from "./navModules";

const ICONS = {
	dashboard: BarChart3,
	calendar: Calendar,
	products: ShoppingBag,
	products_ventas: ShoppingBag,
	bonos: Ticket,
	consents: FileSignature,
	budgets: ScrollText,
	finance_movements: Wallet,
	financial_analysis: PieChart,
	invoices: FileText,
	suppliers: Building2,
	taxes: Landmark,
	taxes_130: Landmark,
	taxes_303: Landmark,
	taxes_115: Landmark,
	taxes_390: Landmark,
	taxes_180: Landmark,
	taxes_renta: Landmark,
	taxes_declaraciones: Landmark,
	assets: Landmark,
	marketing: Megaphone,
	settings: Settings,
	documents: FolderOpen,
	finance: Euro,
};

const DRAWER_SECTIONS = [
	{
		id: "general",
		title: null,
		items: [
			{ id: "dashboard" },
			{ id: "calendar" },
		],
	},
	{
		id: "products",
		title: "Productos",
		items: [
			{ id: "products" },
			{ id: "products_ventas", nested: true },
		],
	},
	{
		id: "docs",
		title: "Documentos & Ventas",
		items: [
			{ id: "bonos", requireBonos: true },
			{ id: "consents" },
			{ id: "budgets" },
		],
	},
	{
		id: "finance",
		title: "Finanzas & Caja",
		items: [
			{ id: "finance_movements" },
			{ id: "financial_analysis" },
			{ id: "invoices" },
			{ id: "suppliers" },
		],
	},
	{
		id: "taxes",
		title: "Fiscalidad & AEAT",
		items: [
			{ id: "taxes" },
			{ id: "taxes_130", nested: true },
			{ id: "taxes_303", nested: true },
			{ id: "taxes_115", nested: true },
			{ id: "taxes_390", nested: true },
			{ id: "taxes_180", nested: true },
			{ id: "taxes_renta", nested: true },
			{ id: "taxes_declaraciones", nested: true },
			{ id: "assets", nested: true },
		],
	},
	{
		id: "marketing",
		title: "Marketing",
		items: [
			{ id: "marketing" },
			{ id: "marketing_campanas", nested: true },
			{ id: "marketing_seguimiento", nested: true },
			{ id: "marketing_plantillas", nested: true },
		],
	},
	{
		id: "settings",
		title: null,
		items: [{ id: "settings" }],
	},
];

/** IDs del drawer (para resaltar «Más» en la bottom bar). */
export const DRAWER_NAV_IDS = DRAWER_SECTIONS.flatMap((s) => s.items.map((i) => i.id));

export const MobileDrawer = ({ isOpen, onClose, activeTabId }) => {
	const navigate = useNavigate();
	const { allowsPresupuestosBonos, loading: tenantLoading, hasModule } = useTenant();

	const sections = useMemo(
		() =>
			DRAWER_SECTIONS.map((section) => ({
				...section,
				items: section.items.filter((item) =>
					filterNavItem(item, {
						tenantLoading,
						allowsPresupuestosBonos,
						hasModuleFn: hasModule,
					}),
				),
			})).filter((section) => section.items.length > 0),
		[tenantLoading, allowsPresupuestosBonos, hasModule],
	);

	useEffect(() => {
		if (!isOpen) return undefined;
		const onKeyDown = (event) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen, onClose]);

	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const handleSelect = (id) => {
		navigate(PATH_MAP[id] || "/");
		onClose();
	};

	return (
		<>
			<div
				className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in duration-200"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				className="fixed right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white z-[61] shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col"
				role="dialog"
				aria-label="Menú de navegación">
				<div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
					<h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">
						Más opciones
					</h3>
					<button
						type="button"
						onClick={onClose}
						aria-label="Cerrar menú lateral"
						className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
						<X size={20} />
					</button>
				</div>
				<nav className="p-4 space-y-4 flex-1 overflow-y-auto pb-8">
					{sections.map((section) => (
						<div key={section.id} className="space-y-1">
							{section.title && (
								<p className="px-3 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
									{section.title}
								</p>
							)}
							{section.items.map((item) => {
								const Icon = ICONS[item.id] || Landmark;
								const active = activeTabId === item.id;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => handleSelect(item.id)}
										className={`w-full flex items-center gap-3 rounded-xl font-bold text-left transition-colors ${
											item.nested
												? "pl-8 pr-3 py-2.5 text-sm"
												: "px-4 py-3.5"
										} ${
											active
												? "bg-rose-700 text-white"
												: "text-gray-600 hover:bg-gray-50"
										}`}>
										<Icon size={item.nested ? 16 : 20} className="shrink-0" />
										<span className="truncate">{NAV_LABELS[item.id] || item.id}</span>
									</button>
								);
							})}
						</div>
					))}
				</nav>
			</div>
		</>
	);
};
