import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShoppingBag, FileDown, User, Zap } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { formatCurrency } from "../../../utils/format";
import { EmptyState } from "../../ui/EmptyState";
import { StatusChip } from "../../ui/StatusChip";
import { generateInvoice } from "../../../utils/invoiceGenerator";
import { useClients } from "../../../hooks/useClients";
import { useProducts } from "../../../hooks/useProducts";
import { QUERY_STALE } from "../../../providers/queryStale";
import { QuickSalePanel } from "./QuickSalePanel";

const UNLISTED = "Cliente sin ficha";

const resolveDocumentKind = (entry) => {
	if (entry?.document_kind === "ticket" || entry?.document_kind === "factura") {
		return entry.document_kind;
	}
	const num = String(entry?.invoice_number || "");
	if (num.startsWith("T")) return "ticket";
	if (num.startsWith("F")) return "factura";
	if (!entry?.client_id) return "ticket";
	return "factura";
};

export const ProductsSalesView = ({ user, showToast, clinic, profile }) => {
	const { clinicId } = useTenant();
	const queryClient = useQueryClient();
	const { clients } = useClients(user);
	const { products, sellCart, sellingCart } = useProducts(user);
	const [busyId, setBusyId] = useState(null);
	const [tpvOpen, setTpvOpen] = useState(false);

	const { data: sales = [], isLoading } = useQuery({
		queryKey: ["product_sales", clinicId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("finance_entries")
				.select("*")
				.eq("category", "Producto")
				.eq("type", "income")
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
		const tickets = sales.filter((e) => resolveDocumentKind(e) === "ticket").length;
		return { sum, count: sales.length, unlisted, tickets };
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

	const handleQuickSale = async (payload) => {
		try {
			const result = await sellCart(payload);
			const kind =
				result?.document_kind === "factura" ? "Factura" : "Ticket";
			const num = result?.invoice_number ? ` ${result.invoice_number}` : "";
			showToast?.(`${kind}${num} registrado · stock y caja actualizados`);
			queryClient.invalidateQueries({ queryKey: ["product_sales", clinicId] });
			setTpvOpen(false);
		} catch (e) {
			showToast?.(e.message || "No se pudo completar la venta", "error");
			throw e;
		}
	};

	if (isLoading) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-fg">
						Ventas de productos
					</h2>
					<p className="text-sm text-muted mt-1">
						Historial del catálogo. Ticket = simplificada · Factura = con paciente.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setTpvOpen(true)}
					className="btn-primary inline-flex items-center justify-center gap-2 py-2.5 px-4 shrink-0">
					<Zap size={16} />
					Venta rápida
				</button>
			</div>

			<div className="grid sm:grid-cols-4 gap-3">
				<div className="rounded-2xl border border-edge bg-surface p-4">
					<p className="text-[10px] font-bold uppercase tracking-widest text-muted">
						Ventas
					</p>
					<p className="text-2xl font-bold text-fg mt-1">{totals.count}</p>
				</div>
				<div className="rounded-2xl border border-edge bg-surface p-4">
					<p className="text-[10px] font-bold uppercase tracking-widest text-muted">
						Importe
					</p>
					<p className="text-2xl font-bold text-primary mt-1">
						{formatCurrency(totals.sum)}
					</p>
				</div>
				<div className="rounded-2xl border border-edge bg-surface p-4">
					<p className="text-[10px] font-bold uppercase tracking-widest text-muted">
						Tickets
					</p>
					<p className="text-2xl font-bold text-fg mt-1">{totals.tickets}</p>
				</div>
				<div className="rounded-2xl border border-edge bg-surface p-4">
					<p className="text-[10px] font-bold uppercase tracking-widest text-muted">
						Sin ficha
					</p>
					<p className="text-2xl font-bold text-fg mt-1">{totals.unlisted}</p>
				</div>
			</div>

			{sales.length === 0 ? (
				<EmptyState
					icon={ShoppingBag}
					title="Sin ventas aún"
					description="Usa «Venta rápida» o vende desde el catálogo."
					actionLabel="Venta rápida"
					onAction={() => setTpvOpen(true)}
				/>
			) : (
				<div className="rounded-2xl border border-edge bg-surface overflow-x-auto">
					<table className="w-full text-sm min-w-[720px]">
						<thead>
							<tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted text-left bg-surface-2">
								<th className="px-4 py-3">Fecha</th>
								<th className="px-4 py-3">Producto</th>
								<th className="px-4 py-3">Comprador</th>
								<th className="px-4 py-3">Tipo</th>
								<th className="px-4 py-3">Nº</th>
								<th className="px-4 py-3">Importe</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{sales.map((e) => {
								const kind = resolveDocumentKind(e);
								return (
									<tr key={e.id} className="border-t border-edge">
										<td className="px-4 py-3 text-muted whitespace-nowrap">
											{e.date}
										</td>
										<td className="px-4 py-3 font-semibold text-fg">
											{e.description?.split("(")[0]?.trim() || "Producto"}
											{e.quantity != null && (
												<span className="text-xs text-muted font-normal ml-1">
													× {e.quantity}
												</span>
											)}
										</td>
										<td className="px-4 py-3">
											<span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
												<User size={12} />
												{buyerLabel(e)}
											</span>
										</td>
										<td className="px-4 py-3">
											<StatusChip
												tone={kind === "factura" ? "info" : "neutral"}
												className="normal-case tracking-normal">
												{kind === "factura" ? "Factura" : "Ticket"}
											</StatusChip>
										</td>
										<td className="px-4 py-3 font-mono text-xs text-muted">
											{e.invoice_number || "—"}
										</td>
										<td className="px-4 py-3 font-bold text-fg tabular-nums">
											{formatCurrency(e.total_amount ?? e.amount)}
										</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												disabled={busyId === e.id}
												onClick={() => reprint(e)}
												className="inline-flex items-center gap-1 text-xs font-bold text-primary disabled:opacity-50">
												{busyId === e.id ? (
													<Loader2 size={12} className="animate-spin" />
												) : (
													<FileDown size={12} />
												)}
												PDF
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<QuickSalePanel
				isOpen={tpvOpen}
				onClose={() => setTpvOpen(false)}
				products={products}
				clients={clients}
				confirming={sellingCart}
				onConfirm={handleQuickSale}
			/>
		</div>
	);
};
