import React, { useMemo, useState } from "react";
import { computePreparacionRenta } from "../../../utils/tax/renta";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { formatCurrency } from "../../../utils/format";

export const PreparacionRentaView = ({ entries = [], declarations = [] }) => {
	const [year, setYear] = useState(new Date().getFullYear());
	const data = useMemo(
		() => computePreparacionRenta(entries, year, declarations),
		[entries, year, declarations],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Preparación Renta · Modelo 100</h2>
					<p className="text-sm text-gray-500 mt-1">
						Resumen informativo para contrastar el borrador de Hacienda (primavera).
					</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
			</div>

			<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
				<section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
						Check 1
					</p>
					<h3 className="font-bold text-gray-900">{data.check1.label}</h3>
					<p className="text-3xl font-black text-gray-900 tabular-nums">
						{formatCurrency(data.check1.total)}
					</p>
					<ul className="text-xs text-gray-500 space-y-1">
						{data.check1.detail.map((p) => (
							<li key={p.period}>
								{p.period}: {formatCurrency(p.amount)} ({p.source === "presented" ? "AEAT" : "est."})
							</li>
						))}
					</ul>
					<p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 leading-relaxed">
						{data.check1.hint}
					</p>
				</section>

				<section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
						Check 2
					</p>
					<h3 className="font-bold text-gray-900">{data.check2.label}</h3>
					<p className="text-3xl font-black text-gray-900 tabular-nums">
						{formatCurrency(data.check2.beneficioNeto)}
					</p>
					<p className="text-sm text-gray-500">
						Ingresos {formatCurrency(data.check2.ingresos)} − Gastos{" "}
						{formatCurrency(data.check2.gastos)}
					</p>
				</section>

				<section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
						Check 3
					</p>
					<h3 className="font-bold text-gray-900">{data.check3.label}</h3>
					<p className="text-3xl font-black text-gray-900 tabular-nums">
						{formatCurrency(data.check3.retencionesSoportadas)}
					</p>
					<p className="text-xs text-gray-500">
						Cruce con retenciones que te practicaron en facturas emitidas B2B.
					</p>
				</section>

				<section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
						Check 4
					</p>
					<h3 className="font-bold text-gray-900">CHECK 4: {data.check4.label}</h3>
					<p className="text-3xl font-black text-gray-900 tabular-nums">
						{formatCurrency(data.check4.total)}
					</p>
					<p className="text-xs text-gray-500">
						{data.check4.rows.length} movimiento(s) detectado(s) por categoría/descripción
						(autónomo, RETA, Seguridad Social).
					</p>
					<p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 leading-relaxed">
						{data.check4.hint}
					</p>
				</section>
			</div>
		</div>
	);
};
