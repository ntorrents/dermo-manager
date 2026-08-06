import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, CalendarDays, CalendarRange, Clock } from "lucide-react";

const PRESETS = [
	{ id: "month", label: "Mensual", icon: <CalendarDays size={16} /> },
	{ id: "quarter", label: "Trimestral", icon: <CalendarDays size={16} /> },
	{ id: "calendar_year", label: "Este año", icon: <CalendarDays size={16} /> },
	{ id: "rolling_12", label: "Últimos 12 meses", icon: <Clock size={16} /> },
	{ id: "custom", label: "Personalizado", icon: <CalendarRange size={16} /> },
];

const MONTHS_ES = [
	{ v: 1, l: "Enero" }, { v: 2, l: "Febrero" }, { v: 3, l: "Marzo" },
	{ v: 4, l: "Abril" }, { v: 5, l: "Mayo" }, { v: 6, l: "Junio" },
	{ v: 7, l: "Julio" }, { v: 8, l: "Agosto" }, { v: 9, l: "Septiembre" },
	{ v: 10, l: "Octubre" }, { v: 11, l: "Noviembre" }, { v: 12, l: "Diciembre" },
];

function parseAnchorYm(anchorYm) {
	const parts = (anchorYm || "").split("-").map(Number);
	const now = new Date();
	const y = parts[0] && !Number.isNaN(parts[0]) ? parts[0] : now.getFullYear();
	const m = parts[1] && !Number.isNaN(parts[1]) ? parts[1] : now.getMonth() + 1;
	return { y: Math.max(2018, Math.min(2100, y)), m: Math.max(1, Math.min(12, m)) };
}

function yearOptions() {
	const cy = new Date().getFullYear();
	const out = [];
	for (let yr = cy + 1; yr >= 2018; yr--) out.push(yr);
	return out;
}

export const GlobalDateFilter = ({
	preset,
	onPresetChange,
	anchorYm,
	onAnchorYmChange,
	customFrom,
	customTo,
	onCustomFromChange,
	onCustomToChange,
	rangeLabel,
	onTodayClick,
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const { y, m } = useMemo(() => parseAnchorYm(anchorYm), [anchorYm]);
	const years = useMemo(() => yearOptions(), []);

	const pad = (n) => String(n).padStart(2, "0");
	const commitYm = (nextY, nextM) => onAnchorYmChange(`${nextY}-${pad(nextM)}`);
	const close = () => setOpen(false);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e) => {
			if (!rootRef.current?.contains(e.target)) close();
		};
		const onKey = (e) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const handlePresetChange = (v) => {
		onPresetChange(v);
		if (v === "rolling_12") close();
	};

	const primaryText = rangeLabel || "Seleccionar periodo";

	return (
		<div ref={rootRef} className="relative z-50">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 ${
					open 
						? "bg-rose-50 border-rose-200 text-rose-700 shadow-sm" 
						: "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
				}`}>
				<Calendar size={16} className={open ? "text-rose-700" : "text-gray-400"} />
				<span className="max-w-[120px] sm:max-w-[180px] truncate">{primaryText}</span>
				<ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180 text-rose-700" : "text-gray-400"}`} />
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-80 sm:w-[26rem] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl animate-in slide-in-from-top-2 fade-in duration-200">
					<div className="flex gap-2">
						{/* Columna Izquierda: Presets */}
						<div className="flex w-2/5 flex-col gap-1 border-r border-gray-100 pr-2">
							{PRESETS.map(p => (
								<button
									key={p.id}
									onClick={() => handlePresetChange(p.id)}
									className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors text-left ${
										preset === p.id 
											? "bg-rose-50 text-rose-700 font-bold" 
											: "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
									}`}>
									<div className={preset === p.id ? "text-rose-700" : "text-gray-400"}>{p.icon}</div>
									<span className="truncate">{p.label}</span>
								</button>
							))}
							{onTodayClick && (
								<button
									onClick={() => { onTodayClick(); close(); }}
									className="mt-auto flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100">
									Ir a mes actual
								</button>
							)}
						</div>
						
						{/* Columna Derecha: Controles */}
						<div className="flex w-3/5 flex-col p-2 space-y-4">
							{preset === "month" || preset === "quarter" ? (
								<div className="space-y-3">
									<div>
										<label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Mes de referencia</label>
										<select
											value={m}
											onChange={(e) => commitYm(y, Number(e.target.value))}
											className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-semibold outline-none focus:border-rose-300 focus:bg-white transition-colors cursor-pointer">
											{MONTHS_ES.map(mo => <option key={mo.v} value={mo.v}>{mo.l}</option>)}
										</select>
									</div>
									<div>
										<label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Año</label>
										<select
											value={y}
											onChange={(e) => commitYm(Number(e.target.value), m)}
											className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-semibold outline-none focus:border-rose-300 focus:bg-white transition-colors cursor-pointer">
											{years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
										</select>
									</div>
								</div>
							) : null}

							{preset === "calendar_year" ? (
								<div>
									<label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Año natural</label>
									<select
										value={y}
										onChange={(e) => commitYm(Number(e.target.value), 1)}
										className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-semibold outline-none focus:border-rose-300 focus:bg-white transition-colors cursor-pointer">
										{years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
									</select>
								</div>
							) : null}

							{preset === "custom" ? (
								<div className="space-y-3">
									<div>
										<label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Desde</label>
										<input
											type="date"
											value={customFrom}
											onChange={(e) => { onCustomFromChange(e.target.value); if(e.target.value && customTo) close(); }}
											className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-semibold outline-none focus:border-rose-300 focus:bg-white transition-colors"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Hasta</label>
										<input
											type="date"
											value={customTo}
											onChange={(e) => { onCustomToChange(e.target.value); if(customFrom && e.target.value) close(); }}
											className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-semibold outline-none focus:border-rose-300 focus:bg-white transition-colors"
										/>
									</div>
								</div>
							) : null}

							{preset === "rolling_12" ? (
								<div className="h-full flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-100">
									<p className="text-xs text-center text-slate-500 font-medium leading-relaxed">
										Mostrando una ventana móvil de 12 meses respecto al día de hoy.
									</p>
								</div>
							) : null}

							<div className="pt-2 mt-auto">
								<button onClick={close} className="w-full py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors">
									Aplicar
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
