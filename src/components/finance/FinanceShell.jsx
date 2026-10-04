import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageSectionHeader } from "../ui/PageTabs";
import { GlobalDateFilter } from "../layout/GlobalDateFilter";
import { useTenant } from "../../context/TenantContext";

export const FinanceShell = ({
	reportingRange,
	reportingPreset,
	setReportingPreset,
	reportingAnchorYm,
	setReportingAnchorYm,
	reportingCustomFrom,
	setReportingCustomFrom,
	reportingCustomTo,
	setReportingCustomTo,
	onReportingGoToday,
}) => {
	const { hasModule } = useTenant();
	const location = useLocation();
	const onFiscalidad = location.pathname.startsWith("/finanzas/fiscalidad");

	const tabs = [
		hasModule("finance_basic") && {
			to: "/finanzas/movimientos",
			label: "Movimientos",
		},
		hasModule("finance_invoices") && {
			to: "/finanzas/facturas",
			label: "Facturas",
		},
		hasModule("taxes_aeat") && {
			to: "/finanzas/fiscalidad",
			label: "Fiscalidad",
		},
	].filter(Boolean);

	return (
		<div className="space-y-2">
			<PageSectionHeader
				title="Finanzas"
				subtitle="Movimientos, facturas y fiscalidad"
				tabs={tabs}
				actions={
					typeof setReportingPreset === "function" && !onFiscalidad ? (
						<GlobalDateFilter
							preset={reportingPreset}
							onPresetChange={setReportingPreset}
							anchorYm={reportingAnchorYm}
							onAnchorYmChange={setReportingAnchorYm}
							customFrom={reportingCustomFrom}
							customTo={reportingCustomTo}
							onCustomFromChange={setReportingCustomFrom}
							onCustomToChange={setReportingCustomTo}
							rangeLabel={reportingRange?.label}
							onTodayClick={onReportingGoToday}
						/>
					) : null
				}
			/>
			<Outlet />
		</div>
	);
};
