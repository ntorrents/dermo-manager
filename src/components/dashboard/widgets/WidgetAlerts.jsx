import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

export const WidgetAlerts = ({ lowStockItems = [], expiredStockItems = [] }) => {
	const hasAlerts = lowStockItems.length > 0 || expiredStockItems.length > 0;
	return (
		<div
			className={`p-4 rounded-2xl shadow-sm border h-auto min-h-0 flex items-center ${
				hasAlerts
					? "bg-red-50 border-red-100 animate-in slide-in-from-top-2"
					: "bg-gray-50 border-gray-100"
			}`}>
			<div className="flex items-start gap-4 w-full">
				<div
					className={`p-2 rounded-lg shrink-0 ${
						hasAlerts ? "bg-red-100 text-red-600" : "bg-gray-200 text-gray-500"
					}`}>
					{hasAlerts ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
				</div>
				<div className="min-w-0 flex-1">
					<h4 className={`font-bold ${hasAlerts ? "text-red-800" : "text-gray-600"}`}>
						Alertas de stock
					</h4>
					{hasAlerts ? (
						<>
							{lowStockItems.length > 0 && (
								<p className="text-sm text-red-700 mt-1">
									<strong>Stock bajo:</strong>{" "}
									{lowStockItems.map((i) => i.name).join(", ")}
									{lowStockItems.length > 3 && ` (+${lowStockItems.length - 3})`}
								</p>
							)}
							{expiredStockItems.length > 0 && (
								<p className="text-sm text-red-700 mt-1">
									<strong>Con lotes caducados:</strong>{" "}
									{expiredStockItems.map((i) => i.name).join(", ")}
									{expiredStockItems.length > 3 && ` (+${expiredStockItems.length - 3})`}
								</p>
							)}
						</>
					) : (
						<p className="text-sm text-gray-500 mt-1">Sin alertas de stock</p>
					)}
				</div>
			</div>
		</div>
	);
};
