import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Layout FormSheet: esencial (izq) + preview vivo (der) + detalles colapsables.
 * Pensado para vivir dentro de SidePanel size="lg".
 */
export const FormSheet = ({ children, className = "", as: Tag = "div", ...rest }) => (
	<Tag
		className={`grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)] md:items-start ${className}`}
		{...rest}>
		{children}
	</Tag>
);

export const FormSheetPrimary = ({ children, title = "Esencial", className = "" }) => (
	<section className={`space-y-4 min-w-0 ${className}`}>
		{title ? <p className="erp-label">{title}</p> : null}
		{children}
	</section>
);

export const FormSheetPreview = ({ children, title = "Vista previa", className = "" }) => (
	<aside
		className={`rounded-2xl border border-edge bg-surface-dark text-on-surface-dark p-5 md:sticky md:top-0 space-y-3 ${className}`}>
		{title ? (
			<p className="text-[11px] font-bold uppercase tracking-wider opacity-60">{title}</p>
		) : null}
		{children}
	</aside>
);

export const FormPreviewStat = ({ label, value, tone = "default" }) => {
	const valueClass =
		tone === "success"
			? "text-emerald-300"
			: tone === "danger"
				? "text-rose-300"
				: tone === "warning"
					? "text-amber-300"
					: tone === "accent"
						? "text-sky-300"
						: "text-on-surface-dark";
	return (
		<div>
			<p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{label}</p>
			<p className={`text-lg font-black tabular-nums ${valueClass}`}>{value}</p>
		</div>
	);
};

/**
 * Acordeón “Más detalles” para campos secundarios (lote, NIF, IVA, adjuntos…).
 */
export const FormDetails = ({
	children,
	title = "Más detalles",
	defaultOpen = false,
	className = "",
}) => {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();

	return (
		<div className={`rounded-2xl border border-edge bg-surface overflow-hidden ${className}`}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors">
				<span className="text-xs font-bold uppercase tracking-wider text-muted">{title}</span>
				<ChevronDown
					size={16}
					className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open ? (
				<div id={panelId} className="border-t border-edge px-4 py-4 space-y-4">
					{children}
				</div>
			) : null}
		</div>
	);
};
