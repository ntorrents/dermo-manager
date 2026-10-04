import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SidePanel } from "../ui/SidePanel";
import { LoadingButton } from "../ui/LoadingButton";
import { PurchaseCostFields } from "./PurchaseCostFields";
import { GENERIC_PURCHASE_PROVIDER } from "../../utils/inventoryPurchase";
import { ProviderDatalist } from "../ui/ProviderDatalist";

const emptyLine = (mode) => ({
	itemId: "",
	name: "",
	quantity: "",
	unit: mode === "products" ? "ud" : "uds",
	totalCost: "",
	lotNumber: "",
	expiryDate: "",
	price: "",
	min_stock: "5",
});

/**
 * @param {"inventory"|"products"} mode
 */
export const InvoiceBatchPurchasePanel = ({
	isOpen,
	onClose,
	mode = "inventory",
	items = [],
	supplierDirectory = [],
	onSubmit,
	loading = false,
}) => {
	const isProducts = mode === "products";
	const [header, setHeader] = useState({
		purchaseDate: new Date().toISOString().split("T")[0],
		is_deductible: true,
		provider_name: "",
		supplier_nif: "",
		invoice_number: "",
		tax_rate: 21,
		priceMode: "included",
	});
	const [lines, setLines] = useState([emptyLine(mode)]);

	const reset = () => {
		setHeader({
			purchaseDate: new Date().toISOString().split("T")[0],
			is_deductible: true,
			provider_name: "",
			supplier_nif: "",
			invoice_number: "",
			tax_rate: 21,
			priceMode: "included",
		});
		setLines([emptyLine(mode)]);
	};

	const updateLine = (idx, patch) => {
		setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
	};

	const catalog = isProducts
		? items
		: items.filter((i) => (i.item_type || "material") === "material");

	const handlePickExisting = (idx, itemId) => {
		const item = catalog.find((i) => i.id === itemId);
		updateLine(idx, {
			itemId,
			name: item?.name || "",
			unit: item?.unit || (isProducts ? "ud" : "uds"),
			price: isProducts && item?.price != null ? String(item.price) : "",
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const payloadLines = lines.map((l) => {
			const existing = l.itemId ? catalog.find((i) => i.id === l.itemId) : null;
			return {
				...l,
				itemId: l.itemId || null,
				inventoryId: !isProducts ? l.itemId || null : null,
				productId: isProducts ? l.itemId || null : null,
				name: existing?.name || l.name,
			};
		});
		await onSubmit({ header, lines: payloadLines });
		reset();
		onClose();
	};

	return (
		<SidePanel
			isOpen={isOpen}
			onClose={() => {
				reset();
				onClose();
			}}
			title="Añadir desde factura única"
			subtitle={
				isProducts
					? "Una factura, varias líneas del catálogo"
					: "Una factura, varias líneas de stock clínico"
			}
			size="lg"
			footer={
				<LoadingButton
					loading={loading}
					type="submit"
					form="invoice-batch-form"
					className="w-full btn-primary py-3">
					Guardar factura ({lines.length} línea{lines.length === 1 ? "" : "s"})
				</LoadingButton>
			}>
			<form id="invoice-batch-form" onSubmit={handleSubmit} className="space-y-5">
				<section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
					<p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
						Datos de la factura
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Fecha compra *</span>
							<input
								type="date"
								required
								className="input-field"
								value={header.purchaseDate}
								onChange={(e) =>
									setHeader({ ...header, purchaseDate: e.target.value })
								}
							/>
						</label>
						<label className="flex items-center gap-2 pt-6">
							<input
								type="checkbox"
								checked={header.is_deductible}
								onChange={(e) =>
									setHeader({ ...header, is_deductible: e.target.checked })
								}
								className="rounded border-gray-300 text-rose-700"
							/>
							<span className="text-sm font-medium text-slate-800">
								Factura deducible (IVA)
							</span>
						</label>
					</div>
					{header.is_deductible && (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<label className="block space-y-1 sm:col-span-1">
								<span className="text-xs font-bold text-muted">Proveedor *</span>
								<input
									required
									list="invoice-batch-providers"
									className="input-field"
									value={header.provider_name}
									onChange={(e) =>
										setHeader({ ...header, provider_name: e.target.value })
									}
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">NIF *</span>
								<input
									required
									className="input-field"
									value={header.supplier_nif}
									onChange={(e) =>
										setHeader({ ...header, supplier_nif: e.target.value })
									}
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Nº factura *</span>
								<input
									required
									className="input-field"
									value={header.invoice_number}
									onChange={(e) =>
										setHeader({ ...header, invoice_number: e.target.value })
									}
								/>
							</label>
						</div>
					)}
					{!header.is_deductible && (
						<p className="text-xs text-slate-500">
							Sin deducir IVA. Origen opcional: {GENERIC_PURCHASE_PROVIDER}.
						</p>
					)}
					<PurchaseCostFields
						totalCost=""
						onTotalCostChange={() => {}}
						taxRate={header.tax_rate}
						onTaxRateChange={(v) => setHeader({ ...header, tax_rate: v })}
						priceMode={header.priceMode}
						onPriceModeChange={(v) => setHeader({ ...header, priceMode: v })}
						isDeductible={header.is_deductible}
						showAmount={false}
						showBreakdown={false}
					/>
				</section>

				<section className="space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
							Líneas
						</p>
						<button
							type="button"
							onClick={() => setLines((prev) => [...prev, emptyLine(mode)])}
							className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg">
							<Plus size={14} /> Añadir otra línea
						</button>
					</div>
					{lines.map((line, idx) => (
						<div
							key={idx}
							className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3 relative">
							<button
								type="button"
								disabled={lines.length === 1}
								onClick={() =>
									setLines((prev) => prev.filter((_, i) => i !== idx))
								}
								className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-rose-700 disabled:opacity-30"
								title="Quitar línea">
								<Trash2 size={14} />
							</button>
							<p className="text-xs font-bold text-slate-500">Línea {idx + 1}</p>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">
									{isProducts ? "Producto existente (opcional)" : "Material existente (opcional)"}
								</span>
								<select
									className="input-field"
									value={line.itemId}
									onChange={(e) => handlePickExisting(idx, e.target.value)}>
									<option value="">
										{isProducts ? "— Nuevo producto —" : "— Nuevo material —"}
									</option>
									{catalog.map((i) => (
										<option key={i.id} value={i.id}>
											{i.name}
										</option>
									))}
								</select>
							</label>
							{!line.itemId && (
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Nombre *</span>
									<input
										required
										className="input-field"
										value={line.name}
										onChange={(e) => updateLine(idx, { name: e.target.value })}
									/>
								</label>
							)}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Cantidad *</span>
									<input
										type="number"
										step="0.1"
										required
										className="input-field"
										value={line.quantity}
										onChange={(e) => updateLine(idx, { quantity: e.target.value })}
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Unidad</span>
									<select
										className="input-field"
										value={line.unit}
										disabled={!!line.itemId}
										onChange={(e) => updateLine(idx, { unit: e.target.value })}>
										{isProducts ? (
											<>
												<option value="ud">ud</option>
												<option value="caja">caja</option>
												<option value="pack">pack</option>
												<option value="ml">ml</option>
												<option value="g">g</option>
											</>
										) : (
											<>
												<option value="uds">uds</option>
												<option value="dosis">dosis</option>
												<option value="ml">ml</option>
												<option value="paq">paq</option>
												<option value="g">g</option>
											</>
										)}
									</select>
								</label>
								<label className="block space-y-1 sm:col-span-2">
									<span className="text-xs font-bold text-muted">
										Coste línea (€) *
									</span>
									<input
										type="number"
										step="0.01"
										required
										className="input-field font-bold text-rose-700"
										value={line.totalCost}
										onChange={(e) => updateLine(idx, { totalCost: e.target.value })}
									/>
								</label>
							</div>
							{isProducts && !line.itemId && (
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">
										PVP venta (€) *
									</span>
									<input
										type="number"
										step="0.01"
										required
										className="input-field"
										value={line.price}
										onChange={(e) => updateLine(idx, { price: e.target.value })}
										placeholder="Precio de venta al público"
									/>
								</label>
							)}
							{!isProducts && (
								<div className="grid grid-cols-2 gap-3">
									<label className="block space-y-1">
										<span className="text-xs font-bold text-muted">Nº lote *</span>
										<input
											required
											className="input-field"
											value={line.lotNumber}
											onChange={(e) =>
												updateLine(idx, { lotNumber: e.target.value })
											}
										/>
									</label>
									<label className="block space-y-1">
										<span className="text-xs font-bold text-muted">Caducidad *</span>
										<input
											type="date"
											required
											className="input-field"
											value={line.expiryDate}
											onChange={(e) =>
												updateLine(idx, { expiryDate: e.target.value })
											}
										/>
									</label>
								</div>
							)}
						</div>
					))}
				</section>
				<ProviderDatalist id="invoice-batch-providers" directory={supplierDirectory} />
			</form>
		</SidePanel>
	);
};
