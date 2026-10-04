import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";
import { resolvePurchaseAmounts } from "../utils/purchaseTax";
import {
	GENERIC_PURCHASE_PROVIDER,
	isDeductiblePurchase,
} from "../utils/inventoryPurchase";
import { normalizeInvoiceNumber, validateSpanishTaxId } from "../utils/validations";
import {
	adjustInventoryStock,
	logStockMovements,
} from "../services/inventoryBatches";

const resolveDeductibleFields = (data) => {
	const isDeductible = isDeductiblePurchase(data);
	let providerName = data.provider_name?.trim() || "";
	let supplierNif = data.supplier_nif?.trim() || "";
	let invoiceNumber = data.invoice_number?.trim() || "";

	if (isDeductible) {
		if (!providerName || !supplierNif || !invoiceNumber) {
			throw new Error(
				"Para factura deducible: proveedor, NIF y nº de factura son obligatorios",
			);
		}
		const nifValidation = validateSpanishTaxId(supplierNif);
		if (!nifValidation.valid) throw new Error(nifValidation.error || "NIF no válido");
		supplierNif = nifValidation.normalized || supplierNif;
		invoiceNumber = normalizeInvoiceNumber(invoiceNumber);
	} else {
		providerName = providerName || GENERIC_PURCHASE_PROVIDER;
		supplierNif = "";
		invoiceNumber = "";
	}
	return { isDeductible, providerName, supplierNif, invoiceNumber };
};

export const useCreateMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ formData }) => {
			const isMaquina = formData.item_type === "maquina";

			if (isMaquina) {
				const costPerUse = Number(formData.costPerUse);
				if (costPerUse < 0 || Number.isNaN(costPerUse))
					throw new Error("El coste por uso debe ser un número válido (ej. 10)");
				const payload = {
					name: formData.name,
					stock: 0,
					unit: "sesión",
					unit_cost: costPerUse,
					min_stock: 0,
					item_type: "maquina",
					user_id: userId,
					clinic_id: clinicId,
					activo: true,
				};
				const { error: invError } = await supabase
					.from("inventory")
					.insert([payload]);
				if (invError) throw invError;
				return;
			}

			const stockNum = Number(formData.stock);
			if (stockNum <= 0) throw new Error("El stock debe ser mayor a 0");

			const purchaseDate = formData.purchaseDate?.trim();
			if (!purchaseDate) throw new Error("La fecha de compra es obligatoria");

			const lotNumber = String(formData.lotNumber || "").trim();
			const expiryDate = formData.expiryDate;
			if (stockNum > 0 && (!lotNumber || !expiryDate)) {
				throw new Error("El nº de lote y la fecha de caducidad son obligatorios");
			}

			const { isDeductible, providerName, supplierNif, invoiceNumber } =
				resolveDeductibleFields(formData);

			const taxRate = isDeductible
				? formData.tax_rate != null
					? Number(formData.tax_rate)
					: 21
				: 0;
			const { baseAmount, taxAmount, totalAmount } = resolvePurchaseAmounts({
				amountInput: formData.totalCost,
				taxRate,
				priceMode: formData.priceMode || "included",
				isDeductible,
			});

			const calculatedUnitCost = totalAmount / stockNum;
			const payload = {
				name: formData.name,
				stock: stockNum,
				unit: formData.unit,
				unit_cost: calculatedUnitCost,
				min_stock: Number(formData.min_stock),
				item_type: "material",
				user_id: userId,
				clinic_id: clinicId,
				activo: true,
			};
			const { data: inserted, error: invError } = await supabase
				.from("inventory")
				.insert([payload])
				.select()
				.single();
			if (invError) throw invError;

			let batchId = null;
			if (stockNum > 0 && lotNumber && expiryDate) {
				const { data: batch, error: batchError } = await supabase
					.from("inventory_batches")
					.insert([
						{
							inventory_id: inserted.id,
							user_id: userId,
							clinic_id: clinicId,
							lot_number: lotNumber,
							expiry_date: expiryDate,
							quantity_remaining: stockNum,
						},
					])
					.select("id")
					.single();
				if (batchError) throw batchError;
				batchId = batch?.id || null;
			}

			const { data: finRow, error: finError } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: userId,
						clinic_id: clinicId,
						type: "expense",
						category: "Material",
						description:
							`Compra Stock Inicial: ${formData.name}` +
							(lotNumber ? ` Lote: ${lotNumber}` : ""),
						amount: totalAmount,
						total_amount: totalAmount,
						tax_rate: taxRate,
						tax_base: baseAmount,
						tax_amount: taxAmount,
						is_deductible: isDeductible,
						provider_name: providerName,
						supplier_nif: supplierNif || null,
						invoice_number: invoiceNumber || null,
						date: purchaseDate,
						activo: true,
					},
				])
				.select("id")
				.single();
			if (finError) throw finError;

			await logStockMovements([
				{
					clinic_id: clinicId,
					user_id: userId,
					inventory_id: inserted.id,
					batch_id: batchId,
					movement_type: "purchase",
					quantity: stockNum,
					reason: "Alta de material",
					finance_entry_id: finRow?.id || null,
					occurred_at: purchaseDate,
					metadata: { lot_number: lotNumber },
				},
			]);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["stock_movements", clinicId] });
		},
	});
};

