import React, { useMemo, useState } from "react";
import { computeModelo130 } from "../../../utils/tax/modelo130";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { TaxBoxesMirror, TaxAuditAccordion, TaxEntriesTable } from "../shared/TaxBoxesMirror";
import { TaxPresentationToggle } from "../shared/TaxPresentationToggle";
import { formatCurrency } from "../../../utils/format";

export const Modelo130View = ({
	entries = [],
	declarations = [],
	upsertDeclaration,
	showToast,
}) => {
	const currentYear = new Date().getFullYear();
	const [year, setYear] = useState(currentYear);
	const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));

	const data = useMemo(
		() => computeModelo130(entries, year, quarter, declarations),
		[entries, year, quarter, declarations],
	);

	const declaration = declarations.find(
		(d) => d.model === "130" && Number(d.year) === year && d.period === `T${quarter}`,
	);

	const hasEstimatedPrev = data.previousPayments.some((p) => p.source === "estimated");

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Modelo 130 · IRPF</h2>
					<p className="text-sm text-gray-500 mt-1">
						Cálculo <strong>acumulativo YTD</strong> (1 ene → fin del trimestre). Régimen estimación
						directa.
					</p>
				</div>
				<TaxPeriodToolbar
					year={year}
					setYear={setYear}
					quarter={quarter}
					setQuarter={setQuarter}
				/>
			</div>

			{data.casilla02 === 0 && (
				<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
					⚠️ Cero gastos deducibles detectados. ¿Seguro que has contabilizado las cuotas de
					autónomo de Christine y las compras de material del trimestre?
				</div>
			)}

			{hasEstimatedPrev && (
				<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					Algunos trimestres anteriores no están marcados como presentados: la Casilla 07 usa el
					importe <em>estimado</em> de esos periodos. Márcalos presentados para fijar el histórico.
				</div>
			)}

			<div className="grid lg:grid-cols-2 gap-6">
				<TaxBoxesMirror boxes={data.boxes} highlightId="19" />
				<div className="space-y-4">
					<div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
						<p>
							Periodo computado:{" "}
							<strong>
								{data.startDate} → {data.endDate}
							</strong>
						</p>
						{data.previousPayments.length > 0 && (
							<ul className="mt-2 space-y-1">
								{data.previousPayments.map((p) => (
									<li key={p.period}>
										{p.period}: {formatCurrency(p.amount)}{" "}
										<span className="text-xs text-gray-400">
											({p.source === "presented" ? "presentado" : "estimado"})
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
					<TaxPresentationToggle
						model="130"
						year={year}
						period={`T${quarter}`}
						resultAmount={data.casilla19}
						declaration={declaration}
						upsertDeclaration={upsertDeclaration}
						showToast={showToast}
					/>
				</div>
			</div>

			<TaxAuditAccordion title="Auditoría · ingresos YTD">
				<TaxEntriesTable entries={data.audit.incomes} />
			</TaxAuditAccordion>
			<TaxAuditAccordion title="Auditoría · gastos deducibles YTD">
				<TaxEntriesTable entries={data.audit.expenses} />
			</TaxAuditAccordion>
			{data.audit.amortizacion > 0 && (
				<TaxAuditAccordion title={`Amortización YTD · ${formatCurrency(data.audit.amortizacion)}`}>
					<ul className="text-sm space-y-1">
						{data.audit.amortAssets.map((a) => (
							<li key={a.id}>
								{a.description}: {formatCurrency(a.deduced)}
							</li>
						))}
					</ul>
				</TaxAuditAccordion>
			)}
		</div>
	);
};
