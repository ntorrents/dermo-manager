import React from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";
import { AlertsMenu } from "./AlertsMenu";

export const AppHeader = ({
	title,
	subtitle,
	setActiveTab,
	sidebarCollapsed,
	onToggleSidebar,
	clients,
	treatments,
	inventory,
	appointments = [],
	batches = [],
	user,
	profile,
	clinic,
	onLogout,
	onOpenSettings,
	showSidebarToggle = true,
}) => {
	return (
		<header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 shadow-sm">
			<div className="mx-auto flex max-w-7xl 2xl:max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-2 px-4 sm:px-6 lg:px-8 py-3 md:py-3">
				{showSidebarToggle && (
					<button
						type="button"
						onClick={onToggleSidebar}
						className="hidden md:inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-600 hover:bg-gray-50 transition-colors"
						title={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}
						aria-label={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}>
						{sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
						<span className="text-xs font-bold text-gray-500 max-w-[7rem] truncate sm:max-w-none">
							{sidebarCollapsed ? "Menú" : "Ocultar menú"}
						</span>
					</button>
				)}
				<div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-auto">
					<h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-gray-900">
						{title}
					</h1>
					{subtitle ? (
						<p className="truncate text-xs sm:text-sm text-gray-500 font-medium">{subtitle}</p>
					) : null}
				</div>
				<div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial sm:gap-3">
					<div className="hidden min-w-0 max-w-[11rem] sm:max-w-[13rem] md:block md:max-w-[15rem] lg:max-w-[17rem]">
						<GlobalSearch
							clients={clients}
							treatments={treatments}
							inventory={inventory}
							setActiveTab={setActiveTab}
							variant="toolbar"
						/>
					</div>
					<AlertsMenu
						appointments={appointments}
						inventory={inventory}
						batches={batches}
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
				<div className="w-full md:hidden">
					<GlobalSearch
						clients={clients}
						treatments={treatments}
						inventory={inventory}
						setActiveTab={setActiveTab}
						variant="toolbar"
					/>
				</div>
			</div>
		</header>
	);
};
