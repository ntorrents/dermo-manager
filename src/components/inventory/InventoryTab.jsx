import React, { useState, useEffect } from "react";
import {
	Plus,
	Search,
	Package,
	Trash2,
	Edit2,
	Loader2,
	AlertTriangle,
	AlertCircle,
	Copy,
	Image as ImageIcon,
} from "lucide-react";
import { IVA_OPTIONS, formatCurrency, formatDate } from "../../utils/format";
import { calculateUnitCost } from "../../utils/calculations";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import {
	validateSpanishTaxId,
	validateFile,
	normalizeInvoiceNumber,
	validateInvoiceDateConsistency,
	getInvoiceSuggestions,
} from "../../utils/validations";
import { GENERIC_PURCHASE_PROVIDER } from "../../utils/inventoryPurchase";
import {
	buildSupplierDirectory,
	matchProviderByName,
} from "../../utils/supplierDirectory";
import { ProviderDatalist } from "../ui/ProviderDatalist";
import {
	useCreateMaterial,
	useUpdateMaterial,
	useRestockMaterial,
	useDeleteMaterial,
	useUpdateBatch,
} from "../../hooks/useInventoryMutations";
import {
	useInventoryBatches,
	fetchBatchesForMaterial,
} from "../../hooks/useInventoryBatches";
import { useTenant } from "../../context/TenantContext";

function BatchEditRow({ batch, onSave, showToast }) {
	const [lotNumber, setLotNumber] = useState(batch.lot_number);
	const [expiryDate, setExpiryDate] = useState(
		batch.expiry_date?.slice?.(0, 10) || "",
	);

	const handleBlur = () => {
		if (
			(lotNumber !== batch.lot_number ||
				expiryDate !== (batch.expiry_date?.slice?.(0, 10) || "")) &&
			lotNumber.trim() &&
			expiryDate
		) {
			onSave({ lot_number: lotNumber.trim(), expiry_date: expiryDate }).catch(
				() => showToast("Error al actualizar lote", "error"),
			);
		}
	};

	return (
		<div className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200">
			<input
				type="text"
				className="flex-1 p-2 rounded-lg text-sm font-bold outline-none border border-gray-200"
				value={lotNumber}
				onChange={(e) => setLotNumber(e.target.value)}
				onBlur={handleBlur}
				placeholder="Nº lote"
			/>
			<input
				type="date"
				className="p-2 rounded-lg text-sm font-bold outline-none border border-gray-200 w-36"
				value={expiryDate}
				onChange={(e) => setExpiryDate(e.target.value)}
				onBlur={handleBlur}
			/>
			<span className="text-xs text-gray-400 font-medium shrink-0">
				{batch.quantity_remaining}{" "}
				{batch.quantity_remaining === 1 ? "ud" : "uds"}
			</span>
		</div>
	);
}

