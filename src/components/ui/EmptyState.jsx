import React from "react";

export const EmptyState = ({
	icon: Icon,
	title,
	description,
	actionLabel,
	onAction,
}) => (
	<div className="flex flex-col items-center justify-center py-16 px-6 text-center">
		{Icon && (
			<div className="w-20 h-20 rounded-2xl bg-rose-50 flex items-center justify-center mb-6 text-rose-400">
				<Icon size={40} strokeWidth={1.5} />
			</div>
		)}
		<h3 className="text-lg font-black text-gray-800 mb-2">{title}</h3>
		{description && (
			<p className="text-sm text-gray-500 mb-6 max-w-xs">{description}</p>
		)}
		{actionLabel && onAction && (
			<button
				onClick={onAction}
				className="bg-primary hover:bg-primary-hover text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95">
				{actionLabel}
			</button>
		)}
	</div>
);
