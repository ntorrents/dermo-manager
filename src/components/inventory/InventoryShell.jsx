import React from "react";
import { Outlet } from "react-router-dom";
import { PageSectionHeader } from "../ui/PageTabs";
import { useTenant } from "../../context/TenantContext";

export const InventoryShell = () => {
	const { hasModule } = useTenant();
	const tabs = [
		hasModule("inventory_core") && {
			to: "/inventario",
			end: true,
			label: "Stock",
		},
		hasModule("suppliers_manager") && {
			to: "/inventario/compras",
			label: "Compras",
		},
	].filter(Boolean);

	return (
		<div className="space-y-2">
			<PageSectionHeader
				title="Inventario"
				subtitle="Stock clínico y compras a proveedores"
				tabs={
					tabs.length
						? tabs
						: [{ to: "/inventario", end: true, label: "Stock" }]
				}
			/>
			<Outlet />
		</div>
	);
};
