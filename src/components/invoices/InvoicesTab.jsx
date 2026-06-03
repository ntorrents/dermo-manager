import React, { useMemo, useState } from "react";
import {
	Search,
	FileText,
	Download,
	Building2,
	User,
	Receipt,
	TrendingUp,
	X,
	Filter,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { filterByReportingRange } from "../../utils/dateUtils";
import { ReportingPeriodToolbar } from "../ui/ReportingPeriodToolbar";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { generateInvoice } from "../../utils/invoiceGenerator";
import {
	isSalesInvoice,
	isAbonoEntry,
	parseInvoiceDescription,
	resolveInvoiceClient,
	clientDisplayName,
	aggregateByKey,
} from "../../utils/invoiceAnalytics";

const StatBar = ({ label, total, count, maxTotal, active, onClick }) => {
	const pct = maxTotal > 0 ? Math.min(100, (total / maxTotal) * 100) : 0;
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left rounded-xl p-3 border transition-colors ${
				active
					? "border-rose-300 bg-rose-50"
					: "border-gray-100 bg-white hover:border-rose-200 hover:bg-rose-50/40"
			}`}>
			<div className="flex justify-between gap-2 mb-1.5">
				<span className="text-xs font-bold text-gray-800 truncate">{label}</span>
				<span className="text-xs font-black text-rose-600 shrink-0">
					{formatCurrency(total)}
				</span>
			</div>
			<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
				<div
					className="h-full bg-rose-500 rounded-full transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<p className="text-[10px] text-gray-500 mt-1 font-medium">{count} factura(s)</p>
		</button>
	);
};

export const InvoicesTab = ({
	entries = [],
	clients = [],
	user,
	profile,
	clinic,
	showToast = () => {},
	reportingRange,
	reportingPreset,
	setReportingPreset,
	reportingAnchorYm,
	setReportingAnchorYm,
	reportingCustomFrom,
	setReportingCustomFrom,
	reportingCustomTo,
	setReportingCustomTo,
	onReportingGoToday,
}) => {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 250);
	const [clientFilter, setClientFilter] = useState("");
	const [treatmentFilter, setTreatmentFilter] = useState("");
	const [companyOnly, setCompanyOnly] = useState(false);
	const [hideAbonos, setHideAbonos] = useState(false);
	const [downloadingId, setDownloadingId] = useState(null);

	const rangeStart = reportingRange?.start ?? "";
	const rangeEnd = reportingRange?.end ?? "";

	const allInvoices = useMemo(
		() => (entries || []).filter(isSalesInvoice),
		[entries],
	);

	const periodInvoices = useMemo(
		() => filterByReportingRange(allInvoices, "date", rangeStart, rangeEnd),
		[allInvoices, rangeStart, rangeEnd],
	);

	const enriched = useMemo(
		() =>
			periodInvoices.map((entry) => {
				const client = resolveInvoiceClient(entry, clients);
				const { treatmentName } = parseInvoiceDescription(entry.description);
				const abono = isAbonoEntry(entry);
				const amount = Number(entry.amount) || 0;
				return {
					entry,
					client,
					clientName: clientDisplayName(client, entry),
					clientId: client?.id || entry.client_id || "",
					treatmentName,
					abono,
					amount,
					absAmount: Math.abs(amount),
					isCompany: !!client?.is_company,
				};
			}),
		[periodInvoices, clients],
	);

	const filtered = useMemo(() => {
		let list = enriched;
		if (hideAbonos) list = list.filter((r) => !r.abono);
		if (companyOnly) list = list.filter((r) => r.isCompany);
		if (clientFilter) list = list.filter((r) => r.clientId === clientFilter);
		if (treatmentFilter) list = list.filter((r) => r.treatmentName === treatmentFilter);
		const q = debouncedSearch.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(r) =>
					r.clientName.toLowerCase().includes(q) ||
					r.treatmentName.toLowerCase().includes(q) ||
					String(r.entry.invoice_number || "")
						.toLowerCase()
						.includes(q) ||
					String(r.entry.description || "")
						.toLowerCase()
						.includes(q),
			);
		}
		return [...list].sort(
			(a, b) => new Date(b.entry.date) - new Date(a.entry.date),
		);
	}, [
		enriched,
		hideAbonos,
		companyOnly,
		clientFilter,
		treatmentFilter,
		debouncedSearch,
	]);

	const kpis = useMemo(() => {
		const sales = filtered.filter((r) => !r.abono);
		const abonos = filtered.filter((r) => r.abono);
		const totalNet = filtered.reduce((acc, r) => acc + r.amount, 0);
		const totalSales = sales.reduce((acc, r) => acc + r.amount, 0);
		const count = filtered.length;
		const avg = sales.length ? totalSales / sales.length : 0;
		const companies = filtered.filter((r) => r.isCompany).length;
		return { totalNet, totalSales, count, avg, companies, abonos: abonos.length };
	}, [filtered]);

	const byTreatment = useMemo(
		() =>
			aggregateByKey(
				filtered.filter((r) => !r.abono),
				(r) => r.treatmentName,
				(r) => r.absAmount,
			).slice(0, 8),
		[filtered],
	);

	const byClient = useMemo(
		() =>
			aggregateByKey(
				filtered.filter((r) => !r.abono),
				(r) => r.clientId || r.clientName,
				(r) => r.absAmount,
			)
				.map((row) => {
					const sample = filtered.find(
						(r) => (r.clientId || r.clientName) === row.key,
					);
					return {
						...row,
						label: sample?.clientName || row.key,
						clientId: sample?.clientId || "",
					};
				})
				.slice(0, 8),
		[filtered],
	);

	const maxTreatmentTotal = byTreatment[0]?.total || 0;
	const maxClientTotal = byClient[0]?.total || 0;

	const clientOptions = useMemo(() => {
		const map = new Map();
		enriched.forEach((r) => {
			if (r.clientId) map.set(r.clientId, r.clientName);
		});
		return Array.from(map.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name, "es"));
	}, [enriched]);

	const treatmentOptions = useMemo(() => {
		const set = new Set(enriched.map((r) => r.treatmentName).filter(Boolean));
		return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
	}, [enriched]);

	const hasActiveFilters =
		clientFilter ||
		treatmentFilter ||
		companyOnly ||
		hideAbonos ||
		debouncedSearch.trim();

	const clearFilters = () => {
		setSearch("");
		setClientFilter("");
		setTreatmentFilter("");
		setCompanyOnly(false);
		setHideAbonos(false);
	};

	const handleDownload = async (row) => {
		const { entry, client } = row;
		if (!client) {
			showToast("No se encontró la ficha del cliente para esta factura", "error");
			return;
		}
		if (client.is_company && !client.address?.trim()) {
			showToast("Añade la dirección fiscal del cliente antes de generar el PDF", "error");
			return;
		}
		setDownloadingId(entry.id);
		try {
			await generateInvoice(entry, client, clinic, profile, {
				isAbono: row.abono,
			});
			showToast("PDF generado");
		} catch {
			showToast("Error al generar la factura", "error");
		} finally {
			setDownloadingId(null);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-8">
			<div className="flex flex-col gap-1">
				<h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
					<FileText className="text-rose-500" size={28} />
					Facturas emitidas
				</h2>
				<p className="text-sm text-gray-500 font-medium">
					Consulta, filtra y descarga PDF. Pulsa en un tratamiento o cliente para
					filtrar la lista.
				</p>
			</div>

			<ReportingPeriodToolbar
				preset={reportingPreset}
				onPresetChange={setReportingPreset}
				anchorYm={reportingAnchorYm}
				onAnchorYmChange={setReportingAnchorYm}
				customFrom={reportingCustomFrom}
				customTo={reportingCustomTo}
				onCustomFromChange={setReportingCustomFrom}
				onCustomToChange={setReportingCustomTo}
				rangeLabel={reportingRange?.label}
				onTodayClick={onReportingGoToday}
			/>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
					<p className="text-[10px] font-black text-gray-400 uppercase">Total neto</p>
					<p className="text-xl font-black text-gray-900 mt-1">
						{formatCurrency(kpis.totalNet)}
					</p>
					<p className="text-[10px] text-gray-500 mt-0.5">Cobrado en periodo</p>
				</div>
				<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
					<p className="text-[10px] font-black text-gray-400 uppercase">Nº facturas</p>
					<p className="text-xl font-black text-gray-900 mt-1">{kpis.count}</p>
					<p className="text-[10px] text-gray-500 mt-0.5">
						{kpis.abonos > 0 ? `${kpis.abonos} abono(s)` : "En el filtro actual"}
					</p>
				</div>
				<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
					<p className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1">
						<TrendingUp size={12} /> Ticket medio
					</p>
					<p className="text-xl font-black text-emerald-600 mt-1">
						{formatCurrency(kpis.avg)}
					</p>
					<p className="text-[10px] text-gray-500 mt-0.5">Solo ventas (sin abonos)</p>
				</div>
				<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
					<p className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1">
						<Building2 size={12} /> A empresas
					</p>
					<p className="text-xl font-black text-blue-700 mt-1">{kpis.companies}</p>
					<p className="text-[10px] text-gray-500 mt-0.5">Con retención IRPF</p>
				</div>
			</div>

			<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
				<div className="relative">
					<Search
						className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
						size={18}
					/>
					<input
						type="search"
						placeholder="Buscar por nº, cliente, tratamiento…"
						className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-rose-100"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<div className="flex flex-wrap gap-2 items-center">
					<Filter size={16} className="text-gray-400 shrink-0" />
					<select
						className="px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold outline-none"
						value={clientFilter}
						onChange={(e) => setClientFilter(e.target.value)}>
						<option value="">Todos los clientes</option>
						{clientOptions.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
					<select
						className="px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold outline-none max-w-[200px]"
						value={treatmentFilter}
						onChange={(e) => setTreatmentFilter(e.target.value)}>
						<option value="">Todos los tratamientos</option>
						{treatmentOptions.map((t) => (
							<option key={t} value={t}>
								{t.length > 36 ? `${t.slice(0, 36)}…` : t}
							</option>
						))}
					</select>
					<label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold cursor-pointer">
						<input
							type="checkbox"
							checked={companyOnly}
							onChange={(e) => setCompanyOnly(e.target.checked)}
							className="rounded text-blue-600"
						/>
						Solo empresas
					</label>
					<label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold cursor-pointer">
						<input
							type="checkbox"
							checked={hideAbonos}
							onChange={(e) => setHideAbonos(e.target.checked)}
							className="rounded text-rose-600"
						/>
						Ocultar abonos
					</label>
					{hasActiveFilters && (
						<button
							type="button"
							onClick={clearFilters}
							className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl">
							<X size={14} /> Limpiar filtros
						</button>
					)}
				</div>
			</div>

			<div className="grid lg:grid-cols-3 gap-6">
				<div className="lg:col-span-1 space-y-6">
					<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
						<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
							Por tratamiento
						</h3>
						{byTreatment.length === 0 ? (
							<p className="text-sm text-gray-500">Sin datos en este periodo.</p>
						) : (
							<div className="space-y-2">
								{byTreatment.map((row) => (
									<StatBar
										key={row.key}
										label={row.key}
										total={row.total}
										count={row.count}
										maxTotal={maxTreatmentTotal}
										active={treatmentFilter === row.key}
										onClick={() =>
											setTreatmentFilter((prev) =>
												prev === row.key ? "" : row.key,
											)
										}
									/>
								))}
							</div>
						)}
					</div>
					<div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
						<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
							Por cliente
						</h3>
						{byClient.length === 0 ? (
							<p className="text-sm text-gray-500">Sin datos en este periodo.</p>
						) : (
							<div className="space-y-2">
								{byClient.map((row) => (
									<StatBar
										key={row.key}
										label={row.label}
										total={row.total}
										count={row.count}
										maxTotal={maxClientTotal}
										active={clientFilter === row.clientId}
										onClick={() =>
											setClientFilter((prev) =>
												prev === row.clientId ? "" : row.clientId,
											)
										}
									/>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="lg:col-span-2">
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
							<h3 className="text-sm font-black text-gray-800">
								Listado ({filtered.length})
							</h3>
							<span className="text-xs text-gray-500 font-medium">
								{allInvoices.length} facturas en total
							</span>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
										<th className="text-left p-3">Fecha</th>
										<th className="text-left p-3">Nº</th>
										<th className="text-left p-3">Cliente</th>
										<th className="text-left p-3 hidden md:table-cell">
											Concepto
										</th>
										<th className="text-right p-3">Total</th>
										<th className="p-3 w-12" />
									</tr>
								</thead>
								<tbody>
									{filtered.length === 0 ? (
										<tr>
											<td
												colSpan={6}
												className="p-8 text-center text-gray-500 font-medium">
												No hay facturas con estos filtros.
											</td>
										</tr>
									) : (
										filtered.map((row) => (
											<tr
												key={row.entry.id}
												className={`border-t border-gray-50 hover:bg-rose-50/30 ${
													row.abono ? "bg-amber-50/40" : ""
												}`}>
												<td className="p-3 font-bold text-gray-700 whitespace-nowrap">
													{row.entry.date}
												</td>
												<td className="p-3 font-mono text-xs font-bold text-gray-800">
													{row.entry.invoice_number}
													{row.abono && (
														<span className="ml-1 text-[9px] font-black text-amber-700 uppercase">
															Abono
														</span>
													)}
												</td>
												<td className="p-3">
													<div className="font-bold text-gray-800 flex items-center gap-1.5">
														{row.isCompany ? (
															<Building2
																size={14}
																className="text-blue-600 shrink-0"
															/>
														) : (
															<User
																size={14}
																className="text-gray-400 shrink-0"
															/>
														)}
														<span className="truncate max-w-[120px]">
															{row.clientName}
														</span>
													</div>
												</td>
												<td className="p-3 hidden md:table-cell text-gray-600 font-medium max-w-[180px] truncate">
													{row.treatmentName}
												</td>
												<td
													className={`p-3 text-right font-black whitespace-nowrap ${
														row.abono ? "text-amber-700" : "text-emerald-600"
													}`}>
													{formatCurrency(row.amount)}
												</td>
												<td className="p-3">
													<button
														type="button"
														title="Descargar PDF"
														disabled={downloadingId === row.entry.id}
														onClick={() => handleDownload(row)}
														className="p-2 rounded-lg hover:bg-rose-100 text-rose-600 disabled:opacity-40">
														{downloadingId === row.entry.id ? (
															<Receipt
																size={18}
																className="animate-pulse"
															/>
														) : (
															<Download size={18} />
														)}
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						{filtered.length > 0 && (
							<div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex flex-wrap gap-4">
								<span>
									Base:{" "}
									<strong>
										{formatCurrency(
											filtered.reduce(
												(acc, r) =>
													acc + (Number(r.entry.tax_base) || 0),
												0,
											),
										)}
									</strong>
								</span>
								<span>
									IVA:{" "}
									<strong>
										{formatCurrency(
											filtered.reduce(
												(acc, r) =>
													acc + (Number(r.entry.tax_amount) || 0),
												0,
											),
										)}
									</strong>
								</span>
								<span>
									Ret. IRPF:{" "}
									<strong>
										{formatCurrency(
											filtered.reduce(
												(acc, r) =>
													acc + (Number(r.entry.irpf_amount) || 0),
												0,
											),
										)}
									</strong>
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
