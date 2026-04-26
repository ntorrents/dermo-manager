import React, { useMemo, useState } from "react";
import {
	Building2,
	Search,
	ReceiptText,
	TrendingUp,
	CalendarDays,
	Percent,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";

const fmtMonth = (ym) => {
	const [y, m] = String(ym).split("-").map(Number);
	return new Date(y, (m || 1) - 1, 1).toLocaleDateString("es-ES", {
		month: "short",
		year: "2-digit",
	});
};

const toYm = (date) => (date && String(date).length >= 7 ? String(date).slice(0, 7) : null);

const Sparkline = ({ points = [] }) => {
	if (!points.length) return null;
	const width = 320;
	const height = 88;
	const min = Math.min(...points);
	const max = Math.max(...points);
	const den = max - min || 1;
	const coords = points
		.map((p, i) => {
			const x = (i / Math.max(points.length - 1, 1)) * (width - 1);
			const y = height - 1 - ((p - min) / den) * (height - 1);
			return `${x},${y}`;
		})
		.join(" ");
	return (
		<svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
			<polyline
				fill="none"
				stroke="#f43f5e"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={coords}
			/>
		</svg>
	);
};

export const SuppliersTab = ({ entries = [] }) => {
	const [search, setSearch] = useState("");
	const [selectedKey, setSelectedKey] = useState("");

	const suppliers = useMemo(() => {
		const expenses = (entries || []).filter(
			(e) => e.type === "expense" && (e.provider_name || e.supplier_nif),
		);
		const map = new Map();
		expenses.forEach((e) => {
			const name = (e.provider_name || "").trim();
			const nif = (e.supplier_nif || "").trim();
			const key = `${(nif || name).toLowerCase()}__${name.toLowerCase()}`;
			if (!map.has(key)) {
				map.set(key, { key, name, nif, rows: [] });
			}
			map.get(key).rows.push(e);
		});

		return Array.from(map.values())
			.map((s) => {
				const rows = [...s.rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
				const total = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
				const iva = rows.reduce((acc, r) => acc + (Number(r.tax_amount) || 0), 0);
				return {
					...s,
					rows,
					totalSpent: total,
					totalIva: iva,
					invoicesCount: rows.length,
					avgInvoice: rows.length ? total / rows.length : 0,
					lastDate: rows[0]?.date || null,
				};
			})
			.sort((a, b) => b.totalSpent - a.totalSpent);
	}, [entries]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return suppliers;
		return suppliers.filter(
			(s) =>
				(s.name || "").toLowerCase().includes(q) ||
				(s.nif || "").toLowerCase().includes(q),
		);
	}, [suppliers, search]);

	const selectedSupplier =
		filtered.find((s) => s.key === selectedKey) ||
		filtered[0] ||
		suppliers.find((s) => s.key === selectedKey) ||
		null;

	const monthlySeries = useMemo(() => {
		if (!selectedSupplier) return [];
		const now = new Date();
		const months = Array.from({ length: 8 }, (_, i) => {
			const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
			const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			return ym;
		});
		const sumByMonth = Object.fromEntries(months.map((m) => [m, 0]));
		selectedSupplier.rows.forEach((r) => {
			const ym = toYm(r.date);
			if (ym && ym in sumByMonth) sumByMonth[ym] += Number(r.amount) || 0;
		});
		return months.map((m) => ({ month: m, total: sumByMonth[m] || 0 }));
	}, [selectedSupplier]);

	const monthlyAvg =
		monthlySeries.length > 0
			? monthlySeries.reduce((a, m) => a + m.total, 0) / monthlySeries.length
			: 0;
	const lastMonth = monthlySeries[monthlySeries.length - 1]?.total || 0;
	const prevMonth = monthlySeries[monthlySeries.length - 2]?.total || 0;
	const monthDeltaPct = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

	const totalGlobal = filtered.reduce((a, s) => a + s.totalSpent, 0);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-2xl xl:text-3xl font-black text-gray-800 tracking-tight flex items-center gap-2">
					<Building2 className="text-rose-500" size={28} /> Proveedores
				</h2>
				<div className="text-xs font-bold text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2">
					{filtered.length} proveedores · {formatCurrency(totalGlobal)}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
					<div className="p-4 border-b border-gray-100">
						<div className="relative">
							<Search size={17} className="absolute left-3 top-3.5 text-gray-400" />
							<input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar proveedor o NIF..."
								className="w-full pl-9 pr-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none text-sm font-medium"
							/>
						</div>
					</div>
					<div className="max-h-[560px] overflow-y-auto">
						{filtered.map((s) => (
							<button
								key={s.key}
								type="button"
								onClick={() => setSelectedKey(s.key)}
								className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
									selectedSupplier?.key === s.key ? "bg-rose-50" : "hover:bg-gray-50"
								}`}>
								<p className="font-bold text-gray-800 truncate">{s.name || "Proveedor sin nombre"}</p>
								<p className="text-xs text-gray-500 truncate">{s.nif || "NIF no indicado"}</p>
								<p className="text-xs font-bold text-rose-500 mt-1">
									{formatCurrency(s.totalSpent)} · {s.invoicesCount} facturas
								</p>
							</button>
						))}
						{filtered.length === 0 && (
							<div className="p-6 text-sm text-gray-400">No hay proveedores con ese filtro.</div>
						)}
					</div>
				</div>

				<div className="lg:col-span-2 space-y-4">
					{selectedSupplier ? (
						<>
							<div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
								<div className="flex flex-wrap items-end justify-between gap-2">
									<div>
										<h3 className="text-xl font-black text-gray-900">
											{selectedSupplier.name || "Proveedor"}
										</h3>
										<p className="text-sm text-gray-500">NIF: {selectedSupplier.nif || "—"}</p>
									</div>
									<div className="text-xs text-gray-400 font-medium">
										Última factura: {selectedSupplier.lastDate || "—"}
									</div>
								</div>
								<div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
									<div className="p-3 bg-gray-50 rounded-xl">
										<p className="text-[10px] font-black text-gray-400 uppercase">Total gastado</p>
										<p className="font-black text-gray-800">{formatCurrency(selectedSupplier.totalSpent)}</p>
									</div>
									<div className="p-3 bg-gray-50 rounded-xl">
										<p className="text-[10px] font-black text-gray-400 uppercase">Facturas</p>
										<p className="font-black text-gray-800">{selectedSupplier.invoicesCount}</p>
									</div>
									<div className="p-3 bg-gray-50 rounded-xl">
										<p className="text-[10px] font-black text-gray-400 uppercase">Ticket medio</p>
										<p className="font-black text-gray-800">{formatCurrency(selectedSupplier.avgInvoice)}</p>
									</div>
									<div className="p-3 bg-gray-50 rounded-xl">
										<p className="text-[10px] font-black text-gray-400 uppercase">IVA soportado</p>
										<p className="font-black text-gray-800">{formatCurrency(selectedSupplier.totalIva)}</p>
									</div>
								</div>
							</div>

							<div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
								<div className="flex items-center justify-between gap-3 mb-2">
									<p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
										<TrendingUp size={14} /> Gasto mensual (8 meses)
									</p>
									<div className="text-xs text-gray-500 flex items-center gap-3">
										<span className="inline-flex items-center gap-1">
											<CalendarDays size={13} /> Media: {formatCurrency(monthlyAvg)}
										</span>
										<span className={`inline-flex items-center gap-1 font-bold ${monthDeltaPct >= 0 ? "text-rose-500" : "text-emerald-600"}`}>
											<Percent size={13} />
											{monthDeltaPct >= 0 ? "+" : ""}
											{monthDeltaPct.toFixed(1)}%
										</span>
									</div>
								</div>
								<Sparkline points={monthlySeries.map((m) => m.total)} />
								<div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
									{monthlySeries.map((m) => (
										<span key={m.month} className="px-2 py-1 bg-gray-50 rounded-lg">
											{fmtMonth(m.month)}: {formatCurrency(m.total)}
										</span>
									))}
								</div>
							</div>

							<div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
								<div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
									<ReceiptText size={16} className="text-gray-500" />
									<p className="text-xs font-black text-gray-500 uppercase tracking-widest">
										Facturas / gastos del proveedor
									</p>
								</div>
								<div className="overflow-auto">
									<table className="w-full text-sm">
										<thead className="bg-gray-50 text-gray-500 text-[11px] uppercase">
											<tr>
												<th className="text-left p-3">Fecha</th>
												<th className="text-left p-3">Factura</th>
												<th className="text-left p-3">Concepto</th>
												<th className="text-right p-3">Base</th>
												<th className="text-right p-3">IVA</th>
												<th className="text-right p-3">Total</th>
											</tr>
										</thead>
										<tbody>
											{selectedSupplier.rows.map((r) => (
												<tr key={r.id} className="border-t border-gray-50">
													<td className="p-3 font-medium text-gray-700">{r.date || "—"}</td>
													<td className="p-3 text-gray-600">{r.invoice_number || "—"}</td>
													<td className="p-3 text-gray-700">{r.description || "—"}</td>
													<td className="p-3 text-right text-gray-700">
														{formatCurrency(Number(r.tax_base ?? r.base_amount ?? r.amount) || 0)}
													</td>
													<td className="p-3 text-right text-gray-700">
														{formatCurrency(Number(r.tax_amount) || 0)}
													</td>
													<td className="p-3 text-right font-bold text-gray-900">
														{formatCurrency(Number(r.amount) || 0)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</>
					) : (
						<div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-gray-400">
							Sin datos de proveedores todavía.
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
