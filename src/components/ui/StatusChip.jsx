import React from "react";

const TONES = {
	success: "bg-emerald-50 text-emerald-800 border-emerald-100",
	warning: "bg-amber-50 text-amber-900 border-amber-100",
	danger: "bg-primary-soft text-[var(--ui-danger)] border-edge",
	neutral: "bg-surface-2 text-muted border-edge",
	info: "bg-primary-soft text-[var(--ui-sidebar-active-fg)] border-edge",
};

/**
 * Chip de estado suave para tablas y listas.
 * tone: success | warning | danger | neutral | info
 */
export const StatusChip = ({ children, tone = "neutral", className = "", ...rest }) => (
	<span
		{...rest}
		className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONES[tone] || TONES.neutral} ${className}`}>
		{children}
	</span>
);

export const statusToneFromLabel = (raw = "") => {
	const s = String(raw).toLowerCase();
	if (["paid", "pagada", "completed", "completado", "confirmada", "activo", "ok"].some((k) => s.includes(k)))
		return "success";
	if (["pending", "pendiente", "borrador", "draft"].some((k) => s.includes(k)))
		return "warning";
	if (["cancel", "void", "anulad", "expired", "riesgo"].some((k) => s.includes(k)))
		return "danger";
	return "neutral";
};
