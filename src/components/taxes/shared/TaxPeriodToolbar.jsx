import React from "react";

export const TaxPeriodToolbar = ({
	year,
	setYear,
	quarter,
	setQuarter,
	showQuarter = true,
	yearsCount = 5,
}) => {
	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: yearsCount }, (_, i) => currentYear - i);

	return (
		<div className="flex flex-wrap gap-3 items-end">
			<label className="block">
				<span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
					Ejercicio
				</span>
				<select
					className="mt-1 block w-full min-w-[120px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-rose-300"
					value={year}
					onChange={(e) => setYear(Number(e.target.value))}>
					{years.map((y) => (
						<option key={y} value={y}>
							{y}
						</option>
					))}
				</select>
			</label>
			{showQuarter && (
				<label className="block">
					<span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						Trimestre
					</span>
					<select
						className="mt-1 block w-full min-w-[120px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-rose-300"
						value={quarter}
						onChange={(e) => setQuarter(Number(e.target.value))}>
						<option value={1}>T1 · Ene–Mar</option>
						<option value={2}>T2 · Abr–Jun</option>
						<option value={3}>T3 · Jul–Sep</option>
						<option value={4}>T4 · Oct–Dic</option>
					</select>
				</label>
			)}
		</div>
	);
};
