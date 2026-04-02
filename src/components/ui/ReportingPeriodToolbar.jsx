import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const PRESETS = [
	{ id: "month", label: "Mensual" },
	{ id: "quarter", label: "Trimestral" },
	{ id: "calendar_year", label: "Este año (calendario)" },
	{ id: "rolling_12", label: "Últimos 12 meses" },
	{ id: "custom", label: "Entre fechas" },
];

const MONTHS_ES = [
	{ v: 1, l: "Enero" },
	{ v: 2, l: "Febrero" },
	{ v: 3, l: "Marzo" },
	{ v: 4, l: "Abril" },
	{ v: 5, l: "Mayo" },
	{ v: 6, l: "Junio" },
	{ v: 7, l: "Julio" },
	{ v: 8, l: "Agosto" },
	{ v: 9, l: "Septiembre" },
	{ v: 10, l: "Octubre" },
	{ v: 11, l: "Noviembre" },
	{ v: 12, l: "Diciembre" },
];

function parseAnchorYm(anchorYm) {
	const parts = (anchorYm || "").split("-").map(Number);
	const now = new Date();
	const y = parts[0] && !Number.isNaN(parts[0]) ? parts[0] : now.getFullYear();
	const m = parts[1] && !Number.isNaN(parts[1]) ? parts[1] : now.getMonth() + 1;
	return {
		y: Math.max(2018, Math.min(2100, y)),
		m: Math.max(1, Math.min(12, m)),
	};
}

function yearOptions() {
	const cy = new Date().getFullYear();
	const out = [];
	for (let yr = cy + 1; yr >= 2018; yr--) out.push(yr);
	return out;
}

const selectClass =
	"w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-gray-900 shadow-sm outline-none transition-colors focus:border-rose-300 focus:ring-2 focus:ring-rose-100";

const labelClass = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400";

function presetLabel(id) {
	return PRESETS.find((p) => p.id === id)?.label ?? "";
}

