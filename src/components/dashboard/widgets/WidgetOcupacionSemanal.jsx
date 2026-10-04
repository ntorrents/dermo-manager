import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import { toLocalYmd } from "../../../utils/dateUtils";

function startOfWeekMonday(d = new Date()) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	const day = x.getDay(); // 0 Sun
	const diff = day === 0 ? -6 : 1 - day;
	x.setDate(x.getDate() + diff);
	return x;
}

function addDays(d, n) {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

function countClinicalAppointments(appointments, from, to) {
	const fromYmd = toLocalYmd(from);
	const toYmd = toLocalYmd(to);
	return (appointments || []).filter((a) => {
		if (a.type === "tax_deadline" || a.type === "task") return false;
		if (a.status === "cancelled") return false;
		if (a.activo === false) return false;
		const day = a.start_at ? toLocalYmd(a.start_at) : "";
		return day && day >= fromYmd && day <= toYmd;
	}).length;
}

/**
 * Termómetro de ritmo de citas: esta semana vs la anterior.
 */
export const WidgetOcupacionSemanal = ({ appointments = [] }) => {
	const stats = useMemo(() => {
		const weekStart = startOfWeekMonday(new Date());
		const weekEnd = addDays(weekStart, 6);
		const prevStart = addDays(weekStart, -7);
		const prevEnd = addDays(weekStart, -1);

		const thisWeek = countClinicalAppointments(appointments, weekStart, weekEnd);
		const lastWeek = countClinicalAppointments(appointments, prevStart, prevEnd);

		const target = Math.max(lastWeek, 1);
		const pct = Math.min(100, Math.round((thisWeek / target) * 100));

		let insight = "";
		if (lastWeek === 0 && thisWeek === 0) {
			insight = "Aún no hay citas registradas esta semana.";
		} else if (thisWeek < lastWeek) {
			const gap = lastWeek - thisWeek;
			insight = `Te faltan ${gap} cita${gap === 1 ? "" : "s"} para igualar la semana pasada.`;
		} else if (thisWeek === lastWeek) {
			insight = "Vas al mismo ritmo que la semana pasada.";
		} else {
			const ahead = thisWeek - lastWeek;
			insight = `Vas ${ahead} cita${ahead === 1 ? "" : "s"} por encima de la semana pasada.`;
		}

		return { thisWeek, lastWeek, pct, insight };
	}, [appointments]);

	return (
		<section className="h-full min-h-[240px] rounded-2xl border border-edge bg-surface p-5 shadow-sm flex flex-col">
			<div className="mb-5">
				<p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
					<Activity size={13} /> Ocupación semanal
				</p>
				<p className="text-sm text-muted mt-0.5">Ritmo de citas clínicas</p>
			</div>

			<div className="flex items-end justify-between gap-3 mb-3">
				<div>
					<p className="text-3xl font-semibold text-fg tabular-nums tracking-tight">
						{stats.pct}
						<span className="text-lg text-muted font-medium">%</span>
					</p>
					<p className="text-xs text-muted mt-1 tabular-nums">
						{stats.thisWeek} esta semana · {stats.lastWeek} la anterior
					</p>
				</div>
			</div>

			<div className="h-3 rounded-full bg-surface-2 overflow-hidden">
				<div
					className="h-full rounded-full bg-inverse transition-all duration-500"
					style={{ width: `${Math.max(stats.pct, stats.thisWeek > 0 ? 6 : 0)}%` }}
				/>
			</div>

			<p className="text-xs text-muted mt-4 leading-snug flex-1">
				{stats.insight}
			</p>
		</section>
	);
};
