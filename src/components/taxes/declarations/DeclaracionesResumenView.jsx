import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, CheckCircle2, Circle } from "lucide-react";
import { getTaxDeclarationDownloadUrl } from "../../../services/taxDeclarationStorage";
import { formatCurrency } from "../../../utils/format";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";

const PERIODS_Q = ["T1", "T2", "T3", "T4"];

export const DeclaracionesResumenView = ({ declarations = [], showToast = () => {} }) => {
	const [year, setYear] = useState(new Date().getFullYear());

	const rows = useMemo(() => {
		const out = [];
		for (const model of ["130", "303", "115"]) {
			for (const period of PERIODS_Q) {
				const d = declarations.find(
					(x) => x.model === model && Number(x.year) === year && x.period === period,
				);
				out.push({ model, period, year, declaration: d });
			}
		}
		for (const model of ["390", "180"]) {
			const d = declarations.find(
				(x) => x.model === model && Number(x.year) === year && x.period === "ANUAL",
			);
			out.push({ model, period: "ANUAL", year, declaration: d });
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
						Estado de todas las liquidaciones del ejercicio y descarga de PDFs presentados.
					</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
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
							const done = row.declaration?.status === "completed";
							return (
								<tr key={`${row.model}-${row.period}`} className="border-t border-gray-50">
									<td className="px-4 py-3 font-bold text-gray-900">Modelo {row.model}</td>
									<td className="px-4 py-3 text-gray-600">{row.period}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center gap-1.5 text-xs font-bold ${
												done ? "text-emerald-700" : "text-gray-400"
											}`}>
											{done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
											{done ? "Presentado" : "Pendiente"}
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
