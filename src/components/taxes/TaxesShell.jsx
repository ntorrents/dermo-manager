import React, { useEffect, useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useTaxDeclarations } from "../../hooks/useTaxDeclarations";
import { ensureTaxCalendarEvents } from "../../services/taxCalendar";
import { TaxHubView } from "./hub/TaxHubView";
import { Modelo130View } from "./models/Modelo130View";
import { Modelo303View } from "./models/Modelo303View";
import { Modelo115View } from "./models/Modelo115View";
import { Modelo390View, Modelo180View } from "./models/ModeloAnualViews";
import { PreparacionRentaView } from "./renta/PreparacionRentaView";
import { DeclaracionesResumenView } from "./declarations/DeclaracionesResumenView";
import { AssetsTab } from "./AssetsTab";
import { PageTabs } from "../ui/PageTabs";

const TAX_BASE = "/finanzas/fiscalidad";

export const TaxesShell = ({
	entries = [],
	clients = [],
	user,
	showToast = () => {},
	onNavigateFinanceIssues,
	basePath = TAX_BASE,
}) => {
	const { user: authUser } = useAuth();
	const { clinicId } = useTenant();
	const { declarations, upsertDeclaration } = useTaxDeclarations(authUser?.id || user?.id);

	useEffect(() => {
		const uid = authUser?.id || user?.id;
		if (!clinicId || !uid) return;
		const year = new Date().getFullYear();
		ensureTaxCalendarEvents(year, clinicId, uid).catch((err) =>
			console.warn("tax calendar seed:", err),
		);
		ensureTaxCalendarEvents(year - 1, clinicId, uid).catch(() => {});
	}, [clinicId, authUser?.id, user?.id]);

	const subnav = useMemo(
		() => [
			{ to: basePath, end: true, label: "Resumen" },
			{ to: `${basePath}/trimestral/130`, label: "130" },
			{ to: `${basePath}/trimestral/303`, label: "303" },
			{ to: `${basePath}/trimestral/115`, label: "115" },
			{ to: `${basePath}/anual/390`, label: "390" },
			{ to: `${basePath}/anual/180`, label: "180" },
			{ to: `${basePath}/renta`, label: "Renta" },
			{ to: `${basePath}/declaraciones`, label: "Declaraciones" },
			{ to: `${basePath}/bienes-inversion`, label: "Bienes" },
		],
		[basePath],
	);

	const common = {
		entries,
		clients,
		declarations,
		upsertDeclaration,
		showToast,
		user: authUser || user,
		onNavigateFinanceIssues,
		taxBasePath: basePath,
	};

	return (
		<div className="space-y-4">
			<PageTabs items={subnav} />
			<Routes>
				<Route index element={<TaxHubView {...common} />} />
				<Route path="trimestral/130" element={<Modelo130View {...common} />} />
				<Route path="trimestral/303" element={<Modelo303View {...common} />} />
				<Route path="trimestral/115" element={<Modelo115View {...common} />} />
				<Route path="anual/390" element={<Modelo390View {...common} />} />
				<Route path="anual/180" element={<Modelo180View {...common} />} />
				<Route path="renta" element={<PreparacionRentaView {...common} />} />
				<Route path="declaraciones" element={<DeclaracionesResumenView {...common} />} />
				<Route path="bienes-inversion" element={<AssetsTab entries={entries} />} />
				<Route path="*" element={<Navigate to={basePath} replace />} />
			</Routes>
		</div>
	);
};
