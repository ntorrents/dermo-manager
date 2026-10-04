import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";
import { CampaignsView } from "./campaigns/CampaignsView";
import { AutomationsView } from "./automations/AutomationsView";
import { PageSectionHeader } from "../ui/PageTabs";

export const MarketingShell = ({ showToast = () => {} }) => {
	const { hasModule } = useTenant();
	const canCampaigns = hasModule("marketing_campaigns");
	const canFollowup = hasModule("client_followup");
	const canAutomations = canCampaigns || canFollowup;

	if (!canCampaigns && !canFollowup) {
		return (
			<div className="rounded-2xl border border-warning-border bg-warning-bg p-6 text-fg">
				<p className="font-bold">Módulo no incluido</p>
				<p className="text-sm mt-1 text-muted">
					Marketing no está activo en el plan de esta clínica.
				</p>
			</div>
		);
	}

	const tabs = [
		{ to: "/marketing/campanas", label: "Campañas", show: canCampaigns },
		{
			to: "/marketing/automatizaciones",
			label: "Automatizaciones",
			show: canAutomations,
		},
	].filter((i) => i.show);

	const defaultPath = canCampaigns
		? "/marketing/campanas"
		: "/marketing/automatizaciones";

	return (
		<div className="space-y-2">
			<PageSectionHeader
				title="Marketing"
				subtitle="Campañas y automatizaciones de mensajes"
				tabs={tabs}
			/>

			<Routes>
				<Route index element={<Navigate to={defaultPath} replace />} />
				{canCampaigns && (
					<Route
						path="campanas"
						element={<CampaignsView showToast={showToast} />}
					/>
				)}
				{canAutomations && (
					<Route
						path="automatizaciones"
						element={<AutomationsView showToast={showToast} />}
					/>
				)}
				{/* Rutas legacy */}
				<Route
					path="seguimiento"
					element={<Navigate to="/marketing/automatizaciones" replace />}
				/>
				<Route
					path="plantillas"
					element={<Navigate to="/marketing/automatizaciones" replace />}
				/>
				<Route path="*" element={<Navigate to={defaultPath} replace />} />
			</Routes>
		</div>
	);
};
