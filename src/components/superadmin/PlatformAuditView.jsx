import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { supabase } from "../../services/supabase";

const FILTERS = [
	{ id: null, label: "Todos (importantes)" },
	{ id: "system_error", label: "Errores / borrados" },
	{ id: "admin_access", label: "Accesos admin" },
	{ id: "critical_config", label: "Config crítica" },
];

const SEV = {
	error: "bg-rose-500/20 text-rose-200",
	warning: "bg-amber-500/20 text-amber-200",
	info: "bg-sky-500/20 text-sky-200",
};

export const PlatformAuditView = () => {
	const [category, setCategory] = useState(null);
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [openId, setOpenId] = useState(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			const { data, error: err } = await supabase.rpc("platform_important_logs", {
				p_category: category,
				p_limit: 150,
			});
			if (cancelled) return;
			if (err) setError(err.message);
			else setRows(data || []);
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [category]);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<ScrollText className="text-violet-400" size={26} />
				<div>
					<h2 className="text-xl font-black text-white">Logs globales</h2>
					<p className="text-sm text-slate-400">Solo eventos de importancia (sin ruido)</p>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{FILTERS.map((f) => (
					<button
						key={String(f.id)}
						type="button"
						onClick={() => setCategory(f.id)}
						className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
							category === f.id
								? "bg-violet-600 text-white"
								: "bg-white/5 text-slate-300 hover:bg-white/10"
						}`}>
						{f.label}
					</button>
				))}
			</div>

			{error && (
				<p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
					{error}
				</p>
			)}

			<div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
				{loading ? (
					<div className="p-10 flex justify-center">
						<Loader2 className="animate-spin text-violet-400" size={28} />
					</div>
				) : rows.length === 0 ? (
					<p className="p-8 text-sm text-slate-500 text-center">Sin eventos en este filtro.</p>
				) : (
					<table className="w-full text-sm min-w-[720px]">
						<thead>
							<tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 text-left">
								<th className="px-4 py-3">Fecha</th>
								<th className="px-4 py-3">Clínica</th>
								<th className="px-4 py-3">Usuario</th>
								<th className="px-4 py-3">Gravedad</th>
								<th className="px-4 py-3">Evento</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => {
								const open = openId === r.id;
								return (
									<React.Fragment key={r.id}>
										<tr className="border-t border-white/5">
											<td className="px-4 py-3 text-slate-300 whitespace-nowrap">
												{r.created_at
													? new Date(r.created_at).toLocaleString("es-ES")
													: "—"}
											</td>
											<td className="px-4 py-3 font-semibold text-white">
												{r.clinic_name || "—"}
											</td>
											<td className="px-4 py-3 text-slate-300">{r.user_email || "—"}</td>
											<td className="px-4 py-3">
												<span
													className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase ${
														SEV[r.severity] || SEV.info
													}`}>
													{r.severity}
												</span>
											</td>
											<td className="px-4 py-3 text-slate-200 max-w-[240px] truncate">
												{r.title}
											</td>
											<td className="px-4 py-3 text-right">
												<button
													type="button"
													onClick={() => setOpenId(open ? null : r.id)}
													className="inline-flex items-center gap-1 text-xs font-bold text-violet-300">
													{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
													Detalle
												</button>
											</td>
										</tr>
										{open && (
											<tr className="bg-black/30">
												<td colSpan={6} className="px-4 py-3">
													<pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono">
														{JSON.stringify(r.detail, null, 2)}
													</pre>
													<p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider">
														{r.source} · {r.category}
													</p>
												</td>
											</tr>
										)}
									</React.Fragment>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
};
