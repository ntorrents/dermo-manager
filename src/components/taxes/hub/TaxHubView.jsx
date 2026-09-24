import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
	FileText,
	AlertTriangle,
	ChevronRight,
	Landmark,
	CalendarClock,
} from "lucide-react";
import { getActiveTaxAlerts } from "../../../utils/tax/deadlines";
import { computeModelo130 } from "../../../utils/tax/modelo130";
import { computeModelo303 } from "../../../utils/tax/modelo303";
import { formatCurrency } from "../../../utils/format";

const LINKS = [
	{ to: "/fiscalidad/trimestral/130", label: "Modelo 130", hint: "IRPF · YTD" },
	{ to: "/fiscalidad/trimestral/303", label: "Modelo 303", hint: "IVA · trimestre" },
	{ to: "/fiscalidad/trimestral/115", label: "Modelo 115", hint: "Alquiler" },
	{ to: "/fiscalidad/anual/390", label: "Modelo 390", hint: "Resumen IVA" },
	{ to: "/fiscalidad/anual/180", label: "Modelo 180", hint: "Resumen 115" },
	{ to: "/fiscalidad/renta", label: "Preparación Renta", hint: "Modelo 100" },
	{ to: "/fiscalidad/declaraciones", label: "Resumen Declaraciones", hint: "Estados + PDF" },
	{ to: "/fiscalidad/bienes-inversion", label: "Bienes de inversión", hint: "Amortizaciones" },
];

export const TaxHubView = ({ entries = [], declarations = [] }) => {
	const alerts = useMemo(() => getActiveTaxAlerts(declarations), [declarations]);
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
			<div>
				<h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
					<Landmark className="text-rose-700" /> Fiscalidad & AEAT
				</h2>
				<p className="text-sm text-gray-500 mt-1">
					Liquidaciones, resúmenes anuales y control de presentación.
				</p>
			</div>

			{alerts.length > 0 && (
				<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
					<p className="text-sm font-black text-amber-900 flex items-center gap-2">
						<AlertTriangle size={16} /> Plazos AEAT activos
					</p>
					<ul className="space-y-1">
						{alerts.map((a) => (
							<li key={a.id} className="text-sm text-amber-900 flex justify-between gap-2">
								<span>
									{a.title} — vence en {a.daysLeft} día(s)
								</span>
								<Link
									to={
										a.period === "ANUAL"
											? `/fiscalidad/anual/${a.model}`
											: `/fiscalidad/trimestral/${a.model}`
									}
									className="font-bold underline shrink-0">
									Ir
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="grid sm:grid-cols-2 gap-4">
				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						M130 T{quarter} {year} (YTD)
					</p>
					<p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">
						{formatCurrency(snap130.casilla19)}
					</p>
					<p className="text-xs text-gray-500 mt-1">Resultado a ingresar (Casilla 19)</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						M303 T{quarter} {year}
					</p>
					<p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">
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