/**
 * Periodo: fila compacta por defecto; el panel completo se abre bajo el botón y se cierra al elegir o al pinchar fuera.
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
	onTodayClick,
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const { y, m } = useMemo(() => parseAnchorYm(anchorYm), [anchorYm]);
	const years = useMemo(() => yearOptions(), []);

	const pad = (n) => String(n).padStart(2, "0");
	const commitYm = (nextY, nextM) => {
		onAnchorYmChange(`${nextY}-${pad(nextM)}`);
	};

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

	const handleCommitYm = (nextY, nextM) => {
		commitYm(nextY, nextM);
		close();
	};

	const handleYearOnly = (e) => {
		onAnchorYmChange(`${Number(e.target.value)}-01`);
		close();
	};

	const handleCustomFrom = (v) => {
		onCustomFromChange(v);
		if (v && customTo) close();
	};

	const handleCustomTo = (v) => {
		onCustomToChange(v);
		if (customFrom && v) close();
	};

	const handleToday = () => {
		onTodayClick?.();
		close();
	};

	const primaryText = rangeLabel || "Elegir periodo";
	const secondaryText = presetLabel(preset);

	return (
		<div ref={rootRef} className="relative w-full min-w-0 max-w-xl">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm outline-none transition-colors hover:border-gray-300 hover:bg-gray-50/80 focus-visible:ring-2 focus-visible:ring-rose-200">
				<Calendar className="size-[1.125rem] shrink-0 text-gray-500" aria-hidden />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-gray-900" title={primaryText}>
						{primaryText}
					</p>
					<p className="truncate text-[11px] font-medium text-gray-500" title={secondaryText}>
						{secondaryText}
					</p>
				</div>
				<ChevronDown
					className={`size-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>

			{open ? (
				<div
					role="dialog"
					aria-label="Selector de periodo de informes"
					className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
					<div className="space-y-4 p-3 sm:p-4">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
								{onTodayClick ? (
									<div className="sm:shrink-0">
										<span className={`${labelClass} invisible sm:mb-0 sm:block sm:h-4`} aria-hidden>
											·
										</span>
										<button
											type="button"
											onClick={handleToday}
											className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 sm:w-auto">
											Ir a mes actual
										</button>
									</div>
								) : null}

								<div className="min-w-0 flex-1 sm:min-w-[11rem] sm:max-w-[14rem]">
									<label className={labelClass} htmlFor="reporting-preset">
										Tipo de periodo
									</label>
									<select
										id="reporting-preset"
										value={preset}
										onChange={(e) => handlePresetChange(e.target.value)}
										className={selectClass}>
										{PRESETS.map((p) => (
											<option key={p.id} value={p.id}>
												{p.label}
											</option>
										))}
									</select>
								</div>
							</div>

							{preset === "month" || preset === "quarter" ? (
								<div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md lg:max-w-lg">
									<div className="min-w-0">
										<label className={labelClass} htmlFor="reporting-month">
											Mes de referencia
										</label>
										<select
											id="reporting-month"
											value={m}
											onChange={(e) => handleCommitYm(y, Number(e.target.value))}
											className={selectClass}>
											{MONTHS_ES.map((mo) => (
												<option key={mo.v} value={mo.v}>
													{mo.l}
												</option>
											))}
										</select>
									</div>
									<div className="min-w-0">
										<label className={labelClass} htmlFor="reporting-year">
											Año
										</label>
										<select
											id="reporting-year"
											value={y}
											onChange={(e) => handleCommitYm(Number(e.target.value), m)}
											className={selectClass}>
											{years.map((yr) => (
												<option key={yr} value={yr}>
													{yr}
												</option>
											))}
										</select>
									</div>
								</div>
							) : null}

							{preset === "calendar_year" ? (
								<div className="min-w-0 sm:max-w-[12rem]">
									<label className={labelClass} htmlFor="reporting-year-only">
										Año natural
									</label>
									<select
										id="reporting-year-only"
										value={y}
										onChange={handleYearOnly}
										className={selectClass}>
										{years.map((yr) => (
											<option key={yr} value={yr}>
												{yr}
											</option>
										))}
									</select>
								</div>
							) : null}

							{preset === "rolling_12" ? (
								<p className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-snug text-slate-700">
									Ventana móvil de ~12 meses respecto a la fecha de hoy (sin elegir mes ni año).
								</p>
							) : null}

							{preset === "custom" ? (
								<div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
									<div>
										<label className={labelClass} htmlFor="reporting-from">
											Desde
										</label>
										<input
											id="reporting-from"
											type="date"
											value={customFrom}
											onChange={(e) => handleCustomFrom(e.target.value)}
											className={selectClass}
										/>
									</div>
									<div>
										<label className={labelClass} htmlFor="reporting-to">
											Hasta
										</label>
										<input
											id="reporting-to"
											type="date"
											value={customTo}
											onChange={(e) => handleCustomTo(e.target.value)}
											className={selectClass}
										/>
									</div>
								</div>
							) : null}
						</div>

						{preset === "quarter" ? (
							<p className="text-xs text-gray-500">
								El trimestre (1–4) se calcula a partir del{" "}
								<strong className="text-gray-700">mes de referencia</strong> elegido arriba.
							</p>
						) : null}
					</div>

					{rangeLabel ? (
						<div className="border-t border-gray-100 bg-gray-50/90 px-3 py-3 sm:px-4">
							<p className="text-center text-sm text-gray-700 sm:text-left">
								<span className="text-xs font-bold uppercase tracking-wide text-gray-500">
									Resumen del periodo ·{" "}
								</span>
								<span className="font-semibold text-gray-900">{rangeLabel}</span>
							</p>
						</div>
					) : null}

					<div className="border-t border-gray-100 px-3 py-2 sm:px-4">
						<button
							type="button"
							onClick={close}
							className="w-full rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide text-gray-500 hover:bg-gray-50 hover:text-gray-700">
							Cerrar
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
};
