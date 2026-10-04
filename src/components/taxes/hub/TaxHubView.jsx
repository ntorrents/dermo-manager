import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CalendarClock } from "lucide-react";
import { computeModelo130 } from "../../../utils/tax/modelo130";
import { computeModelo303 } from "../../../utils/tax/modelo303";
import { formatCurrency } from "../../../utils/format";

const taxLinks = (base = "/finanzas/fiscalidad") => [
	{ to: `${base}/trimestral/130`, label: "Modelo 130", hint: "IRPF · YTD" },
	{ to: `${base}/trimestral/303`, label: "Modelo 303", hint: "IVA · trimestre" },
	{ to: `${base}/trimestral/115`, label: "Modelo 115", hint: "Alquiler" },
	{ to: `${base}/anual/390`, label: "Modelo 390", hint: "Resumen IVA" },
	{ to: `${base}/anual/180`, label: "Modelo 180", hint: "Resumen 115" },
	{ to: `${base}/renta`, label: "Preparación Renta", hint: "Modelo 100" },
	{ to: `${base}/declaraciones`, label: "Resumen Declaraciones", hint: "Estados + PDF" },
	{ to: `${base}/bienes-inversion`, label: "Bienes de inversión", hint: "Amortizaciones" },
];

export const TaxHubView = ({
	entries = [],
	declarations = [],
	taxBasePath = "/finanzas/fiscalidad",
}) => {
	const LINKS = taxLinks(taxBasePath);
	const year = new Date().getFullYear();
	const quarter = Math.floor((new Date().getMonth() + 3) / 3);

	const snap130 = useMemo(
		() => computeModelo130(entries, year, quarter, declarations),
		[entries, year, quarter, declarations],
	);
	const snap303 = useMemo(
		() => computeModelo303(entries, year, quarter, declarations),
		[entries, year, quarter, declarations],
	);

	return (
		<div className="space-y-8">
			<div className="grid sm:grid-cols-2 gap-4">
				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						M130 T{quarter} {year} (YTD)
					</p>
					<p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tabular-nums">
						{formatCurrency(snap130.casilla19)}
					</p>
					<p className="text-xs text-gray-500 mt-1">Resultado a ingresar (Casilla 19)</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						M303 T{quarter} {year}
					</p>
					<p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tabular-nums">
						{formatCurrency(snap303.resultado)}
					</p>
					<p className="text-xs text-gray-500 mt-1">Liquidación IVA del trimestre</p>
				</div>
			</div>

			<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{LINKS.map((l) => (
					<Link
						key={l.to}
						to={l.to}
						className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-rose-200 hover:shadow-sm transition group">
						<p className="font-bold text-gray-900 group-hover:text-rose-700 flex items-center justify-between">
							{l.label} <ChevronRight size={16} className="opacity-40" />
						</p>
						<p className="text-xs text-gray-400 mt-1">{l.hint}</p>
					</Link>
				))}
			</div>

			<p className="text-xs text-gray-400 flex items-center gap-1.5">
				<CalendarClock size={12} />
				Las ventanas fiscales se inyectan en Agenda como eventos no clínicos (
				<code className="text-[10px]">tax_deadline</code>).
			</p>
		</div>
	);
};
