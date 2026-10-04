import React from "react";
import { Link } from "react-router-dom";
import { PanelLeftClose, PanelLeft, ChevronRight } from "lucide-react";
import { AlertsMenu } from "./AlertsMenu";

export const AppHeader = ({
	breadcrumbs = [],
	setActiveTab,
	sidebarCollapsed,
	onToggleSidebar,
	appointments = [],
	inventory,
	batches = [],
	taxDeclarations = [],
	showSidebarToggle = true,
}) => {
	return (
		<header
			className="sticky top-0 z-40 border-b border-edge backdrop-blur-md"
			style={{ backgroundColor: "var(--ui-topbar-bg)" }}>
			<div className="mx-auto flex max-w-7xl 2xl:max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8 h-14">
				{showSidebarToggle && (
					<button
						type="button"
						onClick={onToggleSidebar}
						className="hidden md:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-surface text-muted hover:bg-surface-2 transition-colors"
						title={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}
						aria-label={sidebarCollapsed ? "Ampliar menú lateral" : "Contraer menú lateral"}>
						{sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
					</button>
				)}

				{/* Breadcrumbs */}
				<nav
					aria-label="Breadcrumb"
					className="min-w-0 flex-1 flex items-center gap-1.5 text-sm overflow-hidden">
					{breadcrumbs.map((crumb, idx) => {
						const isLast = idx === breadcrumbs.length - 1;
						return (
							<span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 min-w-0">
								{idx > 0 && (
									<ChevronRight size={14} className="text-muted shrink-0 opacity-60" />
								)}
								{!isLast && crumb.to ? (
									<Link
										to={crumb.to}
										className="truncate text-muted hover:text-fg font-medium transition-colors">
										{crumb.label}
									</Link>
								) : (
									<span
										className={`truncate font-semibold ${
											isLast ? "text-fg" : "text-muted"
										}`}
										aria-current={isLast ? "page" : undefined}>
										{crumb.label}
									</span>
								)}
							</span>
						);
					})}
				</nav>

				{/* Solo notificaciones */}
				<div className="shrink-0">
					<AlertsMenu
						appointments={appointments}
						inventory={inventory}
						batches={batches}
						taxDeclarations={taxDeclarations}
						setActiveTab={setActiveTab}
					/>
				</div>
			</div>
		</header>
	);
};