export const useUpdateMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ editingItem, formData }) => {
			const isMaquina =
				editingItem?.item_type === "maquina" || formData.item_type === "maquina";
			if (isMaquina) {
				const costPerUse = Number(formData.costPerUse);
				if (costPerUse < 0 || Number.isNaN(costPerUse))
					throw new Error("El coste por uso debe ser un número válido");
				const payload = {
					name: formData.name,
					unit_cost: costPerUse,
					user_id: userId,
				};
				const { error } = await supabase
					.from("inventory")
					.update(payload)
					.eq("id", editingItem.id);
				if (error) throw error;
				return;
			}
			const payload = {
				name: formData.name,
				unit: formData.unit,
				min_stock: Number(formData.min_stock),
				user_id: userId,
			};
			// No tocar stock aquí: usar Ajustar stock / Reponer
			const { error } = await supabase
				.from("inventory")
				.update(payload)
				.eq("id", editingItem.id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
		},
	});
};

export const useRestockMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ restockItem, restockData }) => {
			const qtyBought = Number(restockData.quantity);
			const lotNumber = String(restockData.lotNumber || "").trim();
			const expiryDate = restockData.expiryDate;

			const purchaseDate = restockData.purchaseDate?.trim();
			if (!purchaseDate) throw new Error("La fecha de compra es obligatoria");
			if (!lotNumber) throw new Error("El número de lote es obligatorio");
			if (!expiryDate) throw new Error("La fecha de caducidad es obligatoria");
			if (qtyBought <= 0) throw new Error("La cantidad debe ser mayor a 0");

			const { isDeductible, providerName, supplierNif, invoiceNumber } =
				resolveDeductibleFields(restockData);

			const taxRate = isDeductible
				? restockData.taxRate != null
					? Number(restockData.taxRate)
					: restockData.tax_rate != null
						? Number(restockData.tax_rate)
						: 21
				: 0;
			const { baseAmount, taxAmount, totalAmount } = resolvePurchaseAmounts({
				amountInput: restockData.totalCost,
				taxRate,
				priceMode: restockData.priceMode || "included",
				isDeductible,
			});

			const currentStock = Number(restockItem.stock);
			const currentUnitCost = Number(restockItem.unit_cost);
			const newStock = currentStock + qtyBought;
			const newUnitCost =
				newStock > 0
					? (currentStock * currentUnitCost + totalAmount) / newStock
					: totalAmount / qtyBought;

			const { data: batch, error: batchError } = await supabase
				.from("inventory_batches")
				.insert([
					{
						inventory_id: restockItem.id,
						user_id: userId,
						clinic_id: clinicId,
						lot_number: lotNumber,
						expiry_date: expiryDate,
						quantity_remaining: qtyBought,
					},
				])
				.select("id")
				.single();
			if (batchError) throw batchError;

			const { error } = await supabase
				.from("inventory")
				.update({
					stock: newStock,
					unit_cost: parseFloat(newUnitCost.toFixed(4)),
				})
				.eq("id", restockItem.id);
			if (error) throw error;

			const invoiceKey =
				isDeductible && supplierNif && invoiceNumber
					? `${supplierNif}_${invoiceNumber}`
					: null;

			const { data: finRow, error: finError } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: userId,
						clinic_id: clinicId,
						date: purchaseDate,
						type: "expense",
						category: "Material",
						description: `Reposición: ${restockItem.name} (${qtyBought} ${restockItem.unit}) Lote: ${lotNumber}`,
						amount: totalAmount,
						total_amount: totalAmount,
						tax_rate: taxRate,
						tax_base: baseAmount,
						tax_amount: taxAmount,
						is_deductible: isDeductible,
						provider_name: providerName,
						supplier_nif: supplierNif || null,
						invoice_number: invoiceNumber || null,
						activo: true,
					},
				])
				.select("id")
				.single();
			if (finError) throw finError;

			await logStockMovements([
				{
					clinic_id: clinicId,
					user_id: userId,
					inventory_id: restockItem.id,
					batch_id: batch?.id || null,
					movement_type: "restock",
					quantity: qtyBought,
					reason: "Reposición",
					finance_entry_id: finRow?.id || null,
					occurred_at: purchaseDate,
					metadata: { lot_number: lotNumber },
				},
			]);

			if (restockData.receiptFile && invoiceKey) {
				try {
					const { uploadReceipt } = await import("../services/receiptStorage");
					const path = await uploadReceipt(
						userId,
						null,
						restockData.receiptFile,
						invoiceKey,
					);
					await supabase
						.from("finance_entries")
						.update({ file_url: path })
						.eq("clinic_id", clinicId)
						.eq("supplier_nif", supplierNif)
						.eq("invoice_number", invoiceNumber)
						.is("file_url", null);
				} catch (fileErr) {
					console.error("Error subiendo archivo compartido:", fileErr);
				}
			} else if (restockData.receiptFile && finRow?.id) {
				try {
					const { uploadReceipt } = await import("../services/receiptStorage");
					const path = await uploadReceipt(userId, finRow.id, restockData.receiptFile);
					await supabase
						.from("finance_entries")
						.update({ file_url: path })
						.eq("id", finRow.id);
				} catch (fileErr) {
					console.error("Error subiendo archivo:", fileErr);
				}
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["stock_movements", clinicId] });
		},
	});
};

