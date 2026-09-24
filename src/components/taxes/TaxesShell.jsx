import React, { useEffect } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
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

const SUBNAV = [
	{ to: "/fiscalidad", end: true, label: "Hub" },
	{ to: "/fiscalidad/trimestral/130", label: "130" },
	{ to: "/fiscalidad/trimestral/303", label: "303" },
	{ to: "/fiscalidad/trimestral/115", label: "115" },
	{ to: "/fiscalidad/anual/390", label: "390" },
	{ to: "/fiscalidad/anual/180", label: "180" },
	{ to: "/fiscalidad/renta", label: "Renta" },
	{ to: "/fiscalidad/declaraciones", label: "Declaraciones" },
	{ to: "/fiscalidad/bienes-inversion", label: "Bienes" },
];

export const TaxesShell = ({
	entries = [],
	clients = [],
	user,
	showToast = () => {},
	onNavigateFinanceIssues,
}) => {
	const { user: authUser } = useAuth();
	const { clinicId } = useTenant();
	const location = useLocation();
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

	const common = {
		entries,
		clients,
		declarations,
		upsertDeclaration,
		showToast,
		user: authUser || user,
		onNavigateFinanceIssues,
	};

	return (
		<div className="space-y-6">
			<nav className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-gray-100/80">
				{SUBNAV.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
								isActive || (item.end && location.pathname === "/fiscalidad")
									? "bg-white text-rose-700 shadow-sm"
									: "text-gray-500 hover:text-gray-800"
							}`
						}>
						{item.label}
					</NavLink>
				))}
			</nav>

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
				<Route path="*" element={<Navigate to="/fiscalidad" replace />} />
			</Routes>
		</div>
	);
};
