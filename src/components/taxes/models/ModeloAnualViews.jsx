import React, { useMemo, useState } from "react";
import { computeModelo390, computeModelo180 } from "../../../utils/tax/modelo390";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { TaxBoxesMirror, TaxAuditAccordion, TaxEntriesTable } from "../shared/TaxBoxesMirror";
import { TaxPresentationToggle } from "../shared/TaxPresentationToggle";
import { formatCurrency } from "../../../utils/format";

export const Modelo390View = ({
	entries = [],
	declarations = [],
	upsertDeclaration,
	showToast,
}) => {
	const [year, setYear] = useState(new Date().getFullYear());
	const data = useMemo(
		() => computeModelo390(entries, year, declarations),
		[entries, year, declarations],
	);
	const declaration = declarations.find(
		(d) => d.model === "390" && Number(d.year) === year && d.period === "ANUAL",
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Modelo 390 · Resumen anual IVA</h2>
					<p className="text-sm text-gray-500 mt-1">Agregación de los cuatro Modelos 303 del ejercicio.</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
			</div>
			<div className="grid lg:grid-cols-2 gap-6">
				<div className="space-y-4">
					<TaxBoxesMirror boxes={data.boxes} highlightId="resultado" />
					<div className="rounded-xl border border-gray-100 bg-white p-4 text-sm space-y-1">
						{data.quarters.map((q) => (
							<p key={q.quarter}>
								T{q.quarter}: {formatCurrency(q.resultado)}
							</p>
						))}
					</div>
				</div>
				<TaxPresentationToggle
					model="390"
					year={year}
					period="ANUAL"
					resultAmount={data.resultado}
					declaration={declaration}
					upsertDeclaration={upsertDeclaration}
					showToast={showToast}
				/>
			</div>
		</div>
	);
};

export const Modelo180View = ({
	entries = [],
	declarations = [],
	upsertDeclaration,
	showToast,
}) => {
	const [year, setYear] = useState(new Date().getFullYear());
	const data = useMemo(() => computeModelo180(entries, year), [entries, year]);
	const declaration = declarations.find(
		(d) => d.model === "180" && Number(d.year) === year && d.period === "ANUAL",
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Modelo 180 · Resumen retenciones alquiler</h2>
					<p className="text-sm text-gray-500 mt-1">Resumen anual del Modelo 115.</p>
				</div>
				<TaxPeriodToolbar year={year} setYear={setYear} showQuarter={false} />
			</div>
			<div className="grid lg:grid-cols-2 gap-6">
				<TaxBoxesMirror boxes={data.boxes} highlightId="03" />
				<TaxPresentationToggle
					model="180"
					year={year}
					period="ANUAL"
					resultAmount={data.resultAmount}
					declaration={declaration}
					upsertDeclaration={upsertDeclaration}
					showToast={showToast}
				/>
			</div>
			<TaxAuditAccordion title="Líneas anuales 115">
				<TaxEntriesTable entries={data.audit.expenses} />
			</TaxAuditAccordion>
		</div>
	);
};
