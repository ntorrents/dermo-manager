import React, { useMemo, useState } from "react";
import {
	Plus,
	Trash2,
	Edit2,
	ShoppingCart,
	Package,
	ImagePlus,
	Loader2,
	Heart,
	PackagePlus,
} from "lucide-react";
import { useProducts } from "../../../hooks/useProducts";
import { useClients } from "../../../hooks/useClients";
import { useTenant } from "../../../context/TenantContext";
import { ConfirmModal } from "../../ui/ConfirmModal";
import { SidePanel } from "../../ui/SidePanel";
import { EmptyState } from "../../ui/EmptyState";
import { StatusChip } from "../../ui/StatusChip";
import {
	FormSheet,
	FormSheetPrimary,
	FormSheetPreview,
	FormPreviewStat,
	FormDetails,
} from "../../ui/FormSheet";
import { ProviderDatalist } from "../../ui/ProviderDatalist";
import { IVA_OPTIONS, formatCurrency } from "../../../utils/format";
import { taxRateLabel } from "../../../utils/incomeTax";
import {
	uploadProductImage,
	removeProductImage,
} from "../../../services/productStorage";
import { generateInvoice } from "../../../utils/invoiceGenerator";
import { supabase } from "../../../services/supabase";
import {
	buildSupplierDirectory,
	matchProviderByName,
} from "../../../utils/supplierDirectory";
import { GENERIC_PURCHASE_PROVIDER } from "../../../utils/inventoryPurchase";

const UNLISTED_LABEL = "Cliente sin ficha";

const emptyCatalogForm = () => ({
	name: "",
	description: "",
	sku: "",
	price: "",
	tax_rate: 21,
	stock_qty: "0",
	unit: "ud",
	image_url: "",
	image_path: "",
	// compra inicial (solo alta)
	totalCost: "0",
	purchaseDate: new Date().toISOString().slice(0, 10),
	is_deductible: false,
	provider_name: "",
	supplier_nif: "",
	invoice_number: "",
	purchase_tax_rate: 21,
});

const emptyRestock = () => ({
	quantity: "1",
	totalCost: "0",
	purchaseDate: new Date().toISOString().slice(0, 10),
	is_deductible: false,
	provider_name: "",
	supplier_nif: "",
	invoice_number: "",
	purchase_tax_rate: 21,
});

