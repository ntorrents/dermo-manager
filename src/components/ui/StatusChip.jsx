import React from "react";

const DOT = {
	success: "bg-success",
	warning: "bg-warning",
	danger: "bg-danger",
	neutral: "bg-muted",
	info: "bg-primary",
};

const FRAME = {
	success: "border-success/40 text-success",
	warning: "border-warning/40 text-warning",
	danger: "border-danger/40 text-danger",
	neutral: "border-edge text-muted",
	info: "border-primary/40 text-primary",
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
	if (["paid", "pagada", "completed", "completado", "confirmada", "activo", "ok", "sent", "enviad"].some((k) => s.includes(k)))
		return "success";
	if (["pending", "pendiente", "borrador", "draft", "queued", "encolad"].some((k) => s.includes(k)))
		return "warning";
	if (["cancel", "void", "anulad", "expired", "riesgo", "agotado", "bloqueado", "failed", "fallid"].some((k) => s.includes(k)))
		return "danger";
	return "neutral";
};
