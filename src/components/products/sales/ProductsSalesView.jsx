import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag, FileDown, User } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { formatCurrency } from "../../../utils/format";
import { EmptyState } from "../../ui/EmptyState";
import { generateInvoice } from "../../../utils/invoiceGenerator";
import { useClients } from "../../../hooks/useClients";
import { QUERY_STALE } from "../../../providers/queryStale";

const UNLISTED = "Cliente sin ficha";

export const ProductsSalesView = ({ user, showToast, clinic, profile }) => {
	const { clinicId } = useTenant();
	const { clients } = useClients(user);
	const [busyId, setBusyId] = useState(null);

	const { data: sales = [], isLoading } = useQuery({
		queryKey: ["product_sales", clinicId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("finance_entries")
				.select("*")
				.eq("category", "Producto")
				.eq("activo", true)
				.order("date", { ascending: false })
				.limit(100);
			if (error) throw error;
			return data || [];
		},
		enabled: !!clinicId && !!user?.id,
		staleTime: QUERY_STALE.operational,
	});

	const clientById = useMemo(
		() => Object.fromEntries((clients || []).map((c) => [c.id, c])),
		[clients],
	);

	const totals = useMemo(() => {
		const sum = sales.reduce((a, e) => a + (Number(e.total_amount ?? e.amount) || 0), 0);
		const unlisted = sales.filter((e) => !e.client_id).length;
		return { sum, count: sales.length, unlisted };
	}, [sales]);

	const buyerLabel = (entry) => {
		if (entry.client_id) {
			const c = clientById[entry.client_id];
			if (c) return [c.name, c.surname].filter(Boolean).join(" ");
			return "Cliente (ficha)";
		}
		return entry.buyer_name || UNLISTED;
	};

	const reprint = async (entry) => {
		setBusyId(entry.id);
		try {
			let clientPayload = null;
			if (entry.client_id) {
				clientPayload = clientById[entry.client_id] || null;
			}
			if (!clientPayload) {
				clientPayload = { walkIn: true, name: "" };
			}
			await generateInvoice(entry, clientPayload, clinic, profile);
			showToast?.("PDF generado");
		} catch (e) {
			showToast?.(e.message || "Error al generar PDF", "error");
		} finally {
			setBusyId(null);
		}
	};

	if (isLoading) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-rose-700" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-black text-gray-900">Ventas de productos</h2>
				<p className="text-sm text-gray-500 mt-1">
					Historial de ventas del catálogo. En factura sin ficha aparece como{" "}
					<em>Consumidor final</em>.
				</p>
			</div>

			<div className="grid sm:grid-cols-3 gap-3">
				<div className="rounded-2xl border border-gray-100 bg-white p-4">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						Ventas
					</p>
					<p className="text-2xl font-black text-gray-900 mt-1">{totals.count}</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-4">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						Importe
					</p>
					<p className="text-2xl font-black text-rose-700 mt-1">
						{formatCurrency(totals.sum)}
					</p>
				</div>
				<div className="rounded-2xl border border-gray-100 bg-white p-4">
					<p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
						Sin ficha
					</p>
					<p className="text-2xl font-black text-gray-900 mt-1">{totals.unlisted}</p>
				</div>
			</div>

			{sales.length === 0 ? (
				<EmptyState
					icon={ShoppingBag}
					title="Sin ventas aún"
					description="Cuando vendas un producto desde el catálogo, aparecerá aquí."
				/>
			) : (
				<div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
					<table className="w-full text-sm min-w-[640px]">
						<thead>
							<tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 text-left">
								<th className="px-4 py-3">Fecha</th>
								<th className="px-4 py-3">Producto</th>
								<th className="px-4 py-3">Comprador</th>
								<th className="px-4 py-3">Factura</th>
								<th className="px-4 py-3">Importe</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{sales.map((e) => (
								<tr key={e.id} className="border-t border-gray-50">
									<td className="px-4 py-3 text-gray-600 whitespace-nowrap">
										{e.date}
									</td>
									<td className="px-4 py-3 font-semibold text-gray-900">
										{e.description?.split("(")[0]?.trim() || "Producto"}
										{e.quantity != null && (
											<span className="text-xs text-gray-400 font-normal ml-1">
												× {e.quantity}
											</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600">
											<User size={12} />
											{buyerLabel(e)}
										</span>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-gray-500">
										{e.invoice_number || "—"}
									</td>
									<td className="px-4 py-3 font-bold text-gray-900 tabular-nums">
										{formatCurrency(e.total_amount ?? e.amount)}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											disabled={busyId === e.id}
											onClick={() => reprint(e)}
											className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 disabled:opacity-50">
											{busyId === e.id ? (
												<Loader2 size={12} className="animate-spin" />
											) : (
												<FileDown size={12} />
											)}
											PDF
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};