export const ProductsCatalogView = ({
	user,
	showToast,
	clinic,
	profile,
	entries = [],
}) => {
	const { clinicId, canDeleteOperational, hasModule } = useTenant();
	const canPlanAmigo = hasModule("finance_plan_amigo");
	const {
		products,
		loading,
		saveProduct,
		saving,
		createProductWithPurchase,
		restockProduct,
		restocking,
		deleteProduct,
		sellProduct,
		selling,
	} = useProducts(user);
	const { clients } = useClients(user);

	const supplierDirectory = useMemo(
		() => buildSupplierDirectory(entries),
		[entries],
	);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState(emptyCatalogForm);
	const [imageFile, setImageFile] = useState(null);
	const [imagePreview, setImagePreview] = useState("");
	const [receiptFile, setReceiptFile] = useState(null);
	const [uploadingImg, setUploadingImg] = useState(false);

	const [deleteId, setDeleteId] = useState(null);
	const [restockTarget, setRestockTarget] = useState(null);
	const [restockForm, setRestockForm] = useState(emptyRestock);
	const [restockReceipt, setRestockReceipt] = useState(null);

	const [sellTarget, setSellTarget] = useState(null);
	const [sellForm, setSellForm] = useState({
		quantity: "1",
		unitPrice: "",
		date: new Date().toISOString().slice(0, 10),
		mode: "client",
		clientId: "",
		buyerName: "",
		notes: "",
		planAmigo: false,
	});

	const clientsActive = useMemo(
		() => (clients || []).filter((c) => c.activo !== false),
		[clients],
	);

	const unitCostPreview = useMemo(() => {
		const stock = Number(String(form.stock_qty).replace(",", "."));
		const cost = Number(String(form.totalCost).replace(",", "."));
		if (!Number.isFinite(stock) || stock <= 0) return null;
		if (!Number.isFinite(cost) || cost < 0) return null;
		return cost / stock;
	}, [form.stock_qty, form.totalCost]);

	const marginPreview = useMemo(() => {
		const pvp = Number(String(form.price).replace(",", "."));
		if (!Number.isFinite(pvp) || unitCostPreview == null) return null;
		return pvp - unitCostPreview;
	}, [form.price, unitCostPreview]);

	const restockUnitCost = useMemo(() => {
		const qty = Number(String(restockForm.quantity).replace(",", "."));
		const cost = Number(String(restockForm.totalCost).replace(",", "."));
		if (!Number.isFinite(qty) || qty <= 0) return null;
		if (!Number.isFinite(cost) || cost < 0) return null;
		return cost / qty;
	}, [restockForm.quantity, restockForm.totalCost]);

	const openCreate = () => {
		setEditing(null);
		setForm(emptyCatalogForm());
		setImageFile(null);
		setImagePreview("");
		setReceiptFile(null);
		setIsModalOpen(true);
	};

	const openEdit = (p) => {
		setEditing(p);
		setForm({
			...emptyCatalogForm(),
			name: p.name || "",
			description: p.description || "",
			sku: p.sku || "",
			price: String(p.price ?? ""),
			tax_rate: Number(p.tax_rate) ?? 21,
			stock_qty: String(p.stock_qty ?? 0),
			unit: p.unit || "ud",
			image_url: p.image_url || "",
			image_path: p.image_path || "",
		});
		setImageFile(null);
		setImagePreview(p.image_url || "");
		setReceiptFile(null);
		setIsModalOpen(true);
	};

	const openRestock = (p) => {
		setRestockTarget(p);
		setRestockForm(emptyRestock());
		setRestockReceipt(null);
	};

	const onPickImage = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setImageFile(file);
		setImagePreview(URL.createObjectURL(file));
	};

	const applyProviderFromName = (providerName, setter) => {
		const match = matchProviderByName(supplierDirectory, providerName);
		if (!match) return;
		setter((prev) => ({
			...prev,
			provider_name: match.name || prev.provider_name,
			supplier_nif: match.nif || prev.supplier_nif,
		}));
	};

	const pickKnownProvider = (indexValue, setter) => {
		const idx = Number(indexValue);
		if (!Number.isFinite(idx) || idx < 0) return;
		const match = supplierDirectory[idx];
		if (!match) return;
		setter((prev) => ({
			...prev,
			provider_name: match.name || "",
			supplier_nif: match.nif || "",
		}));
	};

	const save = async () => {
		if (!form.name.trim()) {
			showToast?.("Nombre obligatorio", "error");
			return;
		}
		const price = Number(String(form.price).replace(",", "."));
		if (!Number.isFinite(price) || price < 0) {
			showToast?.("PVP inválido", "error");
			return;
		}

		try {
			setUploadingImg(true);
			let image_url = form.image_url || null;
			let image_path = form.image_path || null;

			if (editing?.id) {
				let saved = await saveProduct({
					id: editing.id,
					name: form.name.trim(),
					description: form.description.trim() || null,
					sku: form.sku.trim() || null,
					price,
					tax_rate: Number(form.tax_rate) || 0,
					unit: form.unit.trim() || "ud",
					image_url,
					image_path,
				});
				if (imageFile && user?.id && clinicId) {
					const uploaded = await uploadProductImage(
						user.id,
						clinicId,
						imageFile,
						editing.id,
					);
					if (uploaded.publicUrl) {
						if (image_path && image_path !== uploaded.path) {
							await removeProductImage(image_path).catch(() => {});
						}
						await saveProduct({
							id: editing.id,
							image_url: uploaded.publicUrl,
							image_path: uploaded.path,
						});
					}
				}
				showToast?.("Producto actualizado");
			} else {
				const stock = Number(String(form.stock_qty).replace(",", "."));
				const totalCost = Number(String(form.totalCost).replace(",", "."));
				if (!Number.isFinite(stock) || stock < 0) {
					showToast?.("Stock inválido", "error");
					return;
				}
				if (!Number.isFinite(totalCost) || totalCost < 0) {
					showToast?.("Coste inválido (0 si es gratis)", "error");
					return;
				}

				const saved = await createProductWithPurchase({
					product: {
						name: form.name.trim(),
						description: form.description.trim() || null,
						sku: form.sku.trim() || null,
						price,
						tax_rate: Number(form.tax_rate) || 0,
						stock_qty: stock,
						unit: form.unit.trim() || "ud",
						image_url,
						image_path,
					},
					purchase: {
						totalCost,
						purchaseDate: form.purchaseDate,
						is_deductible: form.is_deductible,
						provider_name: form.provider_name,
						supplier_nif: form.supplier_nif,
						invoice_number: form.invoice_number,
						purchase_tax_rate: form.purchase_tax_rate,
					},
					receiptFile: form.is_deductible ? receiptFile : null,
				});

				if (imageFile && user?.id && clinicId && saved?.id) {
					const uploaded = await uploadProductImage(
						user.id,
						clinicId,
						imageFile,
						saved.id,
					);
					if (uploaded.publicUrl) {
						await saveProduct({
							id: saved.id,
							image_url: uploaded.publicUrl,
							image_path: uploaded.path,
						});
					}
				}
				showToast?.("Producto creado");
			}

			setIsModalOpen(false);
		} catch (e) {
			showToast?.(e.message || "Error al guardar", "error");
		} finally {
			setUploadingImg(false);
		}
	};

	const confirmRestock = async () => {
		if (!restockTarget) return;
		try {
			await restockProduct({
				product: restockTarget,
				purchase: {
					quantity: restockForm.quantity,
					totalCost: restockForm.totalCost,
					purchaseDate: restockForm.purchaseDate,
					is_deductible: restockForm.is_deductible,
					provider_name: restockForm.provider_name,
					supplier_nif: restockForm.supplier_nif,
					invoice_number: restockForm.invoice_number,
					purchase_tax_rate: restockForm.purchase_tax_rate,
				},
				receiptFile: restockForm.is_deductible ? restockReceipt : null,
			});
			showToast?.("Stock repuesto");
			setRestockTarget(null);
		} catch (e) {
			showToast?.(e.message || "Error al reponer", "error");
		}
	};

	const openSell = (p) => {
		setSellTarget(p);
		setSellForm({
			quantity: "1",
			unitPrice: String(p.price ?? ""),
			date: new Date().toISOString().slice(0, 10),
			mode: "client",
			clientId: "",
			buyerName: "",
			notes: "",
			planAmigo: false,
		});
	};

	const confirmSell = async () => {
		if (!sellTarget) return;
		const qty = Number(String(sellForm.quantity).replace(",", "."));
		const unitPrice = Number(String(sellForm.unitPrice).replace(",", "."));
		if (!Number.isFinite(qty) || qty <= 0) {
			showToast?.("Cantidad inválida", "error");
			return;
		}
		if (!Number.isFinite(unitPrice) || unitPrice < 0) {
			showToast?.("Precio inválido", "error");
			return;
		}
		if (qty > Number(sellTarget.stock_qty)) {
			showToast?.("Stock insuficiente", "error");
			return;
		}
		if (sellForm.mode === "client" && !sellForm.clientId) {
			showToast?.("Elige un cliente o usa «sin ficha»", "error");
			return;
		}

		try {
			const entryId = await sellProduct({
				productId: sellTarget.id,
				quantity: qty,
				unitPrice,
				date: sellForm.date,
				clientId: sellForm.mode === "client" ? sellForm.clientId : null,
				buyerName:
					sellForm.mode === "anonymous"
						? sellForm.buyerName.trim() || UNLISTED_LABEL
						: null,
				issueInvoice: !sellForm.planAmigo,
				internalNotes: sellForm.notes.trim() || null,
				planAmigo: canPlanAmigo && !!sellForm.planAmigo,
			});

			if (entryId && !(canPlanAmigo && sellForm.planAmigo)) {
				const { data: entry } = await supabase
					.from("finance_entries")
					.select("*")
					.eq("id", entryId)
					.maybeSingle();
				if (entry) {
					let clientPayload = null;
					if (entry.client_id) {
						clientPayload =
							clientsActive.find((c) => c.id === entry.client_id) || null;
					}
					if (!clientPayload) {
						clientPayload = { walkIn: true, name: "" };
					}
					try {
						await generateInvoice(entry, clientPayload, clinic, profile);
					} catch (pdfErr) {
						console.warn(pdfErr);
						showToast?.("Venta OK; no se pudo generar el PDF", "error");
						setSellTarget(null);
						return;
					}
				}
			}

			showToast?.(
				canPlanAmigo && sellForm.planAmigo
					? "Venta Plan Amigo registrada (sin factura fiscal)"
					: "Venta registrada y ticket/factura generado",
			);
			setSellTarget(null);
		} catch (e) {
			showToast?.(e.message || "Error al vender", "error");
		}
	};

	const purchaseFields = (data, setData, file, setFile, idPrefix) => (
		<section className="space-y-3 rounded-2xl border border-gray-100 bg-slate-50/80 p-4">
			<p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
				Compra / entrada de stock
			</p>
			<p className="text-xs text-gray-500 leading-relaxed">
				Indica lo que te costó el lote (0 € si es regalo o muestra). El coste por
				unidad se calcula solo para ver el margen al vender.
			</p>
			<div className="grid grid-cols-2 gap-3">
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">
						Coste total del lote (€)
					</span>
					<input
						value={data.totalCost}
						onChange={(e) => setData({ ...data, totalCost: e.target.value })}
						inputMode="decimal"
						placeholder="0"
						className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
					/>
				</label>
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">Fecha de compra</span>
					<input
						type="date"
						value={data.purchaseDate}
						onChange={(e) => setData({ ...data, purchaseDate: e.target.value })}
						className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
					/>
				</label>
			</div>

			<label className="flex items-start gap-3 rounded-xl border border-white bg-white px-3 py-3">
				<input
					type="checkbox"
					checked={data.is_deductible}
					onChange={(e) =>
						setData({
							...data,
							is_deductible: e.target.checked,
							...(e.target.checked
								? {}
								: { provider_name: "", supplier_nif: "", invoice_number: "" }),
						})
					}
					className="mt-0.5 rounded border-gray-300 text-rose-700"
				/>
				<span>
					<span className="block text-sm font-bold text-gray-800">
						Tengo factura deducible
					</span>
					<span className="text-xs text-gray-500">
						Proveedor, NIF, nº factura y archivo (como en stock).
					</span>
				</span>
			</label>

			{data.is_deductible ? (
				<div className="space-y-3">
					{supplierDirectory.length > 0 && (
						<label className="block space-y-1">
							<span className="text-xs font-bold text-gray-600">
								Proveedor guardado
							</span>
							<select
								value=""
								onChange={(e) => pickKnownProvider(e.target.value, setData)}
								className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
								<option value="">— Elegir de la lista —</option>
								{supplierDirectory.map((s, idx) => (
									<option key={`${s.nif}-${s.name}-${idx}`} value={idx}>
										{s.name}
										{s.nif ? ` (${s.nif})` : ""}
									</option>
								))}
							</select>
						</label>
					)}
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-600">
							Proveedor (nombre) <span className="text-rose-600">*</span>
						</span>
						<input
							type="text"
							list={`${idPrefix}-providers`}
							placeholder="Elige arriba o escribe uno nuevo"
							value={data.provider_name}
							onChange={(e) => {
								const name = e.target.value;
								const match = matchProviderByName(supplierDirectory, name);
								setData({
									...data,
									provider_name: name,
									...(match?.nif ? { supplier_nif: match.nif } : {}),
								});
							}}
							onBlur={(e) => applyProviderFromName(e.target.value, setData)}
							className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
						/>
						<p className="text-[11px] text-gray-400">
							Si ya existe, el NIF se rellena solo. Si no, escríbelo abajo.
						</p>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="block space-y-1">
							<span className="text-xs font-bold text-gray-600">
								NIF/CIF <span className="text-rose-600">*</span>
							</span>
							<input
								value={data.supplier_nif}
								onChange={(e) =>
									setData({ ...data, supplier_nif: e.target.value })
								}
								placeholder="Ej: B12345678"
								className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
							/>
						</label>
						<label className="block space-y-1">
							<span className="text-xs font-bold text-gray-600">
								Nº factura <span className="text-rose-600">*</span>
							</span>
							<input
								value={data.invoice_number}
								onChange={(e) =>
									setData({ ...data, invoice_number: e.target.value })
								}
								placeholder="Ej: F2026-001"
								className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
							/>
						</label>
					</div>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-600">IVA compra</span>
						<select
							value={data.purchase_tax_rate}
							onChange={(e) =>
								setData({
									...data,
									purchase_tax_rate: Number(e.target.value),
								})
							}
							className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
							{IVA_OPTIONS.map((v) => (
								<option key={v} value={v}>
									{v}%
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-600">
							Adjuntar factura (PDF/imagen)
						</span>
						<input
							type="file"
							accept="image/*,application/pdf"
							onChange={(e) => setFile(e.target.files?.[0] || null)}
							className="w-full text-xs"
						/>
						{file && (
							<p className="text-[11px] text-emerald-700 font-semibold">
								{file.name}
							</p>
						)}
					</label>
				</div>
			) : (
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">Origen (opcional)</span>
					<input
						type="text"
						list={`${idPrefix}-providers`}
						placeholder={GENERIC_PURCHASE_PROVIDER}
						value={data.provider_name}
						onChange={(e) =>
							setData({ ...data, provider_name: e.target.value })
						}
						onBlur={(e) => applyProviderFromName(e.target.value, setData)}
						className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
					/>
					<p className="text-[11px] text-gray-400">
						Vacío → «{GENERIC_PURCHASE_PROVIDER}». Sin IVA deducible.
					</p>
				</label>
			)}
		</section>
	);

	if (loading) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-rose-700" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
						<Package className="text-rose-700" /> Catálogo
					</h2>
					<p className="text-sm text-gray-500 mt-1">
						Stock propio con coste de compra y margen. Reponer sin crear otro
						producto.
					</p>
				</div>
				<button
					type="button"
					onClick={openCreate}
					className="inline-flex items-center gap-2 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-sm font-bold">
					<Plus size={16} /> Nuevo producto
				</button>
			</div>

			{products.length === 0 ? (
				<EmptyState
					icon={Package}
					title="Sin productos"
					description="Crea el primer producto indicando stock y coste de compra (0 si es gratis)."
					actionLabel="Nuevo producto"
					onAction={openCreate}
				/>
			) : (
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{products.map((p) => {
						const unitCost = Number(p.unit_cost) || 0;
						const margin = Number(p.price) - unitCost;
						return (
							<div
								key={p.id}
								className="rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col">
								<div className="aspect-[4/3] bg-gray-50 relative">
									{p.image_url ? (
										<img
											src={p.image_url}
											alt={p.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-gray-300">
											<Package size={40} />
										</div>
									)}
									<span className="absolute top-2 right-2">
										<StatusChip
											tone={Number(p.stock_qty) > 0 ? "success" : "danger"}>
											{Number(p.stock_qty)} {p.unit || "ud"}
										</StatusChip>
									</span>
								</div>
								<div className="p-4 flex-1 flex flex-col gap-2">
									<div>
										<p className="font-black text-gray-900 leading-tight">
											{p.name}
										</p>
										{p.sku && (
											<p className="text-[11px] text-gray-400 font-mono mt-0.5">
												{p.sku}
											</p>
										)}
									</div>
									{p.description && (
										<p className="text-xs text-gray-500 line-clamp-2">
											{p.description}
										</p>
									)}
									<div className="mt-auto space-y-0.5">
										<p className="text-lg font-black text-rose-700">
											{formatCurrency(p.price)}{" "}
											<span className="text-[11px] font-bold text-gray-400">
												IVA {taxRateLabel(p.tax_rate)}
											</span>
										</p>
										<p className="text-[11px] text-gray-500">
											Coste/ud {formatCurrency(unitCost)}
											{Number.isFinite(margin) && (
												<span
													className={`ml-2 font-bold ${
														margin >= 0 ? "text-emerald-600" : "text-rose-600"
													}`}>
													· margen {formatCurrency(margin)}
												</span>
											)}
										</p>
									</div>
									<div className="flex gap-2 pt-1 flex-wrap">
										<button
											type="button"
											disabled={Number(p.stock_qty) <= 0}
											onClick={() => openSell(p)}
											className="flex-1 min-w-[5.5rem] inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 text-white px-3 py-2 text-xs font-bold disabled:opacity-40">
											<ShoppingCart size={14} /> Vender
										</button>
										<button
											type="button"
											onClick={() => openRestock(p)}
											className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
											title="Reponer stock">
											<PackagePlus size={14} /> Reponer
										</button>
										<button
											type="button"
											onClick={() => openEdit(p)}
											className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
											title="Editar">
											<Edit2 size={14} />
										</button>
										{canDeleteOperational && (
											<button
												type="button"
												onClick={() => setDeleteId(p.id)}
												className="rounded-xl border border-gray-200 p-2 text-gray-400 hover:text-rose-700 hover:bg-rose-50"
												title="Eliminar">
												<Trash2 size={14} />
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Crear / editar */}
			<SidePanel
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={editing ? "Editar producto" : "Nuevo producto"}
				subtitle={
					editing
						? "PVP y ficha. El stock se gestiona con Reponer."
						: "Coste, unidades y margen estimados al crear"
				}
				size="lg"
				footer={
					<button
						type="button"
						disabled={saving || uploadingImg}
						onClick={save}
						className="w-full btn-primary inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50">
						{saving || uploadingImg ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Plus size={16} />
						)}
						{editing ? "Guardar cambios" : "Crear producto"}
					</button>
				}>
				<div>
					<FormSheet>
						<FormSheetPrimary>
							<div className="flex items-center gap-4">
								{imagePreview ? (
									<img
										src={imagePreview}
										alt=""
										className="w-20 h-20 rounded-2xl object-cover border border-edge shadow-sm"
									/>
								) : (
									<div className="w-20 h-20 rounded-2xl bg-surface-2 border border-dashed border-edge flex items-center justify-center text-muted">
										<ImagePlus size={24} />
									</div>
								)}
								<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2 text-xs font-bold text-fg hover:bg-surface-2">
									<input
										type="file"
										accept="image/*"
										className="hidden"
										onChange={onPickImage}
									/>
									<ImagePlus size={14} /> Subir foto
								</label>
							</div>

							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">
									Nombre <span className="text-danger">*</span>
								</span>
								<input
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									placeholder="Ej: Crema hidratante 50 ml"
									className="input-field"
								/>
							</label>

							<div className="grid grid-cols-2 gap-3">
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">PVP con IVA (€)</span>
									<input
										value={form.price}
										onChange={(e) => setForm({ ...form, price: e.target.value })}
										inputMode="decimal"
										className="input-field font-bold text-primary"
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">IVA venta</span>
									<select
										value={form.tax_rate}
										onChange={(e) =>
											setForm({ ...form, tax_rate: Number(e.target.value) })
										}
										className="input-field">
										{IVA_OPTIONS.map((v) => (
											<option key={v} value={v}>
												{v}%
											</option>
										))}
									</select>
								</label>
							</div>

							{!editing && (
								<div className="grid grid-cols-2 gap-3">
									<label className="block space-y-1">
										<span className="text-xs font-bold text-muted">Unidades iniciales</span>
										<input
											value={form.stock_qty}
											onChange={(e) =>
												setForm({ ...form, stock_qty: e.target.value })
											}
											inputMode="decimal"
											className="input-field"
										/>
									</label>
									<label className="block space-y-1">
										<span className="text-xs font-bold text-muted">Formato</span>
										<select
											value={
												["ud", "caja", "ml", "g", "pack"].includes(form.unit)
													? form.unit
													: "ud"
											}
											onChange={(e) =>
												setForm({ ...form, unit: e.target.value })
											}
											className="input-field">
											<option value="ud">Unidad (ud)</option>
											<option value="caja">Caja</option>
											<option value="pack">Pack</option>
											<option value="ml">Mililitros (ml)</option>
											<option value="g">Gramos (g)</option>
										</select>
									</label>
								</div>
							)}

							{editing && (
								<p className="text-xs text-muted rounded-xl bg-surface-2 border border-edge px-3 py-2">
									Stock:{" "}
									<strong className="text-fg">
										{Number(editing.stock_qty)} {editing.unit}
									</strong>{" "}
									· Coste medio/ud:{" "}
									<strong className="text-fg">
										{formatCurrency(editing.unit_cost || 0)}
									</strong>
									. Usa <strong className="text-fg">Reponer</strong> para añadir unidades.
								</p>
							)}

							<FormDetails
								title="Más detalles"
								defaultOpen={!editing && Number(form.totalCost) > 0}>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Descripción</span>
									<textarea
										rows={2}
										value={form.description}
										onChange={(e) =>
											setForm({ ...form, description: e.target.value })
										}
										className="input-field resize-none"
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-muted">Referencia / SKU</span>
									<input
										value={form.sku}
										onChange={(e) => setForm({ ...form, sku: e.target.value })}
										className="input-field"
									/>
								</label>
								{!editing && (
									<>
										<label className="block space-y-1">
											<span className="text-xs font-bold text-muted">
												Coste total de compra (€)
											</span>
											<input
												value={form.totalCost}
												onChange={(e) =>
													setForm({ ...form, totalCost: e.target.value })
												}
												inputMode="decimal"
												className="input-field"
											/>
										</label>
										{purchaseFields(form, setForm, receiptFile, setReceiptFile, "prod-new")}
									</>
								)}
							</FormDetails>
						</FormSheetPrimary>

						<FormSheetPreview>
							{form.name ? (
								<p className="text-base font-bold text-white leading-snug">{form.name}</p>
							) : (
								<p className="text-sm text-slate-500">Sin nombre aún</p>
							)}
							<div className="grid grid-cols-2 gap-3">
								<FormPreviewStat
									label="PVP"
									value={
										form.price
											? formatCurrency(Number(String(form.price).replace(",", ".")) || 0)
											: "—"
									}
								/>
								<FormPreviewStat
									label="IVA"
									value={taxRateLabel(form.tax_rate)}
									tone="accent"
								/>
							</div>
							{!editing && (
								<div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
									<FormPreviewStat
										label="Coste / ud"
										value={
											unitCostPreview != null
												? formatCurrency(unitCostPreview)
												: "—"
										}
									/>
									<FormPreviewStat
										label="Margen est."
										tone={
											marginPreview == null
												? "default"
												: marginPreview >= 0
													? "success"
													: "danger"
										}
										value={
											marginPreview != null
												? formatCurrency(marginPreview)
												: "—"
										}
									/>
								</div>
							)}
							{editing && (
								<p className="text-xs text-slate-400 pt-2 border-t border-slate-700">
									Coste medio actual:{" "}
									{formatCurrency(editing.unit_cost || 0)}/ud
								</p>
							)}
						</FormSheetPreview>
					</FormSheet>
				</div>
			</SidePanel>

			{/* Reponer */}
			<SidePanel
				isOpen={!!restockTarget}
				onClose={() => setRestockTarget(null)}
				title={restockTarget ? `Reponer: ${restockTarget.name}` : "Reponer"}
				subtitle="Añade unidades y actualiza el coste medio"
				size="lg"
				footer={
					<button
						type="button"
						disabled={restocking || !restockTarget}
						onClick={confirmRestock}
						className="w-full btn-primary inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50">
						{restocking ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<PackagePlus size={16} />
						)}
						Confirmar reposición
					</button>
				}>
				{restockTarget && (
					<FormSheet>
						<FormSheetPrimary>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">
									Unidades a añadir
								</span>
								<input
									value={restockForm.quantity}
									onChange={(e) =>
										setRestockForm({ ...restockForm, quantity: e.target.value })
									}
									inputMode="decimal"
									className="input-field"
								/>
							</label>
							<FormDetails title="Compra / fiscalidad" defaultOpen>
								{purchaseFields(
									restockForm,
									setRestockForm,
									restockReceipt,
									setRestockReceipt,
									"prod-restock",
								)}
							</FormDetails>
						</FormSheetPrimary>
						<FormSheetPreview>
							<p className="text-sm font-semibold text-white">{restockTarget.name}</p>
							<div className="grid grid-cols-2 gap-3">
								<FormPreviewStat
									label="Stock actual"
									value={`${Number(restockTarget.stock_qty)} ${restockTarget.unit}`}
								/>
								<FormPreviewStat
									label="Coste medio"
									value={`${formatCurrency(restockTarget.unit_cost || 0)}/ud`}
								/>
							</div>
							<FormPreviewStat
								label="Coste esta entrada"
								tone="accent"
								value={
									restockUnitCost != null
										? `${formatCurrency(restockUnitCost)}/ud`
										: "—"
								}
							/>
						</FormSheetPreview>
					</FormSheet>
				)}
			</SidePanel>

			{/* Vender */}
			<SidePanel
				isOpen={!!sellTarget}
				onClose={() => setSellTarget(null)}
				title={sellTarget ? `Vender: ${sellTarget.name}` : "Vender"}
				subtitle="Ticket automático salvo Plan Amigo"
				size="md"
				footer={
					<button
						type="button"
						disabled={selling || !sellTarget}
						onClick={confirmSell}
						className="w-full btn-primary inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50">
						{selling ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<ShoppingCart size={16} />
						)}
						{sellForm.planAmigo
							? "Confirmar venta Plan Amigo"
							: "Confirmar venta y emitir ticket"}
					</button>
				}>
				{sellTarget && (
					<div className="space-y-4">
						<p className="text-xs text-muted">
							Disponible:{" "}
							<strong className="text-fg">
								{Number(sellTarget.stock_qty)} {sellTarget.unit || "ud"}
							</strong>
							{" · "}
							Coste/ud {formatCurrency(sellTarget.unit_cost || 0)}
							{sellForm.planAmigo
								? ". Plan Amigo: sin factura fiscal."
								: ". Se emite ticket/factura."}
						</p>
						<div className="grid grid-cols-2 gap-3">
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Cantidad</span>
								<input
									value={sellForm.quantity}
									onChange={(e) =>
										setSellForm({ ...sellForm, quantity: e.target.value })
									}
									inputMode="decimal"
									className="input-field"
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">PVP unitario (€)</span>
								<input
									value={sellForm.unitPrice}
									onChange={(e) =>
										setSellForm({ ...sellForm, unitPrice: e.target.value })
									}
									inputMode="decimal"
									className="input-field"
								/>
							</label>
						</div>
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Fecha</span>
							<input
								type="date"
								value={sellForm.date}
								onChange={(e) =>
									setSellForm({ ...sellForm, date: e.target.value })
								}
								className="input-field"
							/>
						</label>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setSellForm({ ...sellForm, mode: "client" })}
								className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold border ${
									sellForm.mode === "client"
										? "border-primary bg-primary-soft text-fg"
										: "border-edge text-muted"
								}`}>
								Cliente con ficha
							</button>
							<button
								type="button"
								onClick={() => setSellForm({ ...sellForm, mode: "anonymous" })}
								className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold border ${
									sellForm.mode === "anonymous"
										? "border-primary bg-primary-soft text-fg"
										: "border-edge text-muted"
								}`}>
								Sin ficha
							</button>
						</div>
						{sellForm.mode === "client" ? (
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Cliente</span>
								<select
									value={sellForm.clientId}
									onChange={(e) =>
										setSellForm({ ...sellForm, clientId: e.target.value })
									}
									className="input-field">
									<option value="">— Elegir —</option>
									{clientsActive.map((c) => (
										<option key={c.id} value={c.id}>
											{[c.name, c.surname].filter(Boolean).join(" ")}
										</option>
									))}
								</select>
							</label>
						) : (
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">
									Nombre interno (opcional)
								</span>
								<input
									value={sellForm.buyerName}
									onChange={(e) =>
										setSellForm({ ...sellForm, buyerName: e.target.value })
									}
									placeholder={UNLISTED_LABEL}
									className="input-field"
								/>
							</label>
						)}
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Notas internas</span>
							<input
								value={sellForm.notes}
								onChange={(e) =>
									setSellForm({ ...sellForm, notes: e.target.value })
								}
								className="input-field"
							/>
						</label>
						{canPlanAmigo && (
							<label className="flex items-start gap-3 p-4 bg-amber-50/70 border border-amber-100 rounded-2xl cursor-pointer">
								<input
									type="checkbox"
									checked={sellForm.planAmigo}
									onChange={(e) =>
										setSellForm({ ...sellForm, planAmigo: e.target.checked })
									}
									className="mt-1 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
								/>
								<span className="flex-1">
									<span className="flex items-center gap-2 font-bold text-amber-900">
										<Heart size={16} className="text-amber-500" /> Plan Amigo
									</span>
									<span className="block text-xs text-amber-800/80 mt-0.5">
										Sin factura (familiar/amigo). Cuenta en finanzas, no en
										Hacienda.
									</span>
								</span>
							</label>
						)}
					</div>
				)}
			</SidePanel>

			<ConfirmModal
				isOpen={!!deleteId}
				onCancel={() => setDeleteId(null)}
				onConfirm={async () => {
					try {
						await deleteProduct(deleteId);
						showToast?.("Producto eliminado");
					} catch (e) {
						showToast?.(e.message || "Error", "error");
					}
					setDeleteId(null);
				}}
				title="Eliminar producto"
				message="Se ocultará del catálogo. El historial de ventas/compras en finanzas se conserva."
				isDestructive
			/>

			<ProviderDatalist
				id="prod-new-providers"
				directory={supplierDirectory}
			/>
			<ProviderDatalist
				id="prod-restock-providers"
				directory={supplierDirectory}
			/>
		</div>
	);
};
