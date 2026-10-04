import React from "react";
import { Outlet } from "react-router-dom";
import { PageSectionHeader } from "../ui/PageTabs";
import { useTenant } from "../../context/TenantContext";

export const CatalogShell = () => {
	const { hasModule, allowsPresupuestosBonos } = useTenant();

	const tabs = [
		{ to: "/catalogo/tratamientos", label: "Tratamientos" },
		hasModule("products_catalog") && {
			to: "/catalogo/productos",
			label: "Productos",
		},
		allowsPresupuestosBonos &&
			hasModule("bonos_manager") && {
				to: "/catalogo/bonos",
				label: "Bonos",
			},
	].filter(Boolean);

	return (
		<div className="space-y-2">
			<PageSectionHeader
				title="Catálogo"
				subtitle="Tratamientos, productos y bonos"
				tabs={tabs}
			/>
			<Outlet />
		</div>
	);
};
