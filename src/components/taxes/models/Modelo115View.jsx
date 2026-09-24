import React, { useMemo, useState } from "react";
import { computeModelo115 } from "../../../utils/tax/modelo115";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { TaxBoxesMirror, TaxAuditAccordion, TaxEntriesTable } from "../shared/TaxBoxesMirror";
import { TaxPresentationToggle } from "../shared/TaxPresentationToggle";

export const Modelo115View = ({
	entries = [],
	declarations = [],
	upsertDeclaration,
	showToast,
}) => {
	const currentYear = new Date().getFullYear();
	const [year, setYear] = useState(currentYear);
	const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));

	const data = useMemo(() => computeModelo115(entries, year, quarter), [entries, year, quarter]);
	const declaration = declarations.find(
		(d) => d.model === "115" && Number(d.year) === year && d.period === `T${quarter}`,
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Modelo 115 · Retenciones alquiler</h2>
					<p className="text-sm text-gray-500 mt-1">
						Trimestre <strong>aislado</strong>. Incluye gastos con retención marcada como 115 o
						categoría/descripción de alquiler.
					</p>
				</div>
				<TaxPeriodToolbar
					year={year}
					setYear={setYear}
					quarter={quarter}
					setQuarter={setQuarter}
				/>
			</div>

			<div className="grid lg:grid-cols-2 gap-6">
				<TaxBoxesMirror boxes={data.boxes} highlightId="03" />
				<TaxPresentationToggle
					model="115"
					year={year}
					period={`T${quarter}`}
					resultAmount={data.resultAmount}
					declaration={declaration}
					upsertDeclaration={upsertDeclaration}
					showToast={showToast}
				/>
			</div>

			<TaxAuditAccordion title="Gastos de alquiler con retención">
				<TaxEntriesTable entries={data.audit.expenses} empty="No hay retenciones 115 en este trimestre" />
			</TaxAuditAccordion>
		</div>
	);
};
