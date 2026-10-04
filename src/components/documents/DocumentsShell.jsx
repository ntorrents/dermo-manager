import React from "react";
import { Outlet } from "react-router-dom";
import { PageSectionHeader } from "../ui/PageTabs";
import { useTenant } from "../../context/TenantContext";

export const DocumentsShell = () => {
	const { hasModule, allowsPresupuestosBonos } = useTenant();

	const tabs = [
		allowsPresupuestosBonos &&
			hasModule("bonos_manager") && {
				to: "/documentos/presupuestos",
				label: "Presupuestos",
			},
		hasModule("legal_signatures") && {
			to: "/documentos/consentimientos",
			label: "Consentimientos",
		},
	].filter(Boolean);

	return (
		<div className="space-y-2">
			<PageSectionHeader
				title="Documentos"
				subtitle="Presupuestos y consentimientos"
				tabs={tabs.length ? tabs : [{ to: "/documentos/presupuestos", label: "Presupuestos" }]}
			/>
			<Outlet />
		</div>
	);
};
