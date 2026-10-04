import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";
import { QUERY_STALE } from "../providers/queryStale";
import { resolvePurchaseAmounts } from "../utils/purchaseTax";
import {
	GENERIC_PURCHASE_PROVIDER,
	isDeductiblePurchase,
} from "../utils/inventoryPurchase";
import { normalizeInvoiceNumber, validateSpanishTaxId } from "../utils/validations";
import { uploadReceipt } from "../services/receiptStorage";

const fetchProducts = async () => {
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("activo", true)
		.order("name");
	if (error) throw error;
	return data || [];
};

const resolvePurchaseMeta = (purchase) => {
	const isDeductible = isDeductiblePurchase(purchase);
	let providerName = purchase.provider_name?.trim() || "";
	let supplierNif = purchase.supplier_nif?.trim() || "";
	let invoiceNumber = purchase.invoice_number?.trim() || "";

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

const insertPurchaseExpense = async ({
	userId,
	clinicId,
	productId,
	productName,
	qty,
	unit,
	totalCost,
	purchaseDate,
	isDeductible,
	providerName,
	supplierNif,
	invoiceNumber,
	purchaseTaxRate,
	priceMode = "included",
	receiptFile,
	isRestock,
}) => {
	if (!(Number(totalCost) > 0)) return null;

	const { baseAmount, taxAmount, totalAmount, taxRate } = resolvePurchaseAmounts({
		amountInput: totalCost,
		taxRate: purchaseTaxRate != null ? Number(purchaseTaxRate) : 21,
		priceMode,
		isDeductible,
	});

	const { data: entry, error } = await supabase
		.from("finance_entries")
		.insert([
			{
				user_id: userId,
				clinic_id: clinicId,
				date: purchaseDate,
				type: "expense",
				category: "Producto",
				description: `${isRestock ? "Reposición producto" : "Compra producto"}: ${productName} (${qty} ${unit})`,
				amount: totalAmount,
				total_amount: totalAmount,
				tax_rate: taxRate,
				tax_base: baseAmount,
				tax_amount: taxAmount,
				is_deductible: isDeductible,
				provider_name: providerName,
				supplier_nif: supplierNif || null,
				invoice_number: invoiceNumber || null,
				product_id: productId,
				quantity: Number(qty),
				activo: true,
			},
		])
		.select("id")
		.single();
	if (error) throw error;

	if (receiptFile && entry?.id) {
		try {
			const invoiceKey =
				isDeductible && supplierNif && invoiceNumber
					? `${supplierNif}_${invoiceNumber}`
					: null;
			const path = await uploadReceipt(
				userId,
				invoiceKey ? null : entry.id,
				receiptFile,
				invoiceKey,
			);
			if (invoiceKey) {
				await supabase
					.from("finance_entries")
					.update({ file_url: path })
					.eq("clinic_id", clinicId)
					.eq("supplier_nif", supplierNif)
					.eq("invoice_number", invoiceNumber)
					.is("file_url", null);
			} else {
				await supabase
					.from("finance_entries")
					.update({ file_url: path })
					.eq("id", entry.id);
			}
		} catch (fileErr) {
			console.error("Error subiendo factura de producto:", fileErr);
		}
	}

	return entry?.id || null;
};

export const useProducts = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: products = [],
		isLoading,
		refetch: refreshProducts,
	} = useQuery({
		queryKey: ["products", clinicId],
		queryFn: fetchProducts,
		enabled: !!userId && !!clinicId,
		staleTime: QUERY_STALE.catalog,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`products-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "products",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => queryClient.invalidateQueries({ queryKey: ["products", clinicId] }),
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["products", clinicId] });
		queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
	};

	const saveMutation = useMutation({
		mutationFn: async (payload) => {
			if (payload.id) {
				const { id, ...rest } = payload;
				const { data, error } = await supabase
					.from("products")
					.update({ ...rest, updated_at: new Date().toISOString() })
					.eq("id", id)
					.select()
					.single();
				if (error) throw error;
				return data;
			}
			const { data, error } = await supabase
				.from("products")
				.insert([{ ...payload, clinic_id: clinicId, user_id: userId }])
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["products", clinicId] });
		},
	});

	const softDeleteMutation = useMutation({
		mutationFn: async (id) => {
			const { error } = await supabase
				.from("products")
				.update({ activo: false, updated_at: new Date().toISOString() })
				.eq("id", id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["products", clinicId] });
		},
	});

	const createWithPurchaseMutation = useMutation({
		mutationFn: async ({ product, purchase, receiptFile = null }) => {
			const stockNum = Number(product.stock_qty);
			const totalCost = Number(purchase.totalCost);
			if (!Number.isFinite(stockNum) || stockNum < 0) {
				throw new Error("Stock inválido");
			}
			if (!Number.isFinite(totalCost) || totalCost < 0) {
				throw new Error("Coste de compra inválido (puede ser 0 si es gratis)");
			}
			const purchaseDate = purchase.purchaseDate?.trim();
			if (stockNum > 0 && !purchaseDate) {
				throw new Error("Indica la fecha de entrada / compra");
			}

			const meta =
				stockNum > 0 && totalCost > 0
					? resolvePurchaseMeta(purchase)
					: {
							isDeductible: false,
							providerName: null,
							supplierNif: null,
							invoiceNumber: null,
						};
			const { totalAmount } = resolvePurchaseAmounts({
				amountInput: totalCost,
				taxRate: purchase.purchase_tax_rate,
				priceMode: purchase.priceMode || "included",
				isDeductible: meta.isDeductible,
			});
			const unitCost = stockNum > 0 ? totalAmount / stockNum : 0;

			const { data: saved, error } = await supabase
				.from("products")
				.insert([
					{
						clinic_id: clinicId,
						user_id: userId,
						name: product.name,
						description: product.description || null,
						sku: product.sku || null,
						price: Number(product.price) || 0,
						tax_rate: Number(product.tax_rate) || 0,
						stock_qty: stockNum,
						unit: product.unit || "ud",
						unit_cost: Number(unitCost.toFixed(4)),
						image_url: product.image_url || null,
						image_path: product.image_path || null,
						activo: true,
					},
				])
				.select()
				.single();
			if (error) throw error;

			if (stockNum > 0 && totalCost > 0 && purchaseDate) {
				await insertPurchaseExpense({
					userId,
					clinicId,
					productId: saved.id,
					productName: saved.name,
					qty: stockNum,
					unit: saved.unit,
					totalCost,
					purchaseDate,
					isDeductible: meta.isDeductible,
					providerName: meta.providerName,
					supplierNif: meta.supplierNif,
					invoiceNumber: meta.invoiceNumber,
					purchaseTaxRate: purchase.purchase_tax_rate,
					priceMode: purchase.priceMode || "included",
					receiptFile: meta.isDeductible ? receiptFile : null,
					isRestock: false,
				});
			}

			return saved;
		},
		onSuccess: invalidate,
	});

	const restockMutation = useMutation({
		mutationFn: async ({ product, purchase, receiptFile = null }) => {
			const qty = Number(purchase.quantity);
			const totalCost = Number(purchase.totalCost);
			const purchaseDate = purchase.purchaseDate?.trim();
			if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantidad inválida");
			if (!Number.isFinite(totalCost) || totalCost < 0) {
				throw new Error("Coste inválido (0 si es reposición gratis)");
			}
			if (!purchaseDate) throw new Error("Fecha de compra obligatoria");

			const meta =
				totalCost > 0
					? resolvePurchaseMeta(purchase)
					: {
							isDeductible: false,
							providerName: GENERIC_PURCHASE_PROVIDER,
							supplierNif: null,
							invoiceNumber: null,
						};

			const { totalAmount } = resolvePurchaseAmounts({
				amountInput: totalCost,
				taxRate: purchase.purchase_tax_rate,
				priceMode: purchase.priceMode || "included",
				isDeductible: meta.isDeductible,
			});
			const currentStock = Number(product.stock_qty) || 0;
			const currentUnitCost = Number(product.unit_cost) || 0;
			const newStock = currentStock + qty;
			const newUnitCost =
				newStock > 0
					? (currentStock * currentUnitCost + totalAmount) / newStock
					: 0;

			const { error } = await supabase
				.from("products")
				.update({
					stock_qty: newStock,
					unit_cost: Number(newUnitCost.toFixed(4)),
					updated_at: new Date().toISOString(),
				})
				.eq("id", product.id);
			if (error) throw error;

			if (totalCost > 0) {
				await insertPurchaseExpense({
					userId,
					clinicId,
					productId: product.id,
					productName: product.name,
					qty,
					unit: product.unit || "ud",
					totalCost,
					purchaseDate,
					isDeductible: meta.isDeductible,
					providerName: meta.providerName,
					supplierNif: meta.supplierNif,
					invoiceNumber: meta.invoiceNumber,
					purchaseTaxRate: purchase.purchase_tax_rate,
					priceMode: purchase.priceMode || "included",
					receiptFile: meta.isDeductible ? receiptFile : null,
					isRestock: true,
				});
			}

			return { newStock, newUnitCost };
		},
		onSuccess: invalidate,
	});

	const sellMutation = useMutation({
		mutationFn: async ({
			productId,
			quantity,
			unitPrice,
			date,
			clientId = null,
			buyerName = null,
			issueInvoice = true,
			internalNotes = null,
			planAmigo = false,
			documentKind = null,
		}) => {
			const { data, error } = await supabase.rpc("sell_catalog_product", {
				p_product_id: productId,
				p_quantity: Number(quantity),
				p_unit_price: Number(unitPrice),
				p_date: date,
				p_client_id: clientId || null,
				p_buyer_name: buyerName || null,
				p_issue_invoice: planAmigo ? false : !!issueInvoice,
				p_internal_notes: internalNotes || null,
				p_plan_amigo: !!planAmigo,
				p_document_kind: planAmigo ? null : documentKind || null,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: invalidate,
	});

	/** TPV: varias líneas, un correlativo Ticket/Factura, stock + caja. */
	const sellCartMutation = useMutation({
		mutationFn: async ({
			lines,
			date,
			clientId = null,
			buyerName = null,
			documentKind = "ticket",
			internalNotes = null,
		}) => {
			if (!lines?.length) throw new Error("El carrito está vacío");
			const { data, error } = await supabase.rpc("sell_catalog_cart", {
				p_lines: lines,
				p_date: date,
				p_client_id: clientId || null,
				p_buyer_name: buyerName || null,
				p_document_kind: documentKind === "factura" ? "factura" : "ticket",
				p_internal_notes: internalNotes || null,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			invalidate();
			queryClient.invalidateQueries({ queryKey: ["product_sales", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance_entries", clinicId] });
		},
	});

	const invoiceBatchMutation = useMutation({
		mutationFn: async ({ header, lines }) => {
			if (!clinicId) throw new Error("Clínica no disponible");
			const purchaseDate = header.purchaseDate?.trim();
			if (!purchaseDate) throw new Error("La fecha de compra es obligatoria");
			if (!lines?.length) throw new Error("Añade al menos una línea");

			const meta = resolvePurchaseMeta(header);
			const taxRate = meta.isDeductible
				? header.tax_rate != null
					? Number(header.tax_rate)
					: 21
				: 0;
			const priceMode = header.priceMode || "included";

			for (const line of lines) {
				const name = String(line.name || "").trim();
				const qty = Number(line.quantity);
				const lineCost = Number(line.totalCost);
				if (!name) throw new Error("Cada línea necesita nombre");
				if (!(qty > 0)) throw new Error(`Cantidad inválida en «${name}»`);
				if (!(lineCost >= 0)) throw new Error(`Coste inválido en «${name}»`);

				const { totalAmount } = resolvePurchaseAmounts({
					amountInput: lineCost,
					taxRate,
					priceMode,
					isDeductible: meta.isDeductible,
				});

				const productId = line.productId || line.itemId || null;
				const unit = line.unit || "ud";

				if (productId) {
					const { data: existing, error: exErr } = await supabase
						.from("products")
						.select("id, stock_qty, unit_cost, unit, name, price, tax_rate")
						.eq("id", productId)
						.single();
					if (exErr) throw exErr;
					const currentStock = Number(existing.stock_qty) || 0;
					const currentUnitCost = Number(existing.unit_cost) || 0;
					const newStock = currentStock + qty;
					const newUnitCost =
						newStock > 0
							? (currentStock * currentUnitCost + totalAmount) / newStock
							: 0;
					const { error: updErr } = await supabase
						.from("products")
						.update({
							stock_qty: newStock,
							unit_cost: Number(newUnitCost.toFixed(4)),
							updated_at: new Date().toISOString(),
						})
						.eq("id", productId);
					if (updErr) throw updErr;

					if (totalAmount > 0) {
						await insertPurchaseExpense({
							userId,
							clinicId,
							productId,
							productName: existing.name,
							qty,
							unit: existing.unit || unit,
							totalCost: lineCost,
							purchaseDate,
							isDeductible: meta.isDeductible,
							providerName: meta.providerName,
							supplierNif: meta.supplierNif,
							invoiceNumber: meta.invoiceNumber,
							purchaseTaxRate: taxRate,
							priceMode,
							receiptFile: null,
							isRestock: true,
						});
					}
				} else {
					const pvp = Number(line.price);
					if (!(pvp >= 0) || Number.isNaN(pvp)) {
						throw new Error(`Indica el PVP de venta para «${name}»`);
					}
					const unitCost = qty > 0 ? totalAmount / qty : 0;
					const { data: saved, error: insErr } = await supabase
						.from("products")
						.insert([
							{
								clinic_id: clinicId,
								user_id: userId,
								name,
								price: pvp,
								tax_rate: 21,
								stock_qty: qty,
								unit,
								unit_cost: Number(unitCost.toFixed(4)),
								activo: true,
							},
						])
						.select()
						.single();
					if (insErr) throw insErr;

					if (totalAmount > 0) {
						await insertPurchaseExpense({
							userId,
							clinicId,
							productId: saved.id,
							productName: saved.name,
							qty,
							unit: saved.unit,
							totalCost: lineCost,
							purchaseDate,
							isDeductible: meta.isDeductible,
							providerName: meta.providerName,
							supplierNif: meta.supplierNif,
							invoiceNumber: meta.invoiceNumber,
							purchaseTaxRate: taxRate,
							priceMode,
							receiptFile: null,
							isRestock: false,
						});
					}
				}
			}
		},
		onSuccess: invalidate,
	});

	return {
		products,
		loading: isLoading,
		refreshProducts,
		saveProduct: saveMutation.mutateAsync,
		saving: saveMutation.isPending || createWithPurchaseMutation.isPending,
		createProductWithPurchase: createWithPurchaseMutation.mutateAsync,
		restockProduct: restockMutation.mutateAsync,
		restocking: restockMutation.isPending,
		deleteProduct: softDeleteMutation.mutateAsync,
		deleting: softDeleteMutation.isPending,
		sellProduct: sellMutation.mutateAsync,
		selling: sellMutation.isPending,
		sellCart: sellCartMutation.mutateAsync,
		sellingCart: sellCartMutation.isPending,
		invoiceBatchPurchase: invoiceBatchMutation.mutateAsync,
		invoiceBatchPending: invoiceBatchMutation.isPending,
	};
};
