/* eslint-disable no-unused-vars */
// /Users/nilto/Documents/GitHub/DermoManager/src/components/dashboard/StatCard.jsx
import React from "react";

export const StatCard = ({ title, value, subtext, gradient, icon: Icon }) => (
	<div
		className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
		<div className="relative z-10">
			<div className="flex justify-between items-start mb-2">
				<div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
					<Icon size={20} className="text-white" />
				</div>
				<span className="text-xs font-bold uppercase tracking-wider opacity-80">
					{title}
				</span>
			</div>
			<h3 className="text-2xl font-bold tracking-tight">{value}</h3>
			{subtext && (
				<p className="text-white/80 text-xs mt-1 font-medium">{subtext}</p>
			)}
		</div>
		<div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
	</div>
);
