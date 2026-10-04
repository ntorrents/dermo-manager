import React from "react";
import {
	AlertTriangle,
	CalendarDays,
	CheckCircle,
	Package,
} from "lucide-react";

export const DashboardUnifiedAlerts = ({
	appointmentsToday = [],
	lowStockItems = [],
	expiredStockItems = [],
	clients = [],
	onGoCalendar,
	onGoInventory,
}) => {
	const stockAlerts = lowStockItems.length > 0 || expiredStockItems.length > 0;
	const hasAlerts = appointmentsToday.length > 0 || stockAlerts;

	const clientName = (clientId) => {
		const c = clients.find((x) => x.id === clientId);
		if (!c) return "Cliente";
		return `${c.name || ""} ${c.surname || ""}`.trim() || "Cliente";
	};

	return (
		<div
			className={`p-4 rounded-2xl shadow-sm border h-auto min-h-0 ${
				hasAlerts
					? "bg-warning-bg border-warning-border"
					: "bg-surface-2 border-edge"
			}`}>
			<div className="flex items-start gap-3 w-full">
				<div
					className={`p-2 rounded-lg shrink-0 ${
						hasAlerts
							? "bg-warning-bg text-warning-icon ring-1 ring-warning-border"
							: "bg-surface text-muted ring-1 ring-edge"
					}`}>
					{hasAlerts ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
				</div>
				<div className="min-w-0 flex-1 space-y-3">
					<h4
						className={`font-bold text-sm ${
							hasAlerts ? "text-warning-text" : "text-muted"
						}`}>
						Alertas del día
					</h4>

					{!hasAlerts && (
						<p className="text-sm text-muted">
							Sin citas hoy ni alertas de stock.
						</p>
					)}

					{appointmentsToday.length > 0 && (
						<div>
							<p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1 mb-1">
								<CalendarDays size={12} /> Citas hoy ({appointmentsToday.length})
							</p>
							<ul className="text-sm text-fg space-y-0.5">
								{appointmentsToday.slice(0, 4).map((a) => {
									const time = a.start_at
										? new Date(a.start_at).toLocaleTimeString("es-ES", {
												hour: "2-digit",
												minute: "2-digit",
											})
										: "";
									return (
										<li key={a.id} className="font-medium truncate">
											{time && `${time} · `}
											{clientName(a.client_id)}
										</li>
									);
								})}
							</ul>
							{onGoCalendar && (
								<button
									type="button"
									onClick={onGoCalendar}
									className="text-xs font-bold text-primary mt-1 hover:underline">
									Ver agenda
								</button>
							)}
						</div>
					)}

					{stockAlerts && (
						<div>
							<p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1 mb-1">
								<Package size={12} /> Stock
							</p>
							{lowStockItems.length > 0 && (
								<p className="text-sm text-danger">
									<strong>Bajo:</strong>{" "}
									{lowStockItems.map((i) => i.name).join(", ")}
									{lowStockItems.length > 3 &&
										` (+${lowStockItems.length - 3})`}
								</p>
							)}
							{expiredStockItems.length > 0 && (
								<p className="text-sm text-danger mt-0.5">
									<strong>Caducados:</strong>{" "}
									{expiredStockItems.map((i) => i.name).join(", ")}
									{expiredStockItems.length > 3 &&
										` (+${expiredStockItems.length - 3})`}
								</p>
							)}
							{onGoInventory && (
								<button
									type="button"
									onClick={onGoInventory}
									className="text-xs font-bold text-primary mt-1 hover:underline">
									Ver stock
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
