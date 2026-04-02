import React from "react";
import { Calendar } from "lucide-react";

const PRESETS = [
	{ id: "month", label: "Mensual" },
	{ id: "quarter", label: "Trimestral" },
	{ id: "calendar_year", label: "Este año" },
	{ id: "rolling_12", label: "Anual (12 meses)" },
	{ id: "custom", label: "Personalizado" },
];

/**
 * Barra de periodo para dashboard / finanzas.
 * anchorYm: YYYY-MM (mes de referencia cuando no es custom)
 */
export const ReportingPeriodToolbar = ({
	preset,
	onPresetChange,
	anchorYm,
	onAnchorYmChange,
	customFrom,
	customTo,
	onCustomFromChange,
	onCustomToChange,
	rangeLabel,
	compact = false,
}) => {
	return (
		<div
			className={`flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:flex-wrap sm:items-center"} bg-white p-2 rounded-xl shadow-sm border border-gray-100`}>
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative shrink-0">
					<Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
					<select
						value={preset}
						onChange={(e) => onPresetChange(e.target.value)}
						className="pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-xs sm:text-sm font-bold text-gray-800 outline-none hover:bg-gray-100 border-0 cursor-pointer min-w-[9rem]">
						{PRESETS.map((p) => (
							<option key={p.id} value={p.id}>
								{p.label}
							</option>
						))}
					</select>
				</div>
				{preset !== "rolling_12" && preset !== "custom" && preset !== "calendar_year" && (
					<input
						type="month"
						value={anchorYm}
						onChange={(e) => onAnchorYmChange(e.target.value)}
						className="py-2 px-3 bg-gray-50 rounded-lg text-xs sm:text-sm font-bold text-gray-800 outline-none hover:bg-gray-100 border-0 cursor-pointer"
					/>
				)}
				{preset === "calendar_year" && (
					<input
						type="number"
						min={2018}
						max={2100}
						value={Number(anchorYm?.slice(0, 4)) || new Date().getFullYear()}
						onChange={(e) => {
							const yr = String(
								Math.max(2018, Math.min(2100, Number(e.target.value) || new Date().getFullYear())),
							);
							onAnchorYmChange(`${yr}-01`);
						}}
						className="w-24 py-2 px-3 bg-gray-50 rounded-lg text-sm font-bold text-gray-800 outline-none border-0 tabular-nums"
					/>
				)}
				{preset === "custom" && (
					<div className="flex flex-wrap items-center gap-2">
						<label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Desde</label>
						<input
							type="date"
							value={customFrom}
							onChange={(e) => onCustomFromChange(e.target.value)}
							className="py-2 px-2 bg-gray-50 rounded-lg text-xs sm:text-sm font-bold text-gray-800 border-0"
						/>
						<label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Hasta</label>
						<input
							type="date"
							value={customTo}
							onChange={(e) => onCustomToChange(e.target.value)}
							className="py-2 px-2 bg-gray-50 rounded-lg text-xs sm:text-sm font-bold text-gray-800 border-0"
						/>
					</div>
				)}
			</div>
			{rangeLabel && (
				<p className="text-xs text-gray-500 font-medium sm:ml-auto sm:text-right w-full sm:w-auto truncate" title={rangeLabel}>
					<span className="text-gray-400 font-bold uppercase tracking-wide text-[10px] mr-1">Periodo:</span>
					{rangeLabel}
				</p>
			)}
		</div>
	);
};