export const InventoryTab = ({
	user,
	inventory = [],
	entries = [],
	showToast,
	onRefresh,
}) => {
	const createMaterial = useCreateMaterial(user?.id);
	const updateMaterial = useUpdateMaterial(user?.id);
	const restockMaterial = useRestockMaterial(user?.id);
	const deleteMaterial = useDeleteMaterial(user?.id);
	const updateBatch = useUpdateBatch(user?.id);
	const { batches } = useInventoryBatches(user?.id);
	const { canDeleteOperational } = useTenant();

	const loading =
		createMaterial.isPending ||
		updateMaterial.isPending ||
		restockMaterial.isPending ||
		deleteMaterial.isPending;
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState(null);

	const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
	const [restockItem, setRestockItem] = useState(null);
	const [restockData, setRestockData] = useState({
		quantity: "",
		totalCost: "",
		taxRate: 21,
		lotNumber: "",
		expiryDate: "",
		purchaseDate: new Date().toISOString().split("T")[0],
		is_deductible: false,
		provider_name: "",
		supplier_nif: "",
		invoice_number: "",
	});
	const [restockReceiptFile, setRestockReceiptFile] = useState(null);
	const [restockReceiptPreview, setRestockReceiptPreview] = useState(null);
	const [restockNifValidation, setRestockNifValidation] = useState({
		valid: true,
		error: null,
	});
	const [restockFileValidation, setRestockFileValidation] = useState({
		valid: true,
		error: null,
	});
	const [restockDateWarning, setRestockDateWarning] = useState(null);
	const [restockInvoiceSuggestions, setRestockInvoiceSuggestions] = useState(
		[],
	);
	const [showRestockSuggestions, setShowRestockSuggestions] = useState(false);

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);
	const [editBatches, setEditBatches] = useState([]);

	const [formData, setFormData] = useState({
		name: "",
		stock: "",
		unit: "uds",
		totalCost: "",
		tax_rate: 21,
		min_stock: "5",
		item_type: "material",
		costPerUse: "",
		lotNumber: "",
		expiryDate: "",
		purchaseDate: new Date().toISOString().split("T")[0],
		is_deductible: false,
		provider_name: "",
		supplier_nif: "",
		invoice_number: "",
	});

	const supplierDirectory = React.useMemo(
		() => buildSupplierDirectory(entries),
		[entries],
	);

	const applyProviderFromName = (providerName, setter) => {
		const match = matchProviderByName(supplierDirectory, providerName);
		if (!match) return;
		setter((prev) => ({
			...prev,
			provider_name: match.name || prev.provider_name,
			supplier_nif: match.nif || prev.supplier_nif,
		}));
	};

	const filteredInventory =
		inventory?.filter((item) =>
			item.name.toLowerCase().includes(searchTerm.toLowerCase()),
		) || [];

	const getEarliestExpiry = (itemId) => {
		const itemBatches = (batches || []).filter(
			(b) => b.inventory_id === itemId,
		);
		if (!itemBatches.length) return null;
		const sorted = [...itemBatches].sort(
			(a, b) => new Date(a.expiry_date) - new Date(b.expiry_date),
		);
		return sorted[0];
	};

	const lowStockCount =
		inventory?.filter(
			(item) =>
				(item.item_type || "material") === "material" &&
				Number(item.stock) <= Number(item.min_stock)
		)?.length || 0;

	const openModal = (item = null) => {
		if (item) {
			setEditingItem(item);
			const isMaquina = item.item_type === "maquina";
			const calculatedTotal = isMaquina
				? ""
				: (Number(item.stock) * Number(item.unit_cost)).toFixed(2);
			setFormData({
				name: item.name,
				stock: item.stock,
				unit: item.unit || "uds",
				totalCost: calculatedTotal,
				tax_rate: 21,
				min_stock: item.min_stock,
				item_type: item.item_type || "material",
				costPerUse: isMaquina ? String(item.unit_cost ?? "") : "",
				lotNumber: "",
				expiryDate: "",
				purchaseDate: new Date().toISOString().split("T")[0],
				is_deductible: false,
				provider_name: "",
				supplier_nif: "",
				invoice_number: "",
			});
			setEditBatches([]);
			if (!isMaquina) fetchBatchesForMaterial(item.id).then(setEditBatches);
		} else {
			setEditingItem(null);
			setFormData({
				name: "",
				stock: "",
				unit: "uds",
				totalCost: "",
				tax_rate: 21,
				min_stock: "5",
				item_type: "material",
				costPerUse: "",
				lotNumber: "",
				expiryDate: "",
				purchaseDate: new Date().toISOString().split("T")[0],
				is_deductible: false,
				provider_name: "",
				supplier_nif: "",
				invoice_number: "",
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		const isMaquina = formData.item_type === "maquina";
		if (!isMaquina && Number(formData.stock) <= 0) {
			showToast("El stock debe ser mayor a 0", "error");
			return;
		}
		if (!isMaquina && !editingItem) {
			if (!formData.purchaseDate?.trim()) {
				showToast("La fecha de compra es obligatoria", "error");
				return;
			}
			if (!formData.lotNumber?.trim() || !formData.expiryDate) {
				showToast("Lote y fecha de caducidad son obligatorios", "error");
				return;
			}
			if (formData.is_deductible) {
				if (!formData.provider_name?.trim() || !formData.supplier_nif?.trim() || !formData.invoice_number?.trim()) {
					showToast("Factura deducible: completa proveedor, NIF y nº de factura", "error");
					return;
				}
			}
		}
		if (isMaquina && (Number(formData.costPerUse) < 0 || formData.costPerUse === "")) {
			showToast("Indica el coste por uso (ej. 10 €/sesión)", "error");
			return;
		}
		try {
			if (editingItem) {
				await updateMaterial.mutateAsync({ editingItem, formData });
				showToast(isMaquina ? "Máquina actualizada" : "Material actualizado");
			} else {
				await createMaterial.mutateAsync({ formData, taxCalc: {} });
				showToast(isMaquina ? "Máquina creada" : "Material creado y gasto registrado");
			}
			setIsModalOpen(false);
			await onRefresh();
		} catch (error) {
			showToast("Error: " + (error?.message || "Error al guardar"), "error");
		}
	};

	const openRestockModal = (item) => {
		setRestockItem(item);
		setRestockData({
			quantity: "",
			totalCost: "",
			taxRate: 21,
			lotNumber: "",
			expiryDate: "",
			purchaseDate: new Date().toISOString().split("T")[0],
			is_deductible: false,
			provider_name: "",
			supplier_nif: "",
			invoice_number: "",
		});
		setRestockReceiptFile(null);
		setRestockReceiptPreview(null);
		setRestockNifValidation({ valid: true, error: null });
		setRestockFileValidation({ valid: true, error: null });
		setRestockDateWarning(null);
		setRestockInvoiceSuggestions([]);
		setShowRestockSuggestions(false);
		setIsRestockModalOpen(true);
	};

	// Efecto para validar NIF y obtener sugerencias en reposición
	useEffect(() => {
		if (restockData.supplier_nif && restockData.supplier_nif.length >= 3) {
			const validation = validateSpanishTaxId(restockData.supplier_nif);
			setRestockNifValidation(validation);

			if (validation.valid && validation.normalized) {
				setRestockData((prev) => ({
					...prev,
					supplier_nif: validation.normalized,
				}));
				const expenseEntries = entries.filter(
					(e) => e.type === "expense" && e.is_deductible,
				);
				const suggestions = getInvoiceSuggestions(
					validation.normalized,
					expenseEntries,
					5,
				);
				setRestockInvoiceSuggestions(suggestions);
				setShowRestockSuggestions(suggestions.length > 0);
			} else {
				setRestockInvoiceSuggestions([]);
				setShowRestockSuggestions(false);
			}
		} else {
			setRestockNifValidation({ valid: true, error: null });
			setRestockInvoiceSuggestions([]);
			setShowRestockSuggestions(false);
		}
	}, [restockData.supplier_nif, entries]);

	// Efecto para validar coherencia de fecha en reposición
	useEffect(() => {
		if (
			restockData.supplier_nif &&
			restockData.invoice_number &&
			restockData.purchaseDate
		) {
			const expenseEntries = entries.filter(
				(e) => e.type === "expense" && e.is_deductible,
			);
			const validation = validateInvoiceDateConsistency(
				restockData.purchaseDate,
				restockData.supplier_nif,
				restockData.invoice_number,
				expenseEntries,
			);
			setRestockDateWarning(validation);
		} else {
			setRestockDateWarning(null);
		}
	}, [
		restockData.purchaseDate,
		restockData.supplier_nif,
		restockData.invoice_number,
		entries,
	]);

	// Función para usar sugerencia de factura en reposición
	const useRestockInvoiceSuggestion = (suggestion) => {
		// Buscar si ya existe un archivo para esta factura
		const expenseEntries = entries.filter(
			(e) => e.type === "expense" && e.is_deductible,
		);
		const existingEntry = expenseEntries.find(
			(e) =>
				e.supplier_nif === suggestion.supplier_nif &&
				e.invoice_number === suggestion.invoice_number &&
				e.file_url,
		);

		setRestockData((prev) => ({
			...prev,
			supplier_nif: suggestion.supplier_nif,
			invoice_number: suggestion.invoice_number,
			purchaseDate: suggestion.date,
		}));

		// Si hay archivo existente, no pedir subir uno nuevo
		if (existingEntry?.file_url) {
			setRestockReceiptFile(null);
			setRestockReceiptPreview(null);
		}

		setShowRestockSuggestions(false);
	};

	const handleRestockFileChange = (e) => {
		const file = e.target.files?.[0] || null;
		if (file) {
			const validation = validateFile(file);
			setRestockFileValidation(validation);

			if (validation.valid) {
				setRestockReceiptFile(file);
				// Crear preview
				if (file.type.startsWith("image/")) {
					const reader = new FileReader();
					reader.onloadend = () => {
						setRestockReceiptPreview(reader.result);
					};
					reader.readAsDataURL(file);
				} else {
					setRestockReceiptPreview(null);
				}
			} else {
				setRestockReceiptFile(null);
				setRestockReceiptPreview(null);
				showToast(validation.error, "error");
			}
		} else {
			setRestockReceiptFile(null);
			setRestockReceiptPreview(null);
			setRestockFileValidation({ valid: true, error: null });
		}
	};

	const handleRestock = async (e) => {
		e.preventDefault();

		if (!restockData.purchaseDate?.trim()) {
			showToast("La fecha de compra es obligatoria", "error");
			return;
		}
		if (!restockData.lotNumber?.trim() || !restockData.expiryDate) {
			showToast("Lote y fecha de caducidad son obligatorios", "error");
			return;
		}

		if (restockData.is_deductible) {
			if (!restockData.provider_name?.trim() || !restockData.supplier_nif?.trim() || !restockData.invoice_number?.trim()) {
				showToast("Factura deducible: completa proveedor, NIF y nº de factura", "error");
				return;
			}
			const nifValidation = validateSpanishTaxId(restockData.supplier_nif);
			if (!nifValidation.valid) {
				showToast(nifValidation.error, "error");
				return;
			}
		}

		if (!restockData.is_deductible && restockData.supplier_nif) {
			const nifValidation = validateSpanishTaxId(restockData.supplier_nif);
			if (!nifValidation.valid) {
				showToast(nifValidation.error, "error");
				return;
			}
		}

		if (restockData.is_deductible && restockData.invoice_number && !restockData.invoice_number.trim()) {
			showToast("El número de factura no puede estar vacío", "error");
			return;
		}

		if (restockReceiptFile) {
			const fileValidation = validateFile(restockReceiptFile);
			if (!fileValidation.valid) {
				showToast(fileValidation.error, "error");
				return;
			}
		}

		try {
			await restockMaterial.mutateAsync({
				restockItem,
				restockData: {
					...restockData,
					receiptFile: restockData.is_deductible ? restockReceiptFile : null,
					supplier_nif: restockData.is_deductible
						? restockNifValidation.normalized || restockData.supplier_nif
						: "",
					invoice_number: restockData.is_deductible
						? normalizeInvoiceNumber(restockData.invoice_number)
						: "",
				},
			});
			showToast("Stock actualizado");
			setIsRestockModalOpen(false);
			await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al reponer", "error");
		}
	};

	const handleDeleteClick = (item) => {
		setItemToDelete(item);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!itemToDelete) return;
		try {
			await deleteMaterial.mutateAsync(itemToDelete.id);
			showToast("Eliminado");
			setShowDeleteModal(false);
			setItemToDelete(null);
			await onRefresh();
		} catch {
			showToast("Error al eliminar", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Material"
				message={`¿Eliminar "${itemToDelete?.name}"?`}
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			<div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-stretch md:items-center">
				<div className="relative flex-1 w-full md:max-w-md min-w-0">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
					<input
						placeholder="Buscar material o máquina…"
						className="w-full pl-12 pr-3 py-3 bg-white border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-rose-100 font-bold text-gray-800"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					type="button"
					onClick={() => openModal()}
					className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors w-full md:w-auto shrink-0">
					<Plus size={20} /> Nuevo material o máquina
				</button>
			</div>

			{lowStockCount > 0 && (
				<div className="bg-warning-bg border border-warning-border p-4 rounded-2xl flex items-start gap-4 shadow-sm">
					<AlertTriangle className="text-warning-icon" size={20} />
					<div>
						<h4 className="font-bold text-warning-text">
							Stock Bajo ({lowStockCount})
						</h4>
						<p className="text-xs text-warning-text-light">
							Revisa los productos marcados.
						</p>
					</div>
				</div>
			)}

			<div className="md:hidden">
				{filteredInventory.length === 0 ? (
					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
						<EmptyState
							icon={Package}
							title="No hay materiales"
							description="Añade tu primer producto al inventario para empezar a controlar el stock."
							actionLabel="Añadir primer material"
							onAction={() => openModal()}
						/>
					</div>
				) : (
					<div className="space-y-3">
						{filteredInventory.map((item) => (
							<div
								key={item.id}
								className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
								<div className="flex justify-between items-start">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
											<Package size={20} />
										</div>
										<div>
											<h4 className="font-bold text-gray-800">{item.name}</h4>
											<p className="text-xs text-gray-400 font-medium">
												{item.unit_cost.toFixed(2)} € /{" "}
												{(item.item_type || "material") === "maquina"
													? "sesión"
													: item.unit_consumption || item.unit || "uds"}
											</p>
											{(item.item_type || "material") === "maquina" ? (
												<p className="text-[10px] text-amber-600 font-medium">Máquina (coste por uso)</p>
											) : (item.unit_purchase || item.unit_consumption) && (
												<p className="text-[10px] text-gray-400">
													Compra: {item.unit_purchase || item.unit || "uds"}
												</p>
											)}
										</div>
									</div>
									<div className="flex gap-1">
										<button
											onClick={() => openModal(item)}
											className="p-2 bg-gray-50 text-gray-400 rounded-lg"
											title={item.item_type === "maquina" ? "Editar máquina" : "Editar material"}>
											<Edit2 size={16} />
										</button>
										{canDeleteOperational && (
											<button
												onClick={() => handleDeleteClick(item)}
												className="p-2 bg-red-50 text-red-500 rounded-lg"
												title="Eliminar">
												<Trash2 size={16} />
											</button>
										)}
									</div>
								</div>

								<div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
									<div className="flex flex-col">
										<span className="text-[10px] uppercase font-bold text-gray-400">
											{(item.item_type || "material") === "maquina" ? "Coste por uso" : "Stock Actual"}
										</span>
										<span
											className={`font-black text-lg ${
												(item.item_type || "material") === "maquina"
													? "text-gray-800"
													: item.stock <= item.min_stock
														? "text-red-500"
														: "text-gray-800"
											}`}>
											{(item.item_type || "material") === "maquina"
												? `${Number(item.unit_cost).toFixed(2)} €/sesión`
												: `${item.stock} ${item.unit}`}
										</span>
									</div>
									{(item.item_type || "material") !== "maquina" && (
										<button
											onClick={() => openRestockModal(item)}
											className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors">
											<Plus size={14} /> Reponer
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="hidden md:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
				{filteredInventory.length === 0 ? (
					<div className="p-6">
						<EmptyState
							icon={Package}
							title="No hay materiales"
							description="Añade tu primer producto al inventario para empezar a controlar el stock."
							actionLabel="Añadir primer material"
							onAction={() => openModal()}
						/>
					</div>
				) : (
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-gray-50/50 border-b text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">
								<th className="p-6">Material</th>
								<th className="p-6 text-center">Stock</th>
								<th className="p-6 text-center">Próx. caducidad</th>
								<th className="p-6 text-center">Coste Unit.</th>
								<th className="p-6 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{filteredInventory.map((item) => (
								<tr
									key={item.id}
									className="hover:bg-gray-50/30 transition-colors group">
									<td className="p-6">
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
												<Package size={24} />
											</div>
											<div>
												<p className="font-bold text-gray-900 text-lg leading-tight">
													{item.name}
													{(item.item_type || "material") === "maquina" && (
														<span className="ml-2 text-[10px] font-medium text-amber-600 uppercase">Máquina</span>
													)}
												</p>
												<p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
													{(item.item_type || "material") === "maquina"
														? "Coste por uso"
														: item.unit_purchase || item.unit_consumption
															? `Compra: ${item.unit_purchase || item.unit || "uds"} · Consumo: ${item.unit_consumption || item.unit || "uds"}`
															: item.unit || "uds"}
												</p>
											</div>
										</div>
									</td>
									<td className="p-6 text-center">
										{(item.item_type || "material") === "maquina" ? (
											<span className="text-gray-300">—</span>
										) : (
											<span
												className={`px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${
													Number(item.stock) <= Number(item.min_stock)
														? "bg-rose-50 text-rose-600 border border-rose-100"
														: "bg-emerald-50 text-emerald-600 border border-emerald-100"
												}`}>
												{item.stock}
											</span>
										)}
									</td>
									<td className="p-6 text-center">
										{(item.item_type || "material") === "maquina" ? (
											<span className="text-gray-300">—</span>
										) : (
											(() => {
												const next = getEarliestExpiry(item.id);
												if (!next)
													return <span className="text-gray-300">—</span>;
												const isExpiringSoon =
													new Date(next.expiry_date) - new Date() <
													90 * 24 * 60 * 60 * 1000;
												return (
													<span
														title={`Lote ${next.lot_number}`}
														className={
															isExpiringSoon
																? "text-amber-600 font-bold text-sm"
																: "text-gray-500 text-sm"
														}>
														{formatDate(next.expiry_date)}
													</span>
												);
											})()
										)}
									</td>
									<td className="p-6 text-center">
										<span className="font-bold text-gray-600 text-lg">
											{Number(item.unit_cost).toFixed(2)} €
											{(item.item_type || "material") === "maquina" && (
												<span className="text-xs font-normal text-gray-400">/sesión</span>
											)}
										</span>
									</td>
									<td className="p-6 text-right">
										<div className="flex justify-end gap-2">
											{(item.item_type || "material") !== "maquina" && (
												<button
													onClick={() => openRestockModal(item)}
													className="p-2.5 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
													title="Reponer Stock">
													<Plus size={18} />
												</button>
											)}
											<button
												onClick={() => openModal(item)}
												className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-200 transition-all shadow-sm"
												title="Editar material">
												<Edit2 size={18} />
											</button>
											{canDeleteOperational && (
												<button
													onClick={() => handleDeleteClick(item)}
													className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
													title="Eliminar material">
													<Trash2 size={18} />
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={
					editingItem
						? formData.item_type === "maquina"
							? "Editar Máquina"
							: "Editar Material"
						: formData.item_type === "maquina"
							? "Nueva Máquina"
							: "Nuevo Material"
				}
				maxWidth="max-w-lg">
				<form onSubmit={handleSave} className="space-y-6">
					{!editingItem && (
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								Tipo
							</label>
							<select
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer"
								value={formData.item_type}
								onChange={(e) =>
									setFormData({
										...formData,
										item_type: e.target.value,
										costPerUse: formData.costPerUse || "",
									})
								}>
								<option value="material">Material (consumible con stock)</option>
								<option value="maquina">Máquina (coste por uso, ej. alquiler)</option>
							</select>
						</div>
					)}
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
							{formData.item_type === "maquina" ? "Nombre de la máquina" : "Nombre del Producto"}
						</label>
						<input
							required
							placeholder={formData.item_type === "maquina" ? "Ej: Diatermia" : "Ej: Agujas 30G"}
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-gray-200 focus:bg-white rounded-2xl outline-none font-bold"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
						/>
					</div>
					{formData.item_type === "maquina" ? (
						<div>
							<label className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-2 block ml-1">
								Coste por uso (€/sesión)
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								placeholder="Ej: 10"
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-rose-500 placeholder-rose-300"
								value={formData.costPerUse}
								onChange={(e) =>
									setFormData({ ...formData, costPerUse: e.target.value })
								}
							/>
							<p className="text-xs text-gray-500 mt-2 ml-1">
								Se sumará al coste del tratamiento cada vez que uses esta máquina en una sesión.
							</p>
						</div>
					) : (
						<>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								Stock Actual
								{editingItem && (
									<span className="text-gray-400 font-normal ml-1">
										(solo lectura, usa Reponer)
									</span>
								)}
							</label>
							<input
								type="number"
								placeholder="Ej: 100"
								readOnly={!!editingItem}
								className={`w-full p-4 rounded-2xl outline-none font-bold ${
									editingItem ? "bg-gray-100 text-gray-500" : "bg-gray-50"
								}`}
								value={formData.stock}
								onChange={(e) =>
									!editingItem &&
									setFormData({ ...formData, stock: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								Unidad
							</label>
							<select
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer"
								value={formData.unit}
								onChange={(e) =>
									setFormData({ ...formData, unit: e.target.value })
								}>
								<option value="uds">uds</option>
								<option value="dosis">dosis</option>
								<option value="ml">ml</option>
								<option value="paq">paq</option>
								<option value="g">g</option>
							</select>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-2 block ml-1">
								Coste Total (€)
							</label>
							<input
								type="number"
								step="0.01"
								placeholder="Ej: 25.50"
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-rose-500 placeholder-rose-300"
								value={formData.totalCost}
								onChange={(e) =>
									setFormData({ ...formData, totalCost: e.target.value })
								}
							/>
							{formData.stock &&
								formData.totalCost &&
								Number(formData.stock) > 0 && (
									<p className="text-xs text-gray-500 mt-2 ml-1">
										Coste unitario calculado:{" "}
										{calculateUnitCost(
											formData.totalCost,
											formData.stock,
										).toFixed(2)}{" "}
										€
									</p>
								)}
						</div>
						{!editingItem && formData.is_deductible && (
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
									IVA (%)
								</label>
								<select
									className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer"
									value={formData.tax_rate}
									onChange={(e) =>
										setFormData({
											...formData,
											tax_rate: Number(e.target.value),
										})
									}>
									{IVA_OPTIONS.map((v) => (
										<option key={v} value={v}>
											{v}%
										</option>
									))}
								</select>
							</div>
						)}
						<div className={!editingItem ? "col-span-2" : ""}>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								Aviso Mínimo
							</label>
							<input
								type="number"
								placeholder="Ej: 5"
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
								value={formData.min_stock}
								onChange={(e) =>
									setFormData({ ...formData, min_stock: e.target.value })
								}
							/>
						</div>
					</div>
					{editingItem && editBatches.length > 0 && (
						<div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
							<p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
								Lotes (corregir nº lote o caducidad)
							</p>
							{editBatches.map((b) => (
								<BatchEditRow
									key={`${b.id}-${b.lot_number}-${b.expiry_date}`}
									batch={b}
									onSave={async (updates) => {
										await updateBatch.mutateAsync({ batchId: b.id, updates });
										const next = editBatches.map((x) =>
											x.id === b.id ? { ...x, ...updates } : x,
										);
										setEditBatches(next);
										showToast("Lote actualizado");
									}}
									showToast={showToast}
								/>
							))}
						</div>
					)}
					{!editingItem && Number(formData.stock) > 0 && (
						<div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
							<p className="text-xs font-bold text-amber-800 uppercase">
								Trazabilidad y compra
							</p>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
									Fecha de compra <span className="text-rose-500">*</span>
								</label>
								<input
									type="date"
									required
									className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
									value={formData.purchaseDate || ""}
									onChange={(e) =>
										setFormData({ ...formData, purchaseDate: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
									Nº de Lote <span className="text-rose-500">*</span>
								</label>
								<input
									type="text"
									required
									placeholder="Ej: L2024-001"
									className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
									value={formData.lotNumber}
									onChange={(e) =>
										setFormData({ ...formData, lotNumber: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
									Fecha de Caducidad <span className="text-rose-500">*</span>
								</label>
								<input
									type="date"
									required
									className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
									value={formData.expiryDate}
									onChange={(e) =>
										setFormData({ ...formData, expiryDate: e.target.value })
									}
								/>
							</div>
							<label className="flex items-start gap-3 cursor-pointer p-3 bg-white rounded-xl border border-amber-200">
								<input
									type="checkbox"
									checked={formData.is_deductible}
									onChange={(e) =>
										setFormData({
											...formData,
											is_deductible: e.target.checked,
										})
									}
									className="mt-0.5 w-5 h-5 rounded border-gray-300 text-rose-600"
								/>
								<span className="text-sm font-bold text-gray-800">
									Factura deducible (IVA en modelo 303)
									<span className="block text-xs font-normal text-gray-500 mt-0.5">
										Sin marcar: compra rápida (farmacia, etc.). Solo trazabilidad;
										no se deduce IVA.
									</span>
								</span>
							</label>
							{formData.is_deductible ? (
								<div className="space-y-4 pt-1 border-t border-amber-200">
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											Proveedor (nombre) <span className="text-rose-500">*</span>
										</label>
										<input
											type="text"
											required
											list="inventory-providers-list"
											placeholder="Ej: Distribuciones Estéticas SL"
											className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
											value={formData.provider_name}
											onChange={(e) =>
												setFormData({
													...formData,
													provider_name: e.target.value,
												})
											}
											onBlur={(e) =>
												applyProviderFromName(e.target.value, setFormData)
											}
										/>
									</div>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											NIF/CIF Proveedor <span className="text-rose-500">*</span>
										</label>
										<input
											required
											placeholder="Ej: B12345678"
											className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
											value={formData.supplier_nif}
											onChange={(e) =>
												setFormData({
													...formData,
													supplier_nif: e.target.value,
												})
											}
										/>
									</div>
									<div>
										<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
											Nº Factura Proveedor <span className="text-rose-500">*</span>
										</label>
										<input
											required
											placeholder="Ej: F2026-001"
											className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
											value={formData.invoice_number}
											onChange={(e) =>
												setFormData({
													...formData,
													invoice_number: e.target.value,
												})
											}
										/>
									</div>
								</div>
							) : (
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
										Origen (opcional)
									</label>
									<input
										type="text"
										list="inventory-providers-list"
										placeholder={GENERIC_PURCHASE_PROVIDER}
										className="w-full p-4 bg-white rounded-2xl outline-none font-bold border border-amber-200"
										value={formData.provider_name}
										onChange={(e) =>
											setFormData({
												...formData,
												provider_name: e.target.value,
											})
										}
										onBlur={(e) =>
											applyProviderFromName(e.target.value, setFormData)
										}
									/>
									<p className="text-xs text-amber-900/80 mt-2 ml-1">
										Si lo dejas vacío se guardará como «{GENERIC_PURCHASE_PROVIDER}».
									</p>
								</div>
							)}
						</div>
					)}
						</>
					)}
					<div className="pt-4">
						<LoadingButton
							loading={loading}
							type="submit"
							className="w-full bg-surface-dark text-white font-black py-4 rounded-xl shadow-lg">
							{loading ? "Guardando..." : formData.item_type === "maquina" ? "Guardar Máquina" : "Guardar Material"}
						</LoadingButton>
					</div>
				</form>
			</AdaptiveModal>

			<AdaptiveModal
				isOpen={isRestockModalOpen}
				onClose={() => setIsRestockModalOpen(false)}
				title={`Reponer: ${restockItem?.name || ""}`}
				maxWidth="max-w-md">
				<form onSubmit={handleRestock} className="space-y-6">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Fecha de compra <span className="text-rose-500">*</span>
						</label>
						<input
							type="date"
							required
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							value={restockData.purchaseDate || ""}
							onChange={(e) =>
								setRestockData({ ...restockData, purchaseDate: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Nº de Lote <span className="text-rose-500">*</span>
						</label>
						<input
							type="text"
							required
							placeholder="Ej: L2024-001"
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							value={restockData.lotNumber}
							onChange={(e) =>
								setRestockData({ ...restockData, lotNumber: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Fecha de Caducidad <span className="text-rose-500">*</span>
						</label>
						<input
							type="date"
							required
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							value={restockData.expiryDate}
							onChange={(e) =>
								setRestockData({ ...restockData, expiryDate: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Cantidad Comprada ({restockItem?.unit || "uds"})
						</label>
						<input
							type="number"
							step={(restockItem?.unit || "uds") === "ml" ? "0.1" : "1"}
							required
							placeholder="0"
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none"
							value={restockData.quantity}
							onChange={(e) =>
								setRestockData({ ...restockData, quantity: e.target.value })
							}
						/>
					</div>
					<div className={restockData.is_deductible ? "grid grid-cols-2 gap-4" : ""}>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
								Coste Total (€)
							</label>
							<input
								type="number"
								step="0.01"
								required
								placeholder="0.00"
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none"
								value={restockData.totalCost}
								onChange={(e) =>
									setRestockData({
										...restockData,
										totalCost: e.target.value,
									})
								}
							/>
						</div>
						{restockData.is_deductible && (
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
									IVA (%)
								</label>
								<select
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none cursor-pointer"
									value={restockData.taxRate}
									onChange={(e) =>
										setRestockData({
											...restockData,
											taxRate: Number(e.target.value),
										})
									}>
									{IVA_OPTIONS.map((v) => (
										<option key={v} value={v}>
											{v}%
										</option>
									))}
								</select>
							</div>
						)}
					</div>
					<label className="flex items-start gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
						<input
							type="checkbox"
							checked={restockData.is_deductible}
							onChange={(e) =>
								setRestockData({
									...restockData,
									is_deductible: e.target.checked,
								})
							}
							className="mt-0.5 w-5 h-5 rounded border-gray-300 text-blue-600"
						/>
						<span className="text-sm font-bold text-gray-800">
							Factura deducible (IVA en modelo 303)
							<span className="block text-xs font-normal text-gray-500 mt-0.5">
								Desmarcado: compra sin factura completa (p. ej. farmacia).
							</span>
						</span>
					</label>
					{restockData.is_deductible ? (
					<>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Proveedor (nombre) <span className="text-rose-500">*</span>
						</label>
						<input
							type="text"
							required
							list="inventory-providers-list"
							placeholder="Ej: Distribuciones Estéticas SL"
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							value={restockData.provider_name}
							onChange={(e) =>
								setRestockData({ ...restockData, provider_name: e.target.value })
							}
							onBlur={(e) =>
								applyProviderFromName(e.target.value, setRestockData)
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							NIF/CIF Proveedor <span className="text-rose-500">*</span>
						</label>
						<div className="relative">
							<input
								required
								placeholder="Ej: B12345678"
								className={`w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 transition-colors ${
									restockNifValidation.valid
										? "border-transparent focus:border-blue-300"
										: "border-red-300 bg-red-50 focus:border-red-400"
								}`}
								value={restockData.supplier_nif}
								onChange={(e) =>
									setRestockData({
										...restockData,
										supplier_nif: e.target.value,
									})
								}
								onFocus={() =>
									setShowRestockSuggestions(
										restockInvoiceSuggestions.length > 0,
									)
								}
							/>
							{restockNifValidation.error && (
								<p className="mt-1 text-xs font-bold text-red-600 flex items-center gap-1">
									<AlertCircle size={12} />
									{restockNifValidation.error}
								</p>
							)}
							{restockNifValidation.valid && restockNifValidation.type && (
								<p className="mt-1 text-xs font-bold text-emerald-600">
									✓ {restockNifValidation.type} válido
								</p>
							)}
						</div>
						{showRestockSuggestions && restockInvoiceSuggestions.length > 0 && (
							<div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
								<p className="text-xs font-bold text-blue-800 mb-2">
									Facturas anteriores de este proveedor:
								</p>
								<div className="space-y-2">
									{restockInvoiceSuggestions.map((sug, idx) => (
										<button
											key={idx}
											type="button"
											onClick={() => useRestockInvoiceSuggestion(sug)}
											className="w-full p-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center justify-between group">
											<div className="flex-1 min-w-0">
												<p className="text-xs font-bold text-gray-800 truncate">
													Factura: {sug.invoice_number}
												</p>
												<p className="text-[10px] text-gray-500">
													{sug.date} • {sug.count} material(es)
												</p>
											</div>
											<Copy
												size={14}
												className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
											/>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Nº Factura Proveedor <span className="text-rose-500">*</span>
						</label>
						<input
							required
							placeholder="Ej: F2026-001"
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
							value={restockData.invoice_number}
							onChange={(e) =>
								setRestockData({
									...restockData,
									invoice_number: normalizeInvoiceNumber(e.target.value),
								})
							}
						/>
					</div>
					</>
					) : (
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
								Origen (opcional)
							</label>
							<input
								type="text"
								list="inventory-providers-list"
								placeholder={GENERIC_PURCHASE_PROVIDER}
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"
								value={restockData.provider_name}
								onChange={(e) =>
									setRestockData({
										...restockData,
										provider_name: e.target.value,
									})
								}
								onBlur={(e) =>
									applyProviderFromName(e.target.value, setRestockData)
								}
							/>
							<p className="text-xs text-gray-500 mt-2 ml-1">
								Vacío → «{GENERIC_PURCHASE_PROVIDER}». El gasto no deduce IVA.
							</p>
						</div>
					)}
					{restockData.is_deductible && restockDateWarning?.warning && (
						<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
							<p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2">
								<AlertCircle size={14} />
								{restockDateWarning.warning}
							</p>
							{restockDateWarning.suggestedDate && (
								<button
									type="button"
									onClick={() =>
										setRestockData((prev) => ({
											...prev,
											purchaseDate: restockDateWarning.suggestedDate,
										}))
									}
									className="text-xs font-bold text-amber-700 hover:underline">
									Usar fecha: {restockDateWarning.suggestedDate}
								</button>
							)}
						</div>
					)}
					{restockData.is_deductible && (
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase mb-2 block ml-1">
							Factura (PDF/imagen) <span className="text-gray-400 font-normal">(opcional)</span>
							<span className="text-xs text-gray-400 ml-2 block mt-0.5">
								Se compartirá con otros materiales de la misma factura si la subes
							</span>
						</label>
						{restockReceiptPreview && (
							<div className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
								<p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
									<ImageIcon size={14} />
									Vista previa:
								</p>
								<img
									src={restockReceiptPreview}
									alt="Preview"
									className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300"
								/>
							</div>
						)}
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,application/pdf"
							className="w-full p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:font-bold file:bg-blue-50 file:text-blue-600"
							onChange={handleRestockFileChange}
						/>
						{restockReceiptFile && (
							<p className="mt-2 text-xs font-bold text-emerald-600">
								✓ Archivo seleccionado: {restockReceiptFile.name} (
								{(restockReceiptFile.size / 1024 / 1024).toFixed(2)} MB)
							</p>
						)}
						{restockFileValidation.error && (
							<p className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
								<AlertCircle size={12} />
								{restockFileValidation.error}
							</p>
						)}
					</div>
					)}
					<LoadingButton
						loading={loading}
						type="submit"
						className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg">
						{loading ? "Guardando..." : "Confirmar Compra"}
					</LoadingButton>
				</form>
			</AdaptiveModal>

			<ProviderDatalist
				id="inventory-providers-list"
				directory={supplierDirectory}
			/>
		</div>
	);
};
