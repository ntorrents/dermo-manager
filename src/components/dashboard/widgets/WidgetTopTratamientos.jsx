import React from "react";
import { Award, Package } from "lucide-react";

export const WidgetTopTratamientos = ({ topTreatments = [] }) => (
	<div className="h-full min-h-[280px] bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
		<h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
			<Award className="text-yellow-500" size={20} /> Top Tratamientos
		</h3>
		{topTreatments.length > 0 ? (
			<div className="space-y-4">
				{(() => {
					const maxCount = Math.max(...topTreatments.map((t) => t.count), 1);
					return topTreatments.map((t, index) => (
						<div key={t.name} className="space-y-1">
							<div className="flex justify-between text-xs font-bold text-gray-600">
								<span className="truncate pr-2">{t.name}</span>
								<span>{t.count} sesiones</span>
							</div>
							<div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
								<div
									className={`h-full rounded-lg transition-all ${
										index === 0
											? "bg-rose-500"
											: index === 1
												? "bg-rose-400"
												: index === 2
													? "bg-rose-300"
													: "bg-rose-200"
									}`}
									style={{ width: `${(t.count / maxCount) * 100}%` }}
								/>
							</div>
						</div>
					));
				})()}
			</div>
		) : (
			<div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 min-h-[200px]">
				<Package size={40} className="mb-2" />
				<p className="text-sm text-center">Sin datos suficientes</p>
			</div>
		)}
	</div>
);
