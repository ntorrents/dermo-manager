import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	Download,
	CheckCircle2,
	Clock,
	AlertTriangle,
	Hourglass,
	EyeOff,
	RotateCcw,
	Loader2,
} from "lucide-react";
import { getTaxDeclarationDownloadUrl } from "../../../services/taxDeclarationStorage";
import { formatCurrency } from "../../../utils/format";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { getDeclarationUiStatus } from "../../../utils/tax/deadlines";
import { useTenant } from "../../../context/TenantContext";
import { StatusChip } from "../../ui/StatusChip";

const PERIODS_Q = ["T1", "T2", "T3", "T4"];

const STATUS_META = {
	presented: { tone: "success", Icon: CheckCircle2 },
	ignored: { tone: "neutral", Icon: EyeOff },
	upcoming: { tone: "neutral", Icon: Hourglass },
	pending: { tone: "danger", Icon: Clock },
	overdue: { tone: "warning", Icon: AlertTriangle },
};

const STATUS_ROW = {
	presented: "border-t border-gray-50 bg-white",
	ignored: "border-t border-gray-50 bg-slate-50/60",
	upcoming: "border-t border-gray-50 bg-white",
	pending: "border-t border-rose-100 bg-rose-50/40",
	overdue: "border-t border-amber-300 bg-amber-100/80",
};

export const DeclaracionesResumenView = ({
	declarations = [],
	upsertDeclaration,
	showToast = () => {},
}) => {
	const { clinicId } = useTenant();
	const [year, setYear] = useState(new Date().getFullYear());
	const [busyKey, setBusyKey] = useState(null);

	const rows = useMemo(() => {
		const out = [];
		for (const model of ["130", "303", "115"]) {
			for (const period of PERIODS_Q) {
				const d = declarations.find(
					(x) => x.model === model && Number(x.year) === year && x.period === period,
				);
				const status = getDeclarationUiStatus(model, year, period, d);
				out.push({ model, period, year, declaration: d, status });
			}
		}
		for (const model of ["390", "180"]) {
			const d = declarations.find(
				(x) => x.model === model && Number(x.year) === year && x.period === "ANUAL",
			);
			const status = getDeclarationUiStatus(model, year, "ANUAL", d);
			out.push({ model, period: "ANUAL", year, declaration: d, status });
		}
		return out;
	}, [declarations, year]);

	const pathFor = (model, period) => {
		const base = "/finanzas/fiscalidad";
		if (period === "ANUAL") return `${base}/anual/${model}`;
		return `${base}/trimestral/${model}`;
	};

	const download = async (storagePath) => {
		try {
			const url = await getTaxDeclarationDownloadUrl(storagePath);
			if (url) window.open(url, "_blank", "noopener,noreferrer");
		} catch (err) {
			showToast(err.message || "Error al descargar", "error");
		}
	};

	const setIgnored = async (row, ignored) => {
		if (!clinicId || !upsertDeclaration) return;
		const key = `${row.model}-${row.period}`;
		setBusyKey(key);
		try {
			await upsertDeclaration({
				clinic_id: clinicId,
				model: row.model,
				year: row.year,
				period: row.period,
				status: ignored ? "ignored" : "pending",
				result_amount: row.declaration?.result_amount ?? null,
				storage_path: row.declaration?.storage_path ?? null,
				notes: ignored
					? row.declaration?.notes || "Ignorado: sin actividad / no aplica"
					: row.declaration?.notes ?? null,
				presented_at: null,
				presented_by: null,
				updated_at: new Date().toISOString(),
			});
			showToast(
				ignored
					? `Modelo ${row.model} ${row.period}: aviso ignorado`
					: `Modelo ${row.model} ${row.period}: aviso restaurado`,
			);
		} catch (err) {
			showToast(err.message || "No se pudo actualizar", "error");
		} finally {
			setBusyKey(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-lg sm:text-xl font-black text-gray-900">
						Resumen Declaraciones
					</h2>
					<p className="text-sm text-gray-500 mt-1">
						Estado según plazos AEAT. Puedes{" "}
						<strong className="font-semibold text-gray-700">Ignorar</strong> un
						periodo sin actividad (baja temporal, etc.) para quitar el aviso de
						retrasado.
					</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
			</div>

			<div className="flex flex-wrap gap-2">
				<StatusChip tone="success">Presentado</StatusChip>
				<StatusChip tone="neutral">Próximamente</StatusChip>
				<StatusChip tone="danger">Pendiente (en plazo)</StatusChip>
				<StatusChip tone="warning">Retrasado</StatusChip>
				<StatusChip tone="neutral">Ignorado</StatusChip>
			</div>

			<div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
				<table className="w-full text-sm text-left min-w-[720px]">
					<thead>
						<tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
							<th className="px-4 py-3">Modelo</th>
							<th className="px-4 py-3">Periodo</th>
							<th className="px-4 py-3">Estado</th>
							<th className="px-4 py-3">Resultado</th>
							<th className="px-4 py-3">PDF</th>
							<th className="px-4 py-3 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const meta = STATUS_META[row.status.id] || STATUS_META.upcoming;
							const Icon = meta.Icon;
							const key = `${row.model}-${row.period}`;
							const busy = busyKey === key;
							const canIgnore =
								row.status.id === "overdue" || row.status.id === "pending";
							const isIgnored = row.status.id === "ignored";

							return (
								<tr key={key} className={STATUS_ROW[row.status.id] || STATUS_ROW.upcoming}>
									<td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
										Modelo {row.model}
									</td>
									<td className="px-4 py-3 text-gray-600 whitespace-nowrap">
										{row.period}
									</td>
									<td className="px-4 py-3">
										<StatusChip
											tone={meta.tone}
											className="max-w-[9rem] sm:max-w-none gap-1.5">
											<Icon size={12} className="shrink-0" />
											<span className="truncate">
												{row.status.label}
												{row.status.id === "pending" && row.status.daysLeft != null
													? ` · ${row.status.daysLeft}d`
													: ""}
												{row.status.id === "overdue" && row.status.daysLate != null
													? ` · +${row.status.daysLate}d`
													: ""}
											</span>
										</StatusChip>
									</td>
									<td className="px-4 py-3 tabular-nums text-gray-700">
										{row.declaration?.result_amount != null
											? formatCurrency(row.declaration.result_amount)
											: "—"}
									</td>
									<td className="px-4 py-3">
										{row.declaration?.storage_path ? (
											<button
												type="button"
												onClick={() => download(row.declaration.storage_path)}
												className="inline-flex items-center gap-1 text-rose-700 font-bold hover:underline">
												<Download size={14} /> PDF
											</button>
										) : (
											<span className="text-gray-300">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center justify-end gap-2 flex-wrap">
											{canIgnore && (
												<button
													type="button"
													disabled={busy || !upsertDeclaration}
													onClick={() => setIgnored(row, true)}
													className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
													title="No avisar este periodo (sin actividad)">
													{busy ? (
														<Loader2 size={12} className="animate-spin" />
													) : (
														<EyeOff size={12} />
													)}
													Ignorar
												</button>
											)}
											{isIgnored && (
												<button
													type="button"
													disabled={busy || !upsertDeclaration}
													onClick={() => setIgnored(row, false)}
													className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline disabled:opacity-50"
													title="Volver a mostrar avisos">
													{busy ? (
														<Loader2 size={12} className="animate-spin" />
													) : (
														<RotateCcw size={12} />
													)}
													Restaurar
												</button>
											)}
											<Link
												to={pathFor(row.model, row.period)}
												className="text-xs font-bold text-gray-500 hover:text-rose-700">
												Abrir
											</Link>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
};
