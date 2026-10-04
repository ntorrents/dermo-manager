import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	FlaskConical,
	Loader2,
	Search,
	Users,
	CalendarDays,
	Package,
	Filter,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useTenant } from "../../context/TenantContext";
import { useInventory } from "../../hooks/useInventory";
import { useInventoryBatches } from "../../hooks/useInventoryBatches";
import { formatDate } from "../../utils/format";
import { getReportingRange } from "../../utils/dateUtils";
import { EmptyState } from "../ui/EmptyState";
import { StatusChip } from "../ui/StatusChip";
import { GlobalDateFilter } from "../layout/GlobalDateFilter";
import { QUERY_STALE } from "../../providers/queryStale";

export const TraceabilityTab = ({
	user,
	reportingRange,
	reportingPreset = "month",
	reportingAnchorYm,
	reportingCustomFrom,
	reportingCustomTo,
}) => {
	const { clinicId } = useTenant();
	const { inventory = [], loading: invLoading } = useInventory(user);
	const { batches = [] } = useInventoryBatches(user?.id);
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");

	const [followGlobal, setFollowGlobal] = useState(true);
	const [preset, setPreset] = useState(reportingPreset);
	const [anchorYm, setAnchorYm] = useState(
		reportingAnchorYm || new Date().toISOString().slice(0, 7),
	);
	const [customFrom, setCustomFrom] = useState(
		reportingCustomFrom || new Date().toISOString().slice(0, 10),
	);
	const [customTo, setCustomTo] = useState(
		reportingCustomTo || new Date().toISOString().slice(0, 10),
	);

	useEffect(() => {
		if (!followGlobal) return;
		setPreset(reportingPreset);
		if (reportingAnchorYm) setAnchorYm(reportingAnchorYm);
		if (reportingCustomFrom) setCustomFrom(reportingCustomFrom);
		if (reportingCustomTo) setCustomTo(reportingCustomTo);
	}, [
		followGlobal,
		reportingPreset,
		reportingAnchorYm,
		reportingCustomFrom,
		reportingCustomTo,
	]);

	const localRange = useMemo(
		() => getReportingRange(preset, anchorYm, customFrom, customTo),
		[preset, anchorYm, customFrom, customTo],
	);

	const dateFrom = followGlobal
		? reportingRange?.start || localRange?.start || ""
		: localRange?.start || "";
	const dateTo = followGlobal
		? reportingRange?.end || localRange?.end || ""
		: localRange?.end || "";
	const rangeLabel = followGlobal
		? reportingRange?.label || localRange?.label
		: localRange?.label;

	const adoptGlobalThen = useCallback(
		(fn) => {
			setFollowGlobal(false);
			setPreset(reportingPreset);
			if (reportingAnchorYm) setAnchorYm(reportingAnchorYm);
			if (reportingCustomFrom) setCustomFrom(reportingCustomFrom);
			if (reportingCustomTo) setCustomTo(reportingCustomTo);
			fn?.();
		},
		[
			reportingPreset,
			reportingAnchorYm,
			reportingCustomFrom,
			reportingCustomTo,
		],
	);

	const goLocalToday = useCallback(() => {
		const d = new Date();
		const ym = d.toISOString().slice(0, 7);
		const ymd = d.toISOString().slice(0, 10);
		setFollowGlobal(false);
		setPreset("month");
		setAnchorYm(ym);
		setCustomFrom(ymd);
		setCustomTo(ymd);
	}, []);

	const materials = useMemo(
		() =>
			(inventory || []).filter((i) => (i.item_type || "material") === "material"),
		[inventory],
	);

	const filteredMaterials = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return materials;
		return materials.filter((m) => m.name.toLowerCase().includes(q));
	}, [materials, search]);

	const selected = materials.find((m) => m.id === selectedId) || null;

	const { data: movements = [], isLoading: movLoading } = useQuery({
		queryKey: [
			"stock_movements",
			clinicId,
			selectedId,
			dateFrom,
			dateTo,
			typeFilter,
		],
		queryFn: async () => {
			let q = supabase
				.from("inventory_stock_movements")
				.select(
					"id, inventory_id, batch_id, movement_type, quantity, reason, client_id, occurred_at, created_at, metadata, finance_entry_id",
				)
				.eq("clinic_id", clinicId)
				.eq("inventory_id", selectedId)
				.order("occurred_at", { ascending: false })
				.order("created_at", { ascending: false })
				.limit(400);
			if (dateFrom) q = q.gte("occurred_at", dateFrom);
			if (dateTo) q = q.lte("occurred_at", dateTo);
			if (typeFilter !== "all") q = q.eq("movement_type", typeFilter);
			const { data, error } = await q;
			if (error) throw error;
			return data || [];
		},
		enabled: !!clinicId && !!selectedId,
		staleTime: QUERY_STALE.operational,
	});

	const clientIds = useMemo(
		() => [...new Set(movements.map((m) => m.client_id).filter(Boolean))],
		[movements],
	);

	const { data: clients = [] } = useQuery({
		queryKey: ["trace_clients", clinicId, clientIds.join("|")],
		queryFn: async () => {
			if (!clientIds.length) return [];
			const { data, error } = await supabase
				.from("clients")
				.select("id, name, surname")
				.in("id", clientIds);
			if (error) throw error;
			return data || [];
		},
		enabled: !!clinicId && clientIds.length > 0,
		staleTime: QUERY_STALE.operational,
	});

	const clientById = useMemo(
		() => Object.fromEntries(clients.map((c) => [c.id, c])),
		[clients],
	);

	const itemBatches = useMemo(
		() => (batches || []).filter((b) => b.inventory_id === selectedId),
		[batches, selectedId],
	);

	const stats = useMemo(() => {
		const consumes = movements.filter((m) => m.movement_type === "session_consume");
		const uniqueClients = new Set(
			consumes.map((m) => m.client_id).filter(Boolean),
		);
		const qtyOut = consumes.reduce((a, m) => a + Math.abs(Number(m.quantity) || 0), 0);
		const qtyIn = movements
			.filter((m) => Number(m.quantity) > 0)
			.reduce((a, m) => a + Number(m.quantity), 0);
		const sessionsApprox = new Set(
			consumes.map((m) => `${m.occurred_at}|${m.client_id || ""}|${m.finance_entry_id || ""}`),
		).size;
		return {
			clients: uniqueClients.size,
			qtyOut,
			qtyIn,
			sessions: sessionsApprox,
			yieldSessions: qtyOut > 0 ? sessionsApprox : 0,
		};
	}, [movements]);

	if (invLoading) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-rose-700" />
			</div>
		);
	}

	return (
		<div className="space-y-5 animate-in fade-in pb-20">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
						<FlaskConical className="text-rose-700" size={22} />
						Trazabilidad de stock
					</h2>
					<p className="text-sm text-slate-500 mt-1">
						Historial clínico por producto y lote: clientes, fechas y consumo.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				<aside className="lg:col-span-4 xl:col-span-3 space-y-3">
					<div className="relative">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
							size={16}
						/>
						<input
							className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium"
							placeholder="Buscar producto…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
						{filteredMaterials.length === 0 ? (
							<p className="p-4 text-sm text-slate-500">Sin materiales.</p>
						) : (
							filteredMaterials.map((m) => (
								<button
									key={m.id}
									type="button"
									onClick={() => setSelectedId(m.id)}
									className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${
										selectedId === m.id ? "bg-rose-50/80" : ""
									}`}>
									<p className="text-sm font-medium text-slate-900 truncate">
										{m.name}
									</p>
									<p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
										Stock {Number(m.stock)} {m.unit || "uds"}
									</p>
								</button>
							))
						)}
					</div>
				</aside>

				<section className="lg:col-span-8 xl:col-span-9 space-y-4">
					{!selected ? (
						<EmptyState
							icon={Package}
							title="Selecciona un producto"
							description="Elige un material a la izquierda para ver lotes, consumo por cliente y rendimiento estimado."
						/>
					) : (
						<>
							<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h3 className="text-lg font-bold text-slate-900">
											{selected.name}
										</h3>
										<p className="text-sm text-slate-500 tabular-nums">
											Stock actual: {Number(selected.stock)}{" "}
											{selected.unit || "uds"}
											{Number(selected.stock) < 0 && (
												<span className="ml-2 text-rose-700 font-semibold">
													(negativo)
												</span>
											)}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center min-w-[5.5rem]">
											<p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
												Clientes
											</p>
											<p className="text-lg font-bold text-slate-900 tabular-nums flex items-center justify-center gap-1">
												<Users size={14} className="text-slate-400" />
												{stats.clients}
											</p>
										</div>
										<div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center min-w-[5.5rem]">
											<p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
												Sesiones
											</p>
											<p className="text-lg font-bold text-slate-900 tabular-nums flex items-center justify-center gap-1">
												<CalendarDays size={14} className="text-slate-400" />
												{stats.sessions}
											</p>
										</div>
										<div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center min-w-[5.5rem]">
											<p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
												Consumido
											</p>
											<p className="text-lg font-bold text-slate-900 tabular-nums">
												{stats.qtyOut.toFixed(1)}
											</p>
										</div>
									</div>
								</div>
								{stats.sessions > 0 && (
									<p className="text-xs text-slate-500">
										Rendimiento estimado: este producto ha cubierto{" "}
										<strong className="text-slate-800">{stats.sessions}</strong>{" "}
										sesión(es) con{" "}
										<strong className="text-slate-800 tabular-nums">
											{stats.qtyOut.toFixed(1)}
										</strong>{" "}
										{selected.unit || "uds"} consumidas.
									</p>
								)}
							</div>

							{itemBatches.length > 0 && (
								<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
									<p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
										Lotes activos
									</p>
									<div className="flex flex-wrap gap-2">
										{itemBatches.map((b) => (
											<div
												key={b.id}
												className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
												<p className="font-bold text-slate-800">{b.lot_number}</p>
												<p className="text-slate-500 tabular-nums">
													{b.quantity_remaining} ud · cad. {formatDate(b.expiry_date)}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
								<div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
									<div className="flex flex-wrap items-center gap-2">
										<Filter size={14} className="text-slate-400" />
										<GlobalDateFilter
											preset={followGlobal ? reportingPreset : preset}
											onPresetChange={(v) =>
												adoptGlobalThen(() => setPreset(v))
											}
											anchorYm={
												followGlobal ? reportingAnchorYm || anchorYm : anchorYm
											}
											onAnchorYmChange={(v) =>
												adoptGlobalThen(() => setAnchorYm(v))
											}
											customFrom={
												followGlobal
													? reportingCustomFrom || customFrom
													: customFrom
											}
											customTo={
												followGlobal ? reportingCustomTo || customTo : customTo
											}
											onCustomFromChange={(v) =>
												adoptGlobalThen(() => setCustomFrom(v))
											}
											onCustomToChange={(v) =>
												adoptGlobalThen(() => setCustomTo(v))
											}
											rangeLabel={rangeLabel}
											onTodayClick={goLocalToday}
										/>
										{!followGlobal ? (
											<button
												type="button"
												onClick={() => setFollowGlobal(true)}
												className="text-[11px] font-bold text-rose-700 hover:underline">
												Usar periodo global
											</button>
										) : (
											<span className="text-[11px] font-medium text-slate-400">
												Periodo global
											</span>
										)}
									</div>
									<select
										className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium"
										value={typeFilter}
										onChange={(e) => setTypeFilter(e.target.value)}>
										<option value="all">Todos los movimientos</option>
										<option value="session_consume">Consumo sesión</option>
										<option value="purchase">Compra / alta</option>
										<option value="restock">Reposición</option>
										<option value="adjustment">Ajuste</option>
										<option value="waste">Merma / rotura</option>
									</select>
								</div>
								{movLoading ? (
									<div className="p-8 flex justify-center">
										<Loader2 className="animate-spin text-rose-700" />
									</div>
								) : movements.length === 0 ? (
									<p className="p-8 text-center text-sm text-slate-500">
										Sin movimientos en este filtro. Los nuevos consumos de sesión
										y ajustes quedarán registrados aquí.
									</p>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-sm min-w-[640px]">
											<thead>
												<tr className="bg-slate-50/90 text-xs font-medium text-slate-500 uppercase tracking-wider">
													<th className="text-left p-3">Fecha</th>
													<th className="text-left p-3">Tipo</th>
													<th className="text-right p-3">Cantidad</th>
													<th className="text-left p-3">Lote</th>
													<th className="text-left p-3">Cliente</th>
													<th className="text-left p-3 hidden md:table-cell">
														Motivo
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-50">
												{movements.map((m) => {
													const lot =
														m.metadata?.lot_number ||
														itemBatches.find((b) => b.id === m.batch_id)
															?.lot_number ||
														(m.batch_id ? "—" : "Sin lote");
													const client = m.client_id
														? clientById[m.client_id]
														: null;
													const clientLabel = client
														? [client.name, client.surname]
																.filter(Boolean)
																.join(" ")
														: m.client_id
															? "Cliente"
															: "—";
													const qty = Number(m.quantity) || 0;
													return (
														<tr key={m.id} className="hover:bg-slate-50/70">
															<td className="p-3 tabular-nums font-medium text-slate-900">
																{formatDate(m.occurred_at)}
															</td>
															<td className="p-3">
																<StatusChip
																	tone={
																		m.movement_type === "session_consume"
																			? "warning"
																			: qty > 0
																				? "success"
																				: "neutral"
																	}>
																	{m.movement_type}
																</StatusChip>
															</td>
															<td
																className={`p-3 text-right font-bold tabular-nums ${
																	qty < 0 ? "text-rose-700" : "text-emerald-700"
																}`}>
																{qty > 0 ? "+" : ""}
																{qty}
															</td>
															<td className="p-3 text-slate-700 font-mono text-xs">
																{lot}
															</td>
															<td className="p-3 text-slate-800 font-medium">
																{clientLabel}
															</td>
															<td className="p-3 text-slate-500 text-xs hidden md:table-cell max-w-[12rem] truncate">
																{m.reason || "—"}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</>
					)}
				</section>
			</div>
		</div>
	);
};
