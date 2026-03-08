import React from "react";
import { Users, User } from "lucide-react";

/** topClients: array de { clientId, name, count } ordenado por count desc */
export const WidgetTopClientes = ({ topClients = [] }) => (
	<div className="h-full min-h-[280px] bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
		<h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
			<Users className="text-indigo-500" size={20} /> Top clientes
		</h3>
		{topClients.length > 0 ? (
			<div className="space-y-3">
				{topClients.slice(0, 5).map((c, index) => (
					<div
						key={c.clientId}
						className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">
								{index + 1}
							</span>
							<span className="text-sm font-medium text-gray-800 truncate">
								{c.name}
							</span>
						</div>
						<span className="text-xs font-bold text-gray-500 shrink-0">
							{c.count} sesiones
						</span>
					</div>
				))}
			</div>
		) : (
			<div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 min-h-[200px]">
				<User size={40} className="mb-2" />
				<p className="text-sm text-center">Sin datos de clientes</p>
			</div>
		)}
	</div>
);
