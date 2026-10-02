import React from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";
import { MarketingHubView } from "./hub/MarketingHubView";
import { CampaignsView } from "./campaigns/CampaignsView";
import { FollowUpView } from "./followup/FollowUpView";
import { TemplatesView } from "./templates/TemplatesView";

export const MarketingShell = ({ showToast = () => {} }) => {
	const { hasModule } = useTenant();
	const location = useLocation();
	const canCampaigns = hasModule("marketing_campaigns");
	const canFollowup = hasModule("client_followup");

	if (!canCampaigns && !canFollowup) {
		return (
			<div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-amber-900">
				<p className="font-bold">Módulo no incluido</p>
				<p className="text-sm mt-1">
					Marketing y seguimiento no están activos en el plan de esta clínica.
				</p>
			</div>
		);
	}

	const subnav = [
		{ to: "/marketing", end: true, label: "Resumen", show: true },
		{ to: "/marketing/campanas", label: "Campañas", show: canCampaigns },
		{ to: "/marketing/seguimiento", label: "Seguimiento", show: canFollowup },
		{ to: "/marketing/plantillas", label: "Plantillas", show: canCampaigns },
	].filter((i) => i.show);

	const defaultPath = canCampaigns
		? "/marketing"
		: canFollowup
			? "/marketing/seguimiento"
			: "/marketing";

	return (
		<div className="space-y-6">
			<nav className="flex flex-nowrap gap-1.5 overflow-x-auto p-1 rounded-2xl bg-gray-100/80 -mx-1 px-1 [scrollbar-width:thin]">
				{subnav.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition ${
								isActive || (item.end && location.pathname === "/marketing")
									? "bg-white text-rose-700 shadow-sm"
									: "text-gray-500 hover:text-gray-800"
							}`
						}>
						{item.label}
					</NavLink>
				))}
			</nav>

			<Routes>
				<Route index element={<MarketingHubView showToast={showToast} />} />
				{canCampaigns && (
					<Route
						path="campanas"
						element={<CampaignsView showToast={showToast} />}
					/>
				)}
				{canFollowup && (
					<Route
						path="seguimiento"
						element={<FollowUpView showToast={showToast} />}
					/>
				)}
				{canCampaigns && (
					<Route
						path="plantillas"
						element={<TemplatesView showToast={showToast} />}
					/>
				)}
				<Route path="*" element={<Navigate to={defaultPath} replace />} />
			</Routes>
		</div>
	);
};
