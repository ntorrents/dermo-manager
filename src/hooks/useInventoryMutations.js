import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";
import { calculateTaxFromTotal } from "../utils/format";
import { normalizeInvoiceNumber } from "../utils/validations";

export const useCreateMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ formData, taxCalc }) => {
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
				};
				const { error: invError } = await supabase
					.from("inventory")
					.insert([payload]);
				if (invError) throw invError;
				return;
			}

			const stockNum = Number(formData.stock);
			const totalCostNum = Number(formData.totalCost);
			if (stockNum <= 0) throw new Error("El stock debe ser mayor a 0");

			const lotNumber = String(formData.lotNumber || "").trim();
			const expiryDate = formData.expiryDate;
			if (stockNum > 0 && (!lotNumber || !expiryDate)) {
				throw new Error("Lote y fecha de caducidad son obligatorios para el stock inicial");
			}

			const calculatedUnitCost = totalCostNum / stockNum;
			const payload = {
				name: formData.name,
				stock: stockNum,
				unit: formData.unit,
				unit_cost: calculatedUnitCost,
				min_stock: Number(formData.min_stock),
				item_type: "material",
				user_id: userId,
			};
			const { data: inserted, error: invError } = await supabase
				.from("inventory")
				.insert([payload])
				.select()
				.single();
			if (invError) throw invError;

			if (stockNum > 0 && lotNumber && expiryDate) {
				const { error: batchError } = await supabase
					.from("inventory_batches")
					.insert([
						{
							inventory_id: inserted.id,
							user_id: userId,
							lot_number: lotNumber,
							expiry_date: expiryDate,
							quantity_remaining: stockNum,
						},
					]);
				if (batchError) throw batchError;
			}

			const taxRate = formData.tax_rate != null ? Number(formData.tax_rate) : 21;
			const purchaseDate = formData.purchaseDate || new Date().toISOString().split("T")[0];
			const { baseAmount, taxAmount } = calculateTaxFromTotal(totalCostNum, taxRate);
			const { error: finError } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					type: "expense",
					category: "Material",
					description: `Compra Stock Inicial: ${formData.name}` + (lotNumber ? ` Lote: ${lotNumber}` : ""),
					amount: totalCostNum,
					total_amount: totalCostNum,
					tax_rate: taxRate,
					tax_base: baseAmount,
					tax_amount: taxAmount,
					is_deductible: true,
					supplier_nif: formData.supplier_nif?.trim() || null,
					invoice_number: formData.invoice_number ? normalizeInvoiceNumber(formData.invoice_number) : null,
					date: purchaseDate,
					activo: true,
				},
			]);
			if (finError) throw finError;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
		},
	});
};

export const useUpdateMaterial = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();
	return useMutation({
		mutationFn: async ({ editingItem, formData }) => {
			const isMaquina = editingItem?.item_type === "maquina" || formData.item_type === "maquina";
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
			const stockNum = Number(formData.stock);
			const totalCostNum = Number(formData.totalCost);
			const calculatedUnitCost = totalCostNum / stockNum;
			const payload = {
				name: formData.name,
				stock: stockNum,
				unit: formData.unit,
				unit_cost: calculatedUnitCost,
				min_stock: Number(formData.min_stock),
				user_id: userId,
			};
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
			const purchaseCost = Number(restockData.totalCost);
			const lotNumber = String(restockData.lotNumber || "").trim();
			const expiryDate = restockData.expiryDate;

			if (!lotNumber) throw new Error("El número de lote es obligatorio");
			if (!expiryDate) throw new Error("La fecha de caducidad es obligatoria");

			const currentStock = Number(restockItem.stock);
			const currentUnitCost = Number(restockItem.unit_cost);
			const newStock = currentStock + qtyBought;
			const newUnitCost =
				(currentStock * currentUnitCost + purchaseCost) / newStock;

			const { error: batchError } = await supabase
				.from("inventory_batches")
				.insert([
					{
						inventory_id: restockItem.id,
						user_id: userId,
						lot_number: lotNumber,
						expiry_date: expiryDate,
						quantity_remaining: qtyBought,
					},
				]);
			if (batchError) throw batchError;

			const { error } = await supabase
				.from("inventory")
				.update({
					stock: newStock,
					unit_cost: parseFloat(newUnitCost.toFixed(4)),
				})
				.eq("id", restockItem.id);
			if (error) throw error;

			const purchaseDate = restockData.purchaseDate || new Date().toISOString().split("T")[0];
			const taxRate = restockData.taxRate != null ? Number(restockData.taxRate) : 21;
			const { baseAmount, taxAmount } = calculateTaxFromTotal(purchaseCost, taxRate);
			
			// Crear clave única de factura si hay NIF y número de factura
			// Esto permite que múltiples materiales de la misma factura compartan el mismo archivo
			const supplierNif = restockData.supplier_nif?.trim() || null;
			const invoiceNumber = restockData.invoice_number ? normalizeInvoiceNumber(restockData.invoice_number) : null;
			const invoiceKey = supplierNif && invoiceNumber 
				? `${supplierNif}_${invoiceNumber}` 
				: null;
			
			const { error: finError } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					date: purchaseDate,
					type: "expense",
					category: "Material",
					description: `Reposición: ${restockItem.name} (${qtyBought} ${restockItem.unit}) Lote: ${lotNumber}`,
					amount: purchaseCost,
					total_amount: purchaseCost,
					tax_rate: taxRate,
					tax_base: baseAmount,
					tax_amount: taxAmount,
					is_deductible: true,
					supplier_nif: supplierNif,
					invoice_number: invoiceNumber,
					activo: true,
				},
			]);
			if (finError) throw finError;
			
			// Si hay archivo y invoiceKey, subirlo usando la clave única
			// Esto permite que múltiples gastos compartan el mismo archivo
			if (restockData.receiptFile && invoiceKey) {
				try {
					const { uploadReceipt } = await import("../services/receiptStorage");
					const path = await uploadReceipt(userId, null, restockData.receiptFile, invoiceKey);
					// Actualizar todos los gastos con el mismo invoiceKey para que referencien el mismo archivo
					await supabase
						.from("finance_entries")
						.update({ file_url: path })
						.eq("clinic_id", clinicId)
						.eq("supplier_nif", supplierNif)
						.eq("invoice_number", invoiceNumber)
						.is("file_url", null);
				} catch (fileErr) {
					console.error("Error subiendo archivo compartido:", fileErr);
					// No lanzar error, el gasto ya está guardado
				}
			} else if (restockData.receiptFile && !invoiceKey) {
				// Si hay archivo pero no hay invoiceKey, subirlo normalmente
				try {
					const { uploadReceipt } = await import("../services/receiptStorage");
					const { data: insertedData } = await supabase
						.from("finance_entries")
						.select("id")
						.eq("clinic_id", clinicId)
						.eq("date", purchaseDate)
						.eq("type", "expense")
						.eq("category", "Material")
						.eq("description", `Reposición: ${restockItem.name} (${qtyBought} ${restockItem.unit}) Lote: ${lotNumber}`)
						.order("created_at", { ascending: false })
						.limit(1)
						.single();
					
					if (insertedData?.id) {
						const path = await uploadReceipt(userId, insertedData.id, restockData.receiptFile);
						await supabase
							.from("finance_entries")
							.update({ file_url: path })
							.eq("id", insertedData.id);
					}
				} catch (fileErr) {
					console.error("Error subiendo archivo:", fileErr);
				}
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
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
			const { error } = await supabase.from("inventory").delete().eq("id", itemId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
		},
	});
};
