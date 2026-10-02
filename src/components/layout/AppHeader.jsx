import React from "react";
import { PanelLeftClose, PanelLeft, Search } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { AlertsMenu } from "./AlertsMenu";
import { GlobalDateFilter } from "./GlobalDateFilter";

export const AppHeader = ({
	title,
	subtitle,
	setActiveTab,
	sidebarCollapsed,
	onToggleSidebar,
	appointments = [],
	inventory,
	batches = [],
	taxDeclarations = [],
	user,
	profile,
	clinic,
	onLogout,
	onOpenSettings,
	showSidebarToggle = true,
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
	onOpenCommandPalette,
}) => {
	const isMac =
		typeof navigator !== "undefined" &&
		navigator.platform.toUpperCase().includes("MAC");

	return (
		<header
			className="sticky top-0 z-40 border-b border-edge backdrop-blur-md shadow-sm"
			style={{ backgroundColor: "var(--ui-topbar-bg)" }}>
			<div className="mx-auto flex max-w-7xl 2xl:max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-2 px-4 sm:px-6 lg:px-8 py-3">
				{showSidebarToggle && (
					<button
						type="button"
						onClick={onToggleSidebar}
						className="hidden md:inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-edge bg-surface px-3 text-muted hover:bg-surface-2 transition-colors"
						title={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}
						aria-label={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}>
						{sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
						<span className="text-xs font-bold text-muted max-w-[7rem] truncate sm:max-w-none">
							{sidebarCollapsed ? "Menú" : "Ocultar"}
						</span>
					</button>
				)}
				<div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-auto">
					<h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-fg">
						{title}
					</h1>
					{subtitle ? (
						<p className="truncate text-xs sm:text-sm text-muted font-medium">{subtitle}</p>
					) : null}
				</div>
				<div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial sm:gap-3">
					<button
						type="button"
						onClick={onOpenCommandPalette}
						className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-muted hover:bg-surface-2 transition-colors min-w-0 max-w-[14rem]">
						<Search size={16} className="shrink-0" />
						<span className="hidden sm:inline truncate font-medium">Buscar…</span>
						<kbd className="hidden md:inline text-[10px] font-bold border border-edge rounded-md px-1.5 py-0.5 ml-1">
							{isMac ? "⌘K" : "Ctrl+K"}
						</kbd>
					</button>
					<div className="hidden sm:block">
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
					</div>
					<AlertsMenu
						appointments={appointments}
						inventory={inventory}
						batches={batches}
						taxDeclarations={taxDeclarations}
						setActiveTab={setActiveTab}
					/>
					<UserMenu
						user={user}
						profile={profile}
						clinic={clinic}
						onLogout={onLogout}
						onOpenSettings={onOpenSettings}
					/>
				</div>
			</div>
		</header>
	);
};
