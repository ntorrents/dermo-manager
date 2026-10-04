import React, { useMemo, useState } from "react";
import {
	Loader2,
	Minus,
	Package,
	Plus,
	Search,
	ShoppingCart,
	Trash2,
	User,
} from "lucide-react";
import { SidePanel } from "../../ui/SidePanel";
import { formatCurrency } from "../../../utils/format";
import { toLocalYmd } from "../../../utils/dateUtils";

const COUNTER_LABEL = "Mostrador";

/**
 * TPV digital: catálogo (izq.) + carrito (der.) con flujo Ticket / Factura.
 */
export const QuickSalePanel = ({
	isOpen,
	onClose,
	products = [],
	clients = [],
	onConfirm,
	confirming = false,
}) => {
	const [query, setQuery] = useState("");
	const [cart, setCart] = useState([]); // { productId, name, unitPrice, qty, stock, image_url, unit }
	const [requestInvoice, setRequestInvoice] = useState(false);
	const [clientId, setClientId] = useState("");
	const [clientQuery, setClientQuery] = useState("");
	const [date, setDate] = useState(() => toLocalYmd());

	const reset = () => {
		setQuery("");
		setCart([]);
		setRequestInvoice(false);
		setClientId("");
		setClientQuery("");
		setDate(toLocalYmd());
	};

	const handleClose = () => {
		if (confirming) return;
		reset();
		onClose?.();
	};

	const catalog = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (products || [])
			.filter((p) => p.activo !== false)
			.filter((p) => Number(p.stock_qty) > 0)
			.filter((p) => {
				if (!q) return true;
				return (
					String(p.name || "")
						.toLowerCase()
						.includes(q) ||
					String(p.sku || "")
						.toLowerCase()
						.includes(q)
				);
			})
			.slice(0, 60);
	}, [products, query]);

	const clientsActive = useMemo(
		() => (clients || []).filter((c) => c.activo !== false),
		[clients],
	);

	const clientMatches = useMemo(() => {
		const q = clientQuery.trim().toLowerCase();
		if (!q) return clientsActive.slice(0, 8);
		return clientsActive
			.filter((c) => {
				const name = [c.name, c.surname].filter(Boolean).join(" ").toLowerCase();
				const phone = String(c.phone || c.mobile || "").toLowerCase();
				const nif = String(c.nif || "").toLowerCase();
				return name.includes(q) || phone.includes(q) || nif.includes(q);
			})
			.slice(0, 12);
	}, [clientsActive, clientQuery]);

	const selectedClient = useMemo(
		() => clientsActive.find((c) => c.id === clientId) || null,
		[clientsActive, clientId],
	);

	const cartTotal = useMemo(
		() => cart.reduce((acc, line) => acc + line.unitPrice * line.qty, 0),
		[cart],
	);

	const addProduct = (product) => {
		const stock = Number(product.stock_qty) || 0;
		if (stock <= 0) return;
		setCart((prev) => {
			const existing = prev.find((l) => l.productId === product.id);
			if (existing) {
				if (existing.qty >= stock) return prev;
				return prev.map((l) =>
					l.productId === product.id ? { ...l, qty: l.qty + 1 } : l,
				);
			}
			return [
				...prev,
				{
					productId: product.id,
					name: product.name,
					unitPrice: Number(product.price) || 0,
					qty: 1,
					stock,
					image_url: product.image_url || null,
					unit: product.unit || "ud",
				},
			];
		});
	};

	const setQty = (productId, next) => {
		setCart((prev) =>
			prev
				.map((l) => {
					if (l.productId !== productId) return l;
					const qty = Math.max(0, Math.min(l.stock, Math.floor(Number(next) || 0)));
					return { ...l, qty };
				})
				.filter((l) => l.qty > 0),
		);
	};

	const canConfirm =
		cart.length > 0 &&
		(!requestInvoice || !!clientId) &&
		!!date &&
		!confirming;

	const handleConfirm = async () => {
		if (!canConfirm) return;
		await onConfirm?.({
			lines: cart.map((l) => ({
				product_id: l.productId,
				quantity: l.qty,
				unit_price: l.unitPrice,
			})),
			date,
			clientId: requestInvoice ? clientId : null,
			buyerName: requestInvoice ? null : COUNTER_LABEL,
			documentKind: requestInvoice ? "factura" : "ticket",
		});
		reset();
	};

	return (
		<SidePanel
			isOpen={isOpen}
			onClose={handleClose}
			title="Venta rápida"
			subtitle="Por defecto Ticket a Mostrador (sin nombre). Marca factura solo si hay paciente."
			size="lg"
			footer={
				<div className="flex flex-col sm:flex-row sm:items-center gap-3">
					<div className="flex-1 min-w-0">
						<p className="text-[11px] font-bold uppercase tracking-wider text-muted">
							Total
						</p>
						<p className="text-xl font-bold text-fg tabular-nums">
							{formatCurrency(cartTotal)}
						</p>
						<p className="text-xs text-muted mt-0.5">
							{requestInvoice ? "Factura completa" : "Ticket (simplificada)"}
							{selectedClient
								? ` · ${[selectedClient.name, selectedClient.surname]
										.filter(Boolean)
										.join(" ")}`
								: !requestInvoice
									? ` · ${COUNTER_LABEL}`
									: ""}
						</p>
					</div>
					<button
						type="button"
						disabled={!canConfirm}
						onClick={handleConfirm}
						className="btn-primary inline-flex items-center justify-center gap-2 py-3 px-5 disabled:opacity-50 shrink-0">
						{confirming ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<ShoppingCart size={16} />
						)}
						Cobrar
					</button>
				</div>
			}>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[420px]">
				{/* Catálogo */}
				<section className="flex flex-col min-h-0 gap-3">
					<div className="relative">
						<Search
							size={16}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
						/>
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Buscar producto…"
							className="input-field pl-9"
							autoFocus
						/>
					</div>
					<ul className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[min(52vh,480px)] pr-0.5">
						{catalog.length === 0 ? (
							<li className="text-sm text-muted text-center py-10">
								Sin productos con stock
							</li>
						) : (
							catalog.map((p) => (
								<li key={p.id}>
									<button
										type="button"
										onClick={() => addProduct(p)}
										className="w-full text-left flex items-center gap-3 rounded-xl border border-edge bg-surface hover:bg-surface-2 px-3 py-2.5 transition-colors">
										{p.image_url ? (
											<img
												src={p.image_url}
												alt=""
												className="w-11 h-11 rounded-lg object-cover shrink-0 border border-edge"
											/>
										) : (
											<span className="w-11 h-11 rounded-lg bg-surface-2 border border-edge flex items-center justify-center text-muted shrink-0">
												<Package size={18} />
											</span>
										)}
										<div className="min-w-0 flex-1">
											<p className="text-sm font-semibold text-fg truncate">
												{p.name}
											</p>
											<p className="text-[11px] text-muted tabular-nums mt-0.5">
												Stock {Number(p.stock_qty)} {p.unit || "ud"}
											</p>
										</div>
										<span className="text-sm font-bold text-fg tabular-nums shrink-0">
											{formatCurrency(p.price)}
										</span>
									</button>
								</li>
							))
						)}
					</ul>
				</section>

				{/* Carrito */}
				<section className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface-2/60 p-3 sm:p-4">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
							<ShoppingCart size={13} /> Carrito
						</p>
						<span className="text-[11px] font-medium text-muted tabular-nums">
							{cart.length} {cart.length === 1 ? "línea" : "líneas"}
						</span>
					</div>

					{cart.length === 0 ? (
						<p className="text-sm text-muted text-center py-8">
							Añade productos desde el catálogo
						</p>
					) : (
						<ul className="space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-[min(36vh,320px)]">
							{cart.map((line) => (
								<li
									key={line.productId}
									className="rounded-xl border border-edge bg-surface px-3 py-2.5">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-sm font-semibold text-fg truncate">
												{line.name}
											</p>
											<p className="text-[11px] text-muted tabular-nums">
												{formatCurrency(line.unitPrice)} / {line.unit}
											</p>
										</div>
										<button
											type="button"
											onClick={() => setQty(line.productId, 0)}
											className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-surface-2"
											aria-label="Quitar">
											<Trash2 size={14} />
										</button>
									</div>
									<div className="mt-2 flex items-center justify-between gap-2">
										<div className="inline-flex items-center rounded-lg border border-edge overflow-hidden">
											<button
												type="button"
												onClick={() => setQty(line.productId, line.qty - 1)}
												className="h-8 w-8 inline-flex items-center justify-center text-muted hover:bg-surface-2"
												aria-label="Restar">
												<Minus size={14} />
											</button>
											<span className="w-9 text-center text-sm font-bold text-fg tabular-nums">
												{line.qty}
											</span>
											<button
												type="button"
												onClick={() => setQty(line.productId, line.qty + 1)}
												disabled={line.qty >= line.stock}
												className="h-8 w-8 inline-flex items-center justify-center text-muted hover:bg-surface-2 disabled:opacity-40"
												aria-label="Sumar">
												<Plus size={14} />
											</button>
										</div>
										<span className="text-sm font-bold text-fg tabular-nums">
											{formatCurrency(line.unitPrice * line.qty)}
										</span>
									</div>
								</li>
							))}
						</ul>
					)}

					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Fecha</span>
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="input-field"
						/>
					</label>

					<label className="flex items-start gap-3 rounded-xl border border-edge bg-surface px-3 py-3 cursor-pointer">
						<input
							type="checkbox"
							checked={requestInvoice}
							onChange={(e) => {
								const on = e.target.checked;
								setRequestInvoice(on);
								if (!on) {
									setClientId("");
									setClientQuery("");
								}
							}}
							className="mt-0.5 w-4 h-4 rounded border-edge text-primary focus:ring-primary"
						/>
						<span className="min-w-0">
							<span className="block text-sm font-semibold text-fg">
								Solicita factura completa
							</span>
							<span className="block text-xs text-muted mt-0.5 leading-snug">
								Desmarcado = ticket (factura simplificada) a mostrador, sin
								paciente.
							</span>
						</span>
					</label>

					{requestInvoice && (
						<div className="space-y-2 rounded-xl border border-edge bg-surface p-3">
							<p className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
								<User size={12} /> Paciente / NIF
							</p>
							<div className="relative">
								<Search
									size={14}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
								/>
								<input
									value={clientQuery}
									onChange={(e) => setClientQuery(e.target.value)}
									placeholder="Nombre, teléfono o NIF…"
									className="input-field pl-9"
								/>
							</div>
							{selectedClient ? (
								<div className="flex items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-fg truncate">
											{[selectedClient.name, selectedClient.surname]
												.filter(Boolean)
												.join(" ")}
										</p>
										<p className="text-[11px] text-muted tabular-nums">
											{selectedClient.nif || "Sin NIF"}
											{selectedClient.phone || selectedClient.mobile
												? ` · ${selectedClient.phone || selectedClient.mobile}`
												: ""}
										</p>
									</div>
									<button
										type="button"
										onClick={() => setClientId("")}
										className="text-xs font-bold text-muted hover:text-fg shrink-0">
										Cambiar
									</button>
								</div>
							) : (
								<ul className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
									{clientMatches.length === 0 ? (
										<li className="text-xs text-muted py-2 text-center">
											Sin coincidencias
										</li>
									) : (
										clientMatches.map((c) => (
											<li key={c.id}>
												<button
													type="button"
													onClick={() => {
														setClientId(c.id);
														setClientQuery(
															[c.name, c.surname].filter(Boolean).join(" "),
														);
													}}
													className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-surface-2 transition-colors">
													<p className="text-sm font-medium text-fg truncate">
														{[c.name, c.surname].filter(Boolean).join(" ")}
													</p>
													<p className="text-[11px] text-muted truncate">
														{[c.nif, c.phone || c.mobile]
															.filter(Boolean)
															.join(" · ") || "Sin datos fiscales"}
													</p>
												</button>
											</li>
										))
									)}
								</ul>
							)}
						</div>
					)}
				</section>
			</div>
		</SidePanel>
	);
};