/** Compra de N líneas bajo una misma factura. */
export const useInvoiceBatchPurchase = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ header, lines }) => {
			if (!clinicId) throw new Error("Clínica no disponible");
			const purchaseDate = header.purchaseDate?.trim();
			if (!purchaseDate) throw new Error("La fecha de compra es obligatoria");
			if (!lines?.length) throw new Error("Añade al menos una línea de producto");

			const { isDeductible, providerName, supplierNif, invoiceNumber } =
				resolveDeductibleFields(header);

			const taxRate = isDeductible
				? header.tax_rate != null
					? Number(header.tax_rate)
					: 21
				: 0;
			const priceMode = header.priceMode || "included";

			for (const line of lines) {
				const name = String(line.name || "").trim();
				const qty = Number(line.quantity);
				const lineCost = Number(line.totalCost);
				const lotNumber = String(line.lotNumber || "").trim();
				const expiryDate = line.expiryDate;
				if (!name) throw new Error("Cada línea necesita nombre de producto");
				if (qty <= 0) throw new Error(`Cantidad inválida en «${name}»`);
				if (!lotNumber || !expiryDate) {
					throw new Error(`Lote y caducidad obligatorios en «${name}»`);
				}

				const { baseAmount, taxAmount, totalAmount } = resolvePurchaseAmounts({
					amountInput: lineCost,
					taxRate,
					priceMode,
					isDeductible,
				});

				let inventoryId = line.inventoryId || null;
				let unit = line.unit || "uds";

				if (inventoryId) {
					const { data: existing, error: exErr } = await supabase
						.from("inventory")
						.select("id, stock, unit_cost, unit, name")
						.eq("id", inventoryId)
						.single();
					if (exErr) throw exErr;
					unit = existing.unit || unit;
					const currentStock = Number(existing.stock);
					const currentUnitCost = Number(existing.unit_cost);
					const newStock = currentStock + qty;
					const newUnitCost =
						(currentStock * currentUnitCost + totalAmount) / newStock;
					const { error: updErr } = await supabase
						.from("inventory")
						.update({
							stock: newStock,
							unit_cost: parseFloat(newUnitCost.toFixed(4)),
						})
						.eq("id", inventoryId);
					if (updErr) throw updErr;
				} else {
					const { data: inserted, error: insErr } = await supabase
						.from("inventory")
						.insert([
							{
								name,
								stock: qty,
								unit,
								unit_cost: totalAmount / qty,
								min_stock: Number(line.min_stock) || 5,
								item_type: "material",
								user_id: userId,
								clinic_id: clinicId,
								activo: true,
							},
						])
						.select()
						.single();
					if (insErr) throw insErr;
					inventoryId = inserted.id;
				}

				const { data: batch, error: batchError } = await supabase
					.from("inventory_batches")
					.insert([
						{
							inventory_id: inventoryId,
							user_id: userId,
							clinic_id: clinicId,
							lot_number: lotNumber,
							expiry_date: expiryDate,
							quantity_remaining: qty,
						},
					])
					.select("id")
					.single();
				if (batchError) throw batchError;

				const { data: finRow, error: finError } = await supabase
					.from("finance_entries")
					.insert([
						{
							user_id: userId,
							clinic_id: clinicId,
							date: purchaseDate,
							type: "expense",
							category: "Material",
							description: `Factura ${invoiceNumber || "compra"}: ${name} (${qty} ${unit}) Lote: ${lotNumber}`,
							amount: totalAmount,
							total_amount: totalAmount,
							tax_rate: taxRate,
							tax_base: baseAmount,
							tax_amount: taxAmount,
							is_deductible: isDeductible,
							provider_name: providerName,
							supplier_nif: supplierNif || null,
							invoice_number: invoiceNumber || null,
							activo: true,
						},
					])
					.select("id")
					.single();
				if (finError) throw finError;

				await logStockMovements([
					{
						clinic_id: clinicId,
						user_id: userId,
						inventory_id: inventoryId,
						batch_id: batch?.id || null,
						movement_type: inventoryId && line.inventoryId ? "restock" : "purchase",
						quantity: qty,
						reason: "Compra factura múltiple",
						finance_entry_id: finRow?.id || null,
						occurred_at: purchaseDate,
						metadata: {
							lot_number: lotNumber,
							invoice_number: invoiceNumber,
							batch_invoice: true,
						},
					},
				]);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["stock_movements", clinicId] });
		},
	});
};

export const useAdjustStock = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async (payload) => {
			if (!clinicId) throw new Error("Clínica no disponible");
			return adjustInventoryStock({
				...payload,
				clinicId,
				userId,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["stock_movements", clinicId] });
		},
	});
};

export const useUpdateBatch = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ batchId, updates }) => {
			const { error } = await supabase
				.from("inventory_batches")
				.update(updates)
				.eq("id", batchId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
		},
	});
};

export const useDeleteMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async (itemId) => {
			const { error } = await supabase
				.from("inventory")
				.update({ activo: false })
				.eq("id", itemId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
		},
	});
};
