import React from "react";

const DOT = {
	success: "bg-emerald-500",
	warning: "bg-amber-500",
	danger: "bg-rose-500",
	neutral: "bg-slate-400",
	info: "bg-sky-500",
};

const FRAME = {
	success: "border-emerald-200/80 text-emerald-800",
	warning: "border-amber-200/80 text-amber-900",
	danger: "border-rose-200/80 text-rose-800",
	neutral: "border-slate-200 text-slate-600",
	info: "border-sky-200/80 text-sky-800",
};

/**
 * Chip outlined + dot semántico (sin fondos sólidos).
 * tone: success | warning | danger | neutral | info
 */
export const StatusChip = ({ children, tone = "neutral", className = "", ...rest }) => (
	<span
		{...rest}
		className={`inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${FRAME[tone] || FRAME.neutral} ${className}`}>
		<span
			aria-hidden
			className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[tone] || DOT.neutral}`}
		/>
		{children}
	</span>
);

export const statusToneFromLabel = (raw = "") => {
	const s = String(raw).toLowerCase();
	if (["paid", "pagada", "completed", "completado", "confirmada", "activo", "ok"].some((k) => s.includes(k)))
		return "success";
	if (["pending", "pendiente", "borrador", "draft"].some((k) => s.includes(k)))
		return "warning";
	if (["cancel", "void", "anulad", "expired", "riesgo", "agotado", "bloqueado"].some((k) => s.includes(k)))
		return "danger";
	return "neutral";
};
