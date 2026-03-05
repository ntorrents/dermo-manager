import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, CalendarDays } from "lucide-react";

export const WidgetProximosEventos = ({
	upcomingAppointments = [],
	clients = [],
}) => (
	<div className="h-full min-h-[200px] bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
		<h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
			<CalendarDays className="text-blue-500" size={20} /> Próximos eventos
		</h3>
		{upcomingAppointments.length > 0 ? (
			<div className="space-y-2">
				{upcomingAppointments.map((a) => {
					const start = a.start_at ? new Date(a.start_at) : null;
					const client = clients?.find((c) => c.id === a.client_id);
					const title =
						a.title ||
						(client ? `${client.name} ${client.surname || ""}`.trim() : "Cita");
					return (
						<div
							key={a.id}
							className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
							<div className="text-center shrink-0 w-10">
								<span className="block text-xs font-bold text-blue-600 uppercase leading-tight">
									{start ? format(start, "dd", { locale: es }) : "—"}
								</span>
								<span className="block text-[10px] text-gray-400 font-medium">
									{start ? format(start, "MMM", { locale: es }) : ""}
								</span>
							</div>
							<p
								className="text-sm font-bold text-gray-800 truncate flex-1"
								title={title}>
								{title}
							</p>
						</div>
					);
				})}
			</div>
		) : (
			<div className="flex flex-col items-center justify-center py-6 text-gray-400">
				<Calendar size={32} className="mb-2 opacity-50" />
				<p className="text-sm font-medium">Sin citas próximas</p>
			</div>
		)}
	</div>
);
