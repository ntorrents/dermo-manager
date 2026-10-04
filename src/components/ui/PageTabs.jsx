import React from "react";
import { NavLink } from "react-router-dom";

/**
 * Pestañas horizontales (nivel 2) con subrayado activo.
 * items: [{ id?, to?, end?, label, onClick?, active? }]
 */
export function PageTabs({ items = [], className = "" }) {
	if (!items.length) return null;

	return (
		<nav
			className={`flex items-center gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:thin] ${className}`}
			aria-label="Secciones">
			{items.map((item) => {
				const base =
					"shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors";
				const inactive = "border-transparent text-slate-500 hover:text-slate-800";
				const activeCls = "border-slate-900 text-slate-900";

				if (item.to) {
					return (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							className={({ isActive }) =>
								`${base} ${isActive ? activeCls : inactive}`
							}>
							{item.label}
						</NavLink>
					);
				}

				return (
					<button
						key={item.id || item.label}
						type="button"
						onClick={item.onClick}
						className={`${base} ${item.active ? activeCls : inactive}`}>
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}

/** Título de página + tabs (patrón Nivel 2) */
export function PageSectionHeader({ title, subtitle, tabs, actions }) {
	return (
		<div className="space-y-4 mb-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					{title ? (
						<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg truncate">
							{title}
						</h1>
					) : null}
					{subtitle ? (
						<p className="text-sm text-muted mt-1">{subtitle}</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex items-center gap-2 shrink-0">{actions}</div>
				) : null}
			</div>
			{tabs?.length ? <PageTabs items={tabs} /> : null}
		</div>
	);
}
