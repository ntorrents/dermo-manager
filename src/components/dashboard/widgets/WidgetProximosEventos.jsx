import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "lucide-react";

export const WidgetProximosEventos = ({
	upcomingAppointments = [],
	clients = [],
}) => (
	<div className="h-full min-h-[16rem] md:min-h-full rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 flex flex-col shadow-sm">
		<div className="flex items-center justify-between gap-2 mb-4">
			<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
				Próximos eventos
			</p>
			<span className="text-[11px] font-medium text-slate-400 tabular-nums">
				{upcomingAppointments.length}
			</span>
		</div>
		{upcomingAppointments.length > 0 ? (
			<ul className="space-y-0.5 flex-1 overflow-y-auto custom-scrollbar -mx-1 px-1">
				{upcomingAppointments.map((a) => {
					const start = a.start_at ? new Date(a.start_at) : null;
					const client = clients?.find((c) => c.id === a.client_id);
					const title =
						a.title ||
						(client ? `${client.name} ${client.surname || ""}`.trim() : "Cita");
					return (
						<li
							key={a.id}
							className="flex items-center gap-3 py-2.5 border-b border-slate-100/80 last:border-0">
							<div className="text-center shrink-0 w-10">
								<span className="block text-sm font-semibold text-slate-900 tabular-nums leading-none">
									{start ? format(start, "dd", { locale: es }) : "—"}
								</span>
								<span className="block text-[10px] text-slate-400 font-medium uppercase mt-0.5">
									{start ? format(start, "MMM", { locale: es }) : ""}
								</span>
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-slate-900 truncate" title={title}>
									{title}
								</p>
								{start && (
									<p className="text-[11px] text-slate-400 tabular-nums">
										{format(start, "HH:mm", { locale: es })}
									</p>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		) : (
			<div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400">
				<Calendar size={28} strokeWidth={1.5} className="mb-3 opacity-50" />
				<p className="text-sm font-medium text-slate-600">Sin citas próximas</p>
				<p className="text-xs mt-1 text-slate-400">⌘K → Nueva cita rápida</p>
			</div>
		)}
	</div>
);
