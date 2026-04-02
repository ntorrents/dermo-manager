import React, { useEffect, useMemo } from "react";
import { Euro, Landmark, Settings, X, Calendar, Ticket, FolderOpen } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

const DRAWER_ITEMS = [
	{ id: "calendar", label: "Agenda", icon: Calendar },
	{ id: "bonos", label: "Bonos", icon: Ticket },
	{ id: "documents", label: "Documentos", icon: FolderOpen },
	{ id: "finance", label: "Finanzas", icon: Euro },
	{ id: "taxes", label: "Fiscalidad", icon: Landmark },
	{ id: "settings", label: "Ajustes", icon: Settings },
];

export const MobileDrawer = ({ isOpen, onClose, activeTab, setActiveTab }) => {
	const { allowsPresupuestosBonos, loading: tenantLoading } = useTenant();

	const drawerItems = useMemo(
		() =>
			DRAWER_ITEMS.filter((item) => {
				if (tenantLoading) return true;
				if (item.id === "bonos") return allowsPresupuestosBonos;
				return true;
			}),
		[tenantLoading, allowsPresupuestosBonos]
	);
	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const handleSelect = (id) => {
		setActiveTab(id);
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
				<div className="p-4 border-b border-gray-100 flex justify-between items-center">
					<h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">
						Más opciones
					</h3>
					<button
						onClick={onClose}
						className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
						<X size={20} />
					</button>
				</div>
				<nav className="p-4 space-y-1 flex-1">
					{drawerItems.map((item) => (
						<button
							key={item.id}
							onClick={() => handleSelect(item.id)}
							className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-left transition-colors ${
								activeTab === item.id
									? "bg-rose-500 text-white"
									: "text-gray-600 hover:bg-gray-50"
							}`}>
							<item.icon size={20} />
							{item.label}
						</button>
					))}
				</nav>
			</div>
		</>
	);
};
