import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	Download,
	CheckCircle2,
	Circle,
	Clock,
	AlertTriangle,
	Hourglass,
} from "lucide-react";
import { getTaxDeclarationDownloadUrl } from "../../../services/taxDeclarationStorage";
import { formatCurrency } from "../../../utils/format";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { getDeclarationUiStatus } from "../../../utils/tax/deadlines";

const PERIODS_Q = ["T1", "T2", "T3", "T4"];

const STATUS_STYLES = {
	presented: {
		row: "border-t border-gray-50 bg-white",
		badge: "text-emerald-700 bg-emerald-50 border border-emerald-100",
		Icon: CheckCircle2,
	},
	upcoming: {
		row: "border-t border-gray-50 bg-white",
		badge: "text-slate-500 bg-slate-50 border border-slate-100",
		Icon: Hourglass,
	},
	pending: {
		row: "border-t border-rose-100 bg-rose-50/40",
		badge: "text-rose-700 bg-rose-100 border border-rose-200",
		Icon: Clock,
	},
	overdue: {
		row: "border-t border-amber-300 bg-amber-100/80",
		badge: "text-amber-950 bg-amber-200 border border-amber-400",
		Icon: AlertTriangle,
	},
};

export const DeclaracionesResumenView = ({ declarations = [], showToast = () => {} }) => {
	const [year, setYear] = useState(new Date().getFullYear());

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
		if (period === "ANUAL") return `/fiscalidad/anual/${model}`;
		return `/fiscalidad/trimestral/${model}`;
	};

	const download = async (storagePath) => {
		try {
			const url = await getTaxDeclarationDownloadUrl(storagePath);
			if (url) window.open(url, "_blank", "noopener,noreferrer");
		} catch (err) {
			showToast(err.message || "Error al descargar");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Resumen Declaraciones</h2>
					<p className="text-sm text-gray-500 mt-1">
						Estado según plazos AEAT: Próximamente · Pendiente (en plazo) · Retrasado ·
						Presentado.
					</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
			</div>

			<div className="flex flex-wrap gap-2 text-[11px] font-semibold">
				<span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
					Presentado
				</span>
				<span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
					Próximamente
				</span>
				<span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
					Pendiente (en plazo)
				</span>
				<span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-950 border border-amber-400">
					Retrasado
				</span>
			</div>

			<div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
				<table className="w-full text-sm text-left">
					<thead>
						<tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
							<th className="px-4 py-3">Modelo</th>
							<th className="px-4 py-3">Periodo</th>
							<th className="px-4 py-3">Estado</th>
							<th className="px-4 py-3">Resultado</th>
							<th className="px-4 py-3">PDF</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const style = STATUS_STYLES[row.status.id] || STATUS_STYLES.upcoming;
							const Icon = style.Icon;
							return (
								<tr key={`${row.model}-${row.period}`} className={style.row}>
									<td className="px-4 py-3 font-bold text-gray-900">Modelo {row.model}</td>
									<td className="px-4 py-3 text-gray-600">{row.period}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
											<Icon size={14} />
											{row.status.label}
											{row.status.id === "pending" && row.status.daysLeft != null
												? ` · ${row.status.daysLeft}d`
												: ""}
											{row.status.id === "overdue" && row.status.daysLate != null
												? ` · +${row.status.daysLate}d`
												: ""}
										</span>
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
									<td className="px-4 py-3 text-right">
										<Link
											to={pathFor(row.model, row.period)}
											className="text-xs font-bold text-gray-500 hover:text-rose-700">
											Abrir
										</Link>
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
