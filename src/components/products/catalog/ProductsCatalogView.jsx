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
	LayoutGrid,
	List as ListIcon,
	Zap,
} from "lucide-react";
import { QuickSalePanel } from "../sales/QuickSalePanel";
import { PurchaseCostFields } from "../../inventory/PurchaseCostFields";
import { InvoiceBatchPurchasePanel } from "../../inventory/InvoiceBatchPurchasePanel";
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
import {
	FormWizardProgress,
	FormWizardNav,
	FormWizardBatchHint,
	useFormWizard,
} from "../../ui/FormWizard";
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
	priceMode: "included",
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
	priceMode: "included",
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
		sellCart,
		sellingCart,
		invoiceBatchPurchase,
		invoiceBatchPending,
	} = useProducts(user);
	const { clients } = useClients(user);
	const [tpvOpen, setTpvOpen] = useState(false);

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
	const [deleteName, setDeleteName] = useState("");
	const [viewMode, setViewMode] = useState("grid");
	const [invoiceBatchOpen, setInvoiceBatchOpen] = useState(false);
	const [restockTarget, setRestockTarget] = useState(null);
	const [restockForm, setRestockForm] = useState(emptyRestock);
	const [restockReceipt, setRestockReceipt] = useState(null);

	const [sellTarget, setSellTarget] = useState(null);
	const [sellForm, setSellForm] = useState({
		quantity: "1",
		unitPrice: "",
		date: new Date().toISOString().slice(0, 10),
		mode: "anonymous",
		clientId: "",
		buyerName: "",
		notes: "",
		planAmigo: false,
	});

	const createWizard = useFormWizard(
		[
			{ id: "producto", label: "Producto" },
			{ id: "compra", label: "Compra" },
			{ id: "fiscal", label: "Fiscal", when: !!form.is_deductible },
			{ id: "adjunto", label: "Adjunto", when: !!form.is_deductible },
		],
		{ open: isModalOpen && !editing, resetKey: editing?.id || "new" },
	);

	const restockWizard = useFormWizard(
		[
			{ id: "entrada", label: "Entrada" },
			{ id: "fiscal", label: "Fiscal", when: !!restockForm.is_deductible },
			{ id: "adjunto", label: "Adjunto", when: !!restockForm.is_deductible },
		],
		{ open: !!restockTarget, resetKey: restockTarget?.id || "restock" },
	);

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
			mode: "anonymous",
			clientId: "",
			buyerName: "",
			notes: "",
			planAmigo: false,
		});
	};

	const handleQuickSale = async (payload) => {
		try {
			const result = await sellCart(payload);
			const kind =
				result?.document_kind === "factura" ? "Factura" : "Ticket";
			const num = result?.invoice_number ? ` ${result.invoice_number}` : "";
			showToast?.(`${kind}${num} registrado · stock y caja actualizados`);
			setTpvOpen(false);
		} catch (e) {
			showToast?.(e.message || "No se pudo completar la venta", "error");
			throw e;
		}
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
			showToast?.(
				"Para factura completa elige un paciente, o cambia a «Ticket (mostrador)»",
				"error",
			);
			return;
		}

		const isTicket = sellForm.mode !== "client";
		const isPlanAmigo = canPlanAmigo && !!sellForm.planAmigo;

		try {
			const entryId = await sellProduct({
				productId: sellTarget.id,
				quantity: qty,
				unitPrice,
				date: sellForm.date,
				clientId: isTicket ? null : sellForm.clientId,
				// Ticket: sin nombre → Mostrador (el RPC lo rellena si va vacío)
				buyerName: isTicket
					? sellForm.buyerName.trim() || "Mostrador"
					: null,
				issueInvoice: !isPlanAmigo,
				internalNotes: sellForm.notes.trim() || null,
				planAmigo: isPlanAmigo,
				documentKind: isPlanAmigo ? null : isTicket ? "ticket" : "factura",
			});

			let issuedNumber = "";
			let issuedKind = isTicket ? "ticket" : "factura";

			if (entryId && !isPlanAmigo) {
				const { data: entry } = await supabase
					.from("finance_entries")
					.select("*")
					.eq("id", entryId)
					.maybeSingle();
				if (entry) {
					issuedNumber = entry.invoice_number || "";
					issuedKind = entry.document_kind || issuedKind;
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
						showToast?.(
							`${issuedKind === "factura" ? "Factura" : "Ticket"}${issuedNumber ? ` ${issuedNumber}` : ""} OK · PDF no generado`,
							"error",
						);
						setSellTarget(null);
						return;
					}
				}
			}

			showToast?.(
				isPlanAmigo
					? "Venta Plan Amigo registrada (sin documento fiscal)"
					: issuedKind === "factura"
						? `Factura${issuedNumber ? ` ${issuedNumber}` : ""} emitida`
						: `Ticket${issuedNumber ? ` ${issuedNumber}` : ""} emitido (sin paciente)`,
			);
			setSellTarget(null);
		} catch (e) {
			showToast?.(e.message || "Error al vender", "error");
		}
	};

	const purchaseCostBlock = (data, setData) => (
		<div className="space-y-3">
			<p className="text-xs text-gray-500 leading-relaxed">
				Indica lo que te costó el lote (0 € si es regalo o muestra). El coste por
				unidad se calcula solo para ver el margen al vender.
			</p>
			<label className="block space-y-1">
				<span className="text-xs font-bold text-gray-600">Fecha de compra</span>
				<input
					type="date"
					value={data.purchaseDate}
					onChange={(e) => setData({ ...data, purchaseDate: e.target.value })}
					className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
				/>
			</label>
			<PurchaseCostFields
				totalCost={data.totalCost}
				onTotalCostChange={(v) => setData({ ...data, totalCost: v })}
				taxRate={data.purchase_tax_rate ?? 21}
				onTaxRateChange={(v) => setData({ ...data, purchase_tax_rate: v })}
				priceMode={data.priceMode || "included"}
				onPriceModeChange={(v) => setData({ ...data, priceMode: v })}
				isDeductible={data.is_deductible}
				label="Coste total del lote (€)"
			/>
			<label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3">
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
						En el siguiente paso pediremos proveedor, NIF y nº de factura.
					</span>
				</span>
			</label>
			{!data.is_deductible && (
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">Origen (opcional)</span>
					<input
						type="text"
						list="prod-new-providers"
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
		</div>
	);

	const purchaseFiscalBlock = (data, setData, idPrefix) => (
		<div className="space-y-3">
			<p className="text-xs text-gray-500">
				Datos de la factura para IVA deducible (modelo 303).
			</p>
			{supplierDirectory.length > 0 && (
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">Proveedor guardado</span>
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
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block space-y-1">
					<span className="text-xs font-bold text-gray-600">
						NIF/CIF <span className="text-rose-600">*</span>
					</span>
					<input
						value={data.supplier_nif}
						onChange={(e) => setData({ ...data, supplier_nif: e.target.value })}
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
		</div>
	);

	const purchaseFileBlock = (file, setFile) => (
		<div className="space-y-3">
			<p className="text-xs text-gray-500">
				Sube el PDF o una foto de la factura. Puedes dejarlo vacío y adjuntarlo
				después desde finanzas.
			</p>
			<label className="block space-y-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center cursor-pointer hover:border-rose-300 hover:bg-rose-50/40 transition-colors">
				<span className="block text-sm font-bold text-slate-700">
					Adjuntar factura (PDF o imagen)
				</span>
				<input
					type="file"
					accept="image/*,application/pdf"
					onChange={(e) => setFile(e.target.files?.[0] || null)}
					className="mx-auto block text-xs mt-2"
				/>
			</label>
			{file && (
				<p className="text-sm font-semibold text-emerald-700">✓ {file.name}</p>
			)}
		</div>
	);

	const validateCreateStep = () => {
		if (createWizard.stepId === "producto") {
			if (!form.name?.trim()) {
				showToast?.("Indica el nombre del producto", "error");
				return false;
			}
			if (form.price === "" || Number.isNaN(Number(String(form.price).replace(",", ".")))) {
				showToast?.("Indica el PVP de venta", "error");
				return false;
			}
			return true;
		}
		if (createWizard.stepId === "compra") {
			const stock = Number(String(form.stock_qty).replace(",", "."));
			if (stock > 0 && !form.purchaseDate?.trim()) {
				showToast?.("Indica la fecha de compra", "error");
				return false;
			}
			return true;
		}
		if (createWizard.stepId === "fiscal") {
			if (
				!form.provider_name?.trim() ||
				!form.supplier_nif?.trim() ||
				!form.invoice_number?.trim()
			) {
				showToast?.("Proveedor, NIF y nº de factura son obligatorios", "error");
				return false;
			}
			return true;
		}
		return true;
	};

	const validateRestockStep = () => {
		if (restockWizard.stepId === "entrada") {
			const qty = Number(String(restockForm.quantity).replace(",", "."));
			if (!(qty > 0)) {
				showToast?.("Indica las unidades a añadir", "error");
				return false;
			}
			if (!restockForm.purchaseDate?.trim()) {
				showToast?.("Indica la fecha de compra", "error");
				return false;
			}
			return true;
		}
		if (restockWizard.stepId === "fiscal") {
			if (
				!restockForm.provider_name?.trim() ||
				!restockForm.supplier_nif?.trim() ||
				!restockForm.invoice_number?.trim()
			) {
				showToast?.("Proveedor, NIF y nº de factura son obligatorios", "error");
				return false;
			}
			return true;
		}
		return true;
	};

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
					<p className="text-sm text-muted">
						Stock propio con coste de compra y margen. Reponer sin crear otro
						producto.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex bg-surface-2 p-1 rounded-lg border border-edge">
						<button
							type="button"
							onClick={() => setViewMode("grid")}
							className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-surface shadow-sm text-primary" : "text-muted"}`}
							title="Vista cuadrícula">
							<LayoutGrid size={18} />
						</button>
						<button
							type="button"
							onClick={() => setViewMode("list")}
							className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-surface shadow-sm text-primary" : "text-muted"}`}
							title="Vista lista">
							<ListIcon size={18} />
						</button>
					</div>
					<button
						type="button"
						onClick={() => setTpvOpen(true)}
						className="btn-inverse inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold">
						<Zap size={16} /> Venta rápida
					</button>
					<button
						type="button"
						onClick={() => setInvoiceBatchOpen(true)}
						className="inline-flex items-center gap-2 rounded-xl bg-warning text-on-inverse px-3 py-2.5 text-sm font-bold shadow-sm hover:brightness-110 transition-colors">
						Factura múltiple
					</button>
					<button
						type="button"
						onClick={openCreate}
						className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold">
						<Plus size={16} /> Nuevo producto
					</button>
				</div>
			</div>

			{products.length === 0 ? (
				<EmptyState
					icon={Package}
					title="Sin productos"
					description="Crea el primer producto indicando stock y coste de compra (0 si es gratis)."
					actionLabel="Nuevo producto"
					onAction={openCreate}
				/>
			) : viewMode === "list" ? (
				<div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[640px]">
						<thead>
							<tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
								<th className="p-3">Producto</th>
								<th className="p-3 text-center">Stock</th>
								<th className="p-3 text-right">PVP</th>
								<th className="p-3 text-right hidden sm:table-cell">Coste/ud</th>
								<th className="p-3 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{products.map((p) => {
								const unitCost = Number(p.unit_cost) || 0;
								return (
									<tr key={p.id} className="hover:bg-slate-50/80 group">
										<td className="p-3">
											<p className="text-sm font-medium text-slate-900">{p.name}</p>
											{p.sku && (
												<p className="text-[11px] text-slate-400 font-mono tabular-nums">
													{p.sku}
												</p>
											)}
										</td>
										<td className="p-3 text-center tabular-nums text-sm font-medium">
											{Number(p.stock_qty)} {p.unit || "ud"}
										</td>
										<td className="p-3 text-right text-sm font-medium text-slate-900 tabular-nums">
											{formatCurrency(p.price)}
										</td>
										<td className="p-3 text-right text-sm text-slate-500 tabular-nums hidden sm:table-cell">
											{formatCurrency(unitCost)}
										</td>
										<td className="p-3 text-right">
											<div className="flex justify-end gap-1">
												<button
													type="button"
													disabled={Number(p.stock_qty) <= 0}
													onClick={() => openSell(p)}
													className="inline-flex items-center gap-1 rounded-lg btn-inverse px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
													title="Vender">
													<ShoppingCart size={14} /> Vender
												</button>
												<button
													type="button"
													onClick={() => openRestock(p)}
													className="p-1.5 text-muted hover:bg-surface-2 hover:text-fg rounded-lg"
													title="Reponer">
													<PackagePlus size={14} />
												</button>
												<button
													type="button"
													onClick={() => openEdit(p)}
													className="p-1.5 text-muted hover:bg-surface-2 hover:text-fg rounded-lg"
													title="Editar">
													<Edit2 size={14} />
												</button>
												{canDeleteOperational && (
													<button
														type="button"
														onClick={() => {
															setDeleteId(p.id);
															setDeleteName(p.name || "");
														}}
														className="p-1.5 text-muted hover:text-danger hover:bg-surface-2 rounded-lg"
														title="Eliminar">
														<Trash2 size={14} />
													</button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : (
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
					{products.map((p) => {
						const unitCost = Number(p.unit_cost) || 0;
						const margin = Number(p.price) - unitCost;
						return (
							<div
								key={p.id}
								className="group rounded-xl border border-slate-200/80 bg-white overflow-hidden flex flex-col shadow-sm">
								<div className="aspect-[16/9] bg-slate-50 relative">
									{p.image_url ? (
										<img
											src={p.image_url}
											alt={p.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-slate-300">
											<Package size={28} />
										</div>
									)}
									<span className="absolute top-1.5 right-1.5">
										<StatusChip
											tone={Number(p.stock_qty) > 0 ? "success" : "danger"}>
											<span className="tabular-nums">
												{Number(p.stock_qty)} {p.unit || "ud"}
											</span>
										</StatusChip>
									</span>
								</div>
								<div className="p-3 flex-1 flex flex-col gap-1.5">
									<p className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">
										{p.name}
									</p>
									<div className="mt-auto">
										<p className="text-base font-bold text-rose-700 tabular-nums">
											{formatCurrency(p.price)}
											<span className="text-[10px] font-medium text-gray-400 ml-1">
												IVA {taxRateLabel(p.tax_rate)}
											</span>
										</p>
										<p className="text-[11px] text-gray-500 tabular-nums">
											Coste {formatCurrency(unitCost)}
											{Number.isFinite(margin) && (
												<span
													className={`ml-1.5 font-semibold ${
														margin >= 0 ? "text-emerald-600" : "text-rose-600"
													}`}>
													· {formatCurrency(margin)}
												</span>
											)}
										</p>
									</div>
									<div className="flex gap-1.5 pt-1">
										<button
											type="button"
											disabled={Number(p.stock_qty) <= 0}
											onClick={() => openSell(p)}
											className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg btn-inverse px-2 py-1.5 text-[11px] font-semibold disabled:opacity-40">
											<ShoppingCart size={12} /> Vender
										</button>
										<button
											type="button"
											onClick={() => openRestock(p)}
											className="rounded-lg border border-edge p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
											title="Reponer">
											<PackagePlus size={12} />
										</button>
										<button
											type="button"
											onClick={() => openEdit(p)}
											className="rounded-lg border border-edge p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
											title="Editar">
											<Edit2 size={12} />
										</button>
										{canDeleteOperational && (
											<button
												type="button"
												onClick={() => {
													setDeleteId(p.id);
													setDeleteName(p.name || "");
												}}
												className="rounded-lg border border-edge p-1.5 text-muted hover:text-danger hover:bg-surface-2"
												title="Eliminar">
												<Trash2 size={12} />
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
						: createWizard.steps[createWizard.stepIndex]?.label
							? `Paso ${createWizard.stepIndex + 1} de ${createWizard.steps.length}: ${createWizard.steps[createWizard.stepIndex].label}`
							: "Coste, unidades y margen"
				}
				size="lg"
				footer={
					editing ? (
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
							Guardar cambios
						</button>
					) : (
						<FormWizardNav
							isFirst={createWizard.isFirst}
							isLast={createWizard.isLast}
							onBack={createWizard.back}
							onNext={() => {
								if (validateCreateStep()) createWizard.next();
							}}
							onSubmit={save}
							loading={saving || uploadingImg}
							submitLabel="Crear producto"
						/>
					)
				}>
				<div>
					{!editing && (
						<>
							<FormWizardBatchHint
								onOpen={() => {
									setIsModalOpen(false);
									setInvoiceBatchOpen(true);
								}}
							/>
							<FormWizardProgress
								steps={createWizard.steps}
								current={createWizard.stepIndex}
							/>
						</>
					)}
					<FormSheet>
						<FormSheetPrimary>
							{(editing || createWizard.stepId === "producto") && (
								<>
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
											<span className="text-xs font-bold text-muted">
												PVP con IVA (€)
											</span>
											<input
												value={form.price}
												onChange={(e) =>
													setForm({ ...form, price: e.target.value })
												}
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
												<span className="text-xs font-bold text-muted">
													Unidades iniciales
												</span>
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
											. Usa <strong className="text-fg">Reponer</strong> para
											añadir unidades.
										</p>
									)}

									<FormDetails title="Más detalles" defaultOpen={false}>
										<label className="block space-y-1">
											<span className="text-xs font-bold text-muted">
												Descripción
											</span>
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
											<span className="text-xs font-bold text-muted">
												Referencia / SKU
											</span>
											<input
												value={form.sku}
												onChange={(e) =>
													setForm({ ...form, sku: e.target.value })
												}
												className="input-field"
											/>
										</label>
									</FormDetails>
								</>
							)}

							{!editing && createWizard.stepId === "compra" && purchaseCostBlock(form, setForm)}
							{!editing &&
								createWizard.stepId === "fiscal" &&
								purchaseFiscalBlock(form, setForm, "prod-new")}
							{!editing &&
								createWizard.stepId === "adjunto" &&
								purchaseFileBlock(receiptFile, setReceiptFile)}
						</FormSheetPrimary>

						<FormSheetPreview>
							{form.name ? (
								<p className="text-base font-bold text-white leading-snug">
									{form.name}
								</p>
							) : (
								<p className="text-sm text-slate-500">Sin nombre aún</p>
							)}
							<div className="grid grid-cols-2 gap-3">
								<FormPreviewStat
									label="PVP"
									value={
										form.price
											? formatCurrency(
													Number(String(form.price).replace(",", ".")) || 0,
												)
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
				subtitle={
					restockWizard.steps[restockWizard.stepIndex]?.label
						? `Paso ${restockWizard.stepIndex + 1} de ${restockWizard.steps.length}: ${restockWizard.steps[restockWizard.stepIndex].label}`
						: "Añade unidades y actualiza el coste medio"
				}
				size="lg"
				footer={
					<FormWizardNav
						isFirst={restockWizard.isFirst}
						isLast={restockWizard.isLast}
						onBack={restockWizard.back}
						onNext={() => {
							if (validateRestockStep()) restockWizard.next();
						}}
						onSubmit={confirmRestock}
						loading={restocking || !restockTarget}
						submitLabel="Confirmar reposición"
					/>
				}>
				{restockTarget && (
					<>
						<FormWizardProgress
							steps={restockWizard.steps}
							current={restockWizard.stepIndex}
						/>
						<FormSheet>
							<FormSheetPrimary>
								{restockWizard.stepId === "entrada" && (
									<>
										<label className="block space-y-1">
											<span className="text-xs font-bold text-muted">
												Unidades a añadir
											</span>
											<input
												value={restockForm.quantity}
												onChange={(e) =>
													setRestockForm({
														...restockForm,
														quantity: e.target.value,
													})
												}
												inputMode="decimal"
												className="input-field"
											/>
										</label>
										{purchaseCostBlock(restockForm, setRestockForm)}
									</>
								)}
								{restockWizard.stepId === "fiscal" &&
									purchaseFiscalBlock(restockForm, setRestockForm, "prod-restock")}
								{restockWizard.stepId === "adjunto" &&
									purchaseFileBlock(restockReceipt, setRestockReceipt)}
							</FormSheetPrimary>
							<FormSheetPreview>
								<p className="text-sm font-semibold text-white">
									{restockTarget.name}
								</p>
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
					</>
				)}
			</SidePanel>

			{/* Vender (producto único) */}
			<SidePanel
				isOpen={!!sellTarget}
				onClose={() => setSellTarget(null)}
				title={sellTarget ? `Vender: ${sellTarget.name}` : "Vender"}
				subtitle="Por defecto Ticket · marca paciente para Factura completa"
				size="md"
				footer={
					<button
						type="button"
						disabled={selling || !sellTarget}
						onClick={confirmSell}
						className="w-full btn-inverse inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50">
						{selling ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<ShoppingCart size={16} />
						)}
						{sellForm.planAmigo
							? "Confirmar venta Plan Amigo"
							: sellForm.mode === "client"
								? "Confirmar y emitir factura"
								: "Confirmar y emitir ticket"}
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
								? ". Plan Amigo: sin documento fiscal."
								: sellForm.mode === "client"
									? ". Se emite factura completa."
									: ". Se emite ticket (factura simplificada)."}
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
								onClick={() => setSellForm({ ...sellForm, mode: "anonymous" })}
								className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold border ${
									sellForm.mode === "anonymous"
										? "border-primary bg-primary-soft text-fg"
										: "border-edge text-muted"
								}`}>
								Ticket (mostrador)
							</button>
							<button
								type="button"
								onClick={() => setSellForm({ ...sellForm, mode: "client" })}
								className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold border ${
									sellForm.mode === "client"
										? "border-primary bg-primary-soft text-fg"
										: "border-edge text-muted"
								}`}>
								Factura (paciente)
							</button>
						</div>
						{sellForm.mode === "client" ? (
							<label className="block space-y-1">
								<span className="text-xs font-bold text-muted">Paciente</span>
								<select
									value={sellForm.clientId}
									onChange={(e) =>
										setSellForm({ ...sellForm, clientId: e.target.value })
									}
									className="input-field">
									<option value="">— Elegir paciente —</option>
									{clientsActive.map((c) => (
										<option key={c.id} value={c.id}>
											{[c.name, c.surname].filter(Boolean).join(" ")}
										</option>
									))}
								</select>
							</label>
						) : (
							<p className="text-xs text-muted rounded-xl border border-edge bg-surface-2 px-3 py-2.5 leading-snug">
								Ticket simplificado a <strong className="text-fg">Mostrador</strong>
								. No hace falta nombre ni paciente.
							</p>
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
				onCancel={() => {
					setDeleteId(null);
					setDeleteName("");
				}}
				onConfirm={async () => {
					try {
						await deleteProduct(deleteId);
						showToast?.("Producto eliminado");
					} catch (e) {
						showToast?.(e.message || "Error", "error");
					}
					setDeleteId(null);
					setDeleteName("");
				}}
				title="Eliminar producto"
				message={`Estás a punto de eliminar el producto "${deleteName || "seleccionado"}" del catálogo.\n\nDesaparecerá de ventas y listados. El historial de movimientos en finanzas se conserva, pero no podrás recuperar la ficha fácilmente.\n\n¿Confirmas la eliminación?`}
				isDestructive
				confirmLabel="Eliminar producto"
			/>

			<InvoiceBatchPurchasePanel
				isOpen={invoiceBatchOpen}
				onClose={() => setInvoiceBatchOpen(false)}
				mode="products"
				items={products}
				supplierDirectory={supplierDirectory}
				loading={invoiceBatchPending}
				onSubmit={async ({ header, lines }) => {
					try {
						await invoiceBatchPurchase({
							header,
							lines: lines.map((l) => ({
								...l,
								productId: l.productId || l.itemId || null,
							})),
						});
						showToast?.(`Factura registrada (${lines.length} líneas)`);
					} catch (err) {
						showToast?.(err?.message || "Error al guardar factura", "error");
						throw err;
					}
				}}
			/>

			<ProviderDatalist
				id="prod-new-providers"
				directory={supplierDirectory}
			/>
			<ProviderDatalist
				id="prod-restock-providers"
				directory={supplierDirectory}
			/>

			{/* TPV carrito (varios productos) */}
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
