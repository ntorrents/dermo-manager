import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Calendar, Package, AlertTriangle, ChevronRight } from "lucide-react";
import { getLowStockItems, getItemsWithExpiredBatches } from "../../utils/calculations";

function formatApptWhen(iso) {
	if (!iso) return "";
	try {
		return new Date(iso).toLocaleString("es-ES", {
			weekday: "short",
			day: "numeric",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

export const AlertsMenu = ({
	appointments = [],
	inventory = [],
	batches = [],
	setActiveTab,
	horizonHours = 72,
	maxItems = 12,
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);

	const { upcoming, lowStock, expired } = useMemo(() => {
		const now = new Date();
		const limit = new Date(now.getTime() + horizonHours * 3600 * 1000);
		const upcomingAppts = (appointments || [])
			.filter((a) => {
				if (a.status === "cancelled") return false;
				const s = a.start_at ? new Date(a.start_at) : null;
				return s && s >= now && s <= limit;
			})
			.sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
			.slice(0, 8);
		const low = getLowStockItems(inventory, 5).slice(0, 5);
		const exp = getItemsWithExpiredBatches(inventory, batches).slice(0, 5);
		return { upcoming: upcomingAppts, lowStock: low, expired: exp };
	}, [appointments, inventory, batches, horizonHours]);

	const count = upcoming.length + lowStock.length + expired.length;

	useEffect(() => {
		function onDoc(e) {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	return (
		<div className="relative shrink-0" ref={rootRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
				title="Alertas"
				aria-label="Alertas">
				<Bell size={20} />
				{count > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
						{count > 9 ? "9+" : count}
					</span>
				)}
			</button>
			{open && (
				<div className="absolute right-0 top-full z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden">
					<div className="border-b border-gray-100 px-4 py-2.5 bg-gray-50/80">
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500">Alertas</p>
						<p className="text-[11px] text-gray-400 mt-0.5">
							Próximas citas ({horizonHours}h), stock y caducidades
						</p>
					</div>
					<div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-gray-50">
						{count === 0 ? (
							<p className="px-4 py-8 text-center text-sm text-gray-400">Todo tranquilo por aquí.</p>
						) : (
							<>
								{upcoming.length > 0 && (
									<div className="px-3 py-2">
										<p className="text-[10px] font-black text-gray-400 uppercase px-1 mb-1 flex items-center gap-1">
											<Calendar size={12} className="text-blue-500" /> Citas próximas
										</p>
										<ul className="space-y-1">
											{upcoming.map((a) => (
												<li key={a.id}>
													<button
														type="button"
														onClick={() => {
															setOpen(false);
															setActiveTab("calendar");
														}}
														className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors">
														<p className="text-xs font-semibold text-gray-800 line-clamp-2">
															{a.title || a.notes || "Cita"}
														</p>
														<p className="text-[10px] text-blue-600 mt-0.5">
															{formatApptWhen(a.start_at)}
														</p>
													</button>
												</li>
											))}
										</ul>
									</div>
								)}
								{lowStock.length > 0 && (
									<div className="px-3 py-2">
										<p className="text-[10px] font-black text-gray-400 uppercase px-1 mb-1 flex items-center gap-1">
											<Package size={12} className="text-amber-500" /> Stock bajo
										</p>
										<ul className="space-y-1">
											{lowStock.map((i) => (
												<li key={i.id}>
													<button
														type="button"
														onClick={() => {
															setOpen(false);
															setActiveTab("inventory");
														}}
														className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors flex justify-between gap-2">
														<span className="text-xs font-medium text-gray-800 truncate">{i.name}</span>
														<span className="text-[10px] font-bold text-amber-700 shrink-0">
															{Number(i.stock)} / mín {Number(i.min_stock ?? 5)}
														</span>
													</button>
												</li>
											))}
										</ul>
									</div>
								)}
								{expired.length > 0 && (
									<div className="px-3 py-2">
										<p className="text-[10px] font-black text-gray-400 uppercase px-1 mb-1 flex items-center gap-1">
											<AlertTriangle size={12} className="text-red-500" /> Lotes caducados
										</p>
										<ul className="space-y-1">
											{expired.map((i) => (
												<li key={i.id}>
													<button
														type="button"
														onClick={() => {
															setOpen(false);
															setActiveTab("inventory");
														}}
														className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-between gap-2">
														<span className="text-xs font-medium text-gray-800 truncate">{i.name}</span>
														<ChevronRight size={14} className="text-gray-300 shrink-0" />
													</button>
												</li>
											))}
										</ul>
									</div>
								)}
							</>
						)}
					</div>
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							setActiveTab("calendar");
						}}
						className="w-full border-t border-gray-100 px-4 py-2 text-center text-xs font-bold text-rose-600 hover:bg-rose-50">
						Ir a la agenda
					</button>
				</div>
			)}
		</div>
	);
};
