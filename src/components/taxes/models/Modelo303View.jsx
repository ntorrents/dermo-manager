import React, { useMemo, useState } from "react";
import { computeModelo303 } from "../../../utils/tax/modelo303";
import { TaxPeriodToolbar } from "../shared/TaxPeriodToolbar";
import { TaxBoxesMirror, TaxAuditAccordion, TaxEntriesTable } from "../shared/TaxBoxesMirror";
import { TaxPresentationToggle } from "../shared/TaxPresentationToggle";
import { exportPre303LibrosTrimestre } from "../../../utils/aeatLibrosExport";
import { FileSpreadsheet } from "lucide-react";

export const Modelo303View = ({
	entries = [],
	clients = [],
	declarations = [],
	upsertDeclaration,
	showToast,
}) => {
	const currentYear = new Date().getFullYear();
	const [year, setYear] = useState(currentYear);
	const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));
	const [exporting, setExporting] = useState(false);

	const data = useMemo(
		() => computeModelo303(entries, year, quarter, declarations),
		[entries, year, quarter, declarations],
	);
	const declaration = declarations.find(
		(d) => d.model === "303" && Number(d.year) === year && d.period === `T${quarter}`,
	);

	const onExportLibros = async () => {
		setExporting(true);
		try {
			await exportPre303LibrosTrimestre(entries, clients, year, quarter);
			showToast("Libros Pre303 exportados");
		} catch (err) {
			console.error(err);
			showToast(err.message || "Error al exportar");
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-gray-900">Modelo 303 · IVA</h2>
					<p className="text-sm text-gray-500 mt-1">
						Liquidación <strong>aislada</strong> del trimestre seleccionado.
					</p>
				</div>
				<div className="flex flex-wrap gap-3 items-end">
					<TaxPeriodToolbar
						year={year}
						setYear={setYear}
						quarter={quarter}
						setQuarter={setQuarter}
					/>
					<button
						type="button"
						disabled={exporting}
						onClick={onExportLibros}
						className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50">
						<FileSpreadsheet size={16} /> Libros Pre303
					</button>
				</div>
			</div>

			{data.casilla110 > 0 && (
				<div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
					Casilla 110 = {data.casilla110.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}{" "}
					traída del resultado negativo del {data.previousPeriod} (marcado como presentado).
					Se resta antes de la Casilla 71.
				</div>
			)}

			<div className="grid lg:grid-cols-2 gap-6">
				<TaxBoxesMirror boxes={data.boxes} highlightId="71" />
				<TaxPresentationToggle
					model="303"
					year={year}
					period={`T${quarter}`}
					resultAmount={data.resultado}
					declaration={declaration}
					upsertDeclaration={upsertDeclaration}
					showToast={showToast}
				/>
			</div>

			<TaxAuditAccordion title="Facturas emitidas (IVA repercutido)">
				<TaxEntriesTable entries={data.audit.incomes} />
			</TaxAuditAccordion>
			<TaxAuditAccordion title="Facturas recibidas (IVA soportado)">
				<TaxEntriesTable entries={data.audit.expenses} />
			</TaxAuditAccordion>
		</div>
	);
};
