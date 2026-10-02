import React from "react";

/**
 * Empty state con Goal Gradient: siempre ofrece CTA (y atajo opcional).
 */
export const EmptyState = ({
	icon: Icon,
	title,
	description,
	actionLabel,
	onAction,
	shortcutHint,
}) => (
	<div className="flex flex-col items-center justify-center py-16 px-6 text-center">
		{Icon && (
			<div className="w-14 h-14 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center mb-5 text-slate-400">
				<Icon size={28} strokeWidth={1.5} />
			</div>
		)}
		<h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
		{description && (
			<p className="text-sm text-slate-500 mb-5 max-w-sm leading-relaxed">{description}</p>
		)}
		{actionLabel && onAction ? (
			<button
				type="button"
				onClick={onAction}
				className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 transition-colors active:scale-[0.98]">
				{actionLabel}
			</button>
		) : null}
		{(shortcutHint || (actionLabel && onAction)) && (
			<p className="mt-3 text-xs text-slate-400">
				{shortcutHint || "Empieza por el primer registro — el resto fluye solo."}
			</p>
		)}
	</div>
);
