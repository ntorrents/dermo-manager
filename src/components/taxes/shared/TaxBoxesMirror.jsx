import React from "react";
import { formatCurrency } from "../../../utils/format";

export const TaxBoxesMirror = ({ boxes = [], highlightId }) => (
	<div className="space-y-2">
		{boxes.map((box) => {
			const highlight = highlightId && box.id === highlightId;
			const isCount =
				box.id === "01" && String(box.label).toLowerCase().includes("perceptor");
			return (
				<div
					key={box.id}
					className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
						highlight
							? "border-rose-300 bg-rose-50"
							: "border-gray-100 bg-white"
					}`}>
					<div className="min-w-0">
						<span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
							Casilla {box.id}
						</span>
						<p className="text-sm font-semibold text-gray-800 truncate">{box.label}</p>
					</div>
					<p
						className={`text-lg font-black tabular-nums shrink-0 ${
							highlight ? "text-rose-700" : "text-gray-900"
						}`}>
						{typeof box.value === "number"
							? isCount
								? box.value
								: formatCurrency(box.value)
							: box.value}
					</p>
				</div>
			);
		})}
	</div>
);

export const TaxAuditAccordion = ({ title = "Desglose / auditoría", children, defaultOpen = false }) => {
	const [open, setOpen] = React.useState(defaultOpen);
	return (
		<details
			open={open}
			onToggle={(e) => setOpen(e.target.open)}
			className="rounded-xl border border-gray-100 bg-gray-50/80">
			<summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-700">
				{title}
			</summary>
			<div className="border-t border-gray-100 px-4 py-3">{children}</div>
		</details>
	);
};

export const TaxEntriesTable = ({ entries = [], empty = "Sin movimientos" }) => {
	if (!entries.length) {
		return <p className="text-sm text-gray-400">{empty}</p>;
	}
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					<tr className="text-[10px] uppercase tracking-wider text-gray-400">
						<th className="pb-2 pr-3">Fecha</th>
						<th className="pb-2 pr-3">Descripción</th>
						<th className="pb-2 pr-3">Base</th>
						<th className="pb-2">IVA / IRPF</th>
					</tr>
				</thead>
				<tbody>
					{entries.map((e) => (
						<tr key={e.id} className="border-t border-gray-100">
							<td className="py-2 pr-3 whitespace-nowrap text-gray-600">{e.date}</td>
							<td className="py-2 pr-3 text-gray-800">
								{e.description || e.category || "—"}
								{e.invoice_number ? (
									<span className="ml-1 text-xs text-gray-400">#{e.invoice_number}</span>
								) : null}
							</td>
							<td className="py-2 pr-3 tabular-nums">
								{formatCurrency(Number(e.tax_base ?? e.base_amount ?? e.amount) || 0)}
							</td>
							<td className="py-2 tabular-nums text-gray-600">
								{Number(e.tax_amount) ? `IVA ${formatCurrency(e.tax_amount)}` : ""}
								{Number(e.irpf_amount) ? ` IRPF ${formatCurrency(e.irpf_amount)}` : ""}
								{!Number(e.tax_amount) && !Number(e.irpf_amount) ? "—" : ""}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
