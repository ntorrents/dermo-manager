import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { consumeFromBatchesFIFO } from "../services/inventoryBatches";
import { calculateSessionCost, calculateTaxReverse } from "../utils/calculations";
import { getNextInvoiceNumber } from "../services/invoiceSeries";

const DEFAULT_TAX_RATE = 21;

export const useSessionMutation = (userId, inventory = []) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			treatment,
			clientData,
			finalPrice,
			date,
			extras = [],
			internal_notes = "",
		}) => {
			const baseRecipe = treatment.recipe || [];
			const totalConsumption = [...baseRecipe, ...extras];
			const combinedQuantities = totalConsumption.reduce((acc, item) => {
				const qty = Number(item.quantity) || 0;
				if (!item.materialId) return acc;
				acc[item.materialId] = (acc[item.materialId] || 0) + qty;
				return acc;
			}, {});

			// Descontar stock (FIFO por lotes)
			for (const [matId, qty] of Object.entries(combinedQuantities)) {
				const item = inventory.find((i) => i.id === matId);
				if (item) {
					await consumeFromBatchesFIFO(matId, qty);
				}
			}

			const cost = calculateSessionCost(combinedQuantities, inventory);
			const displayName = clientData.id
				? `${treatment.name} (${clientData.name} ${clientData.surname || ""})`
				: `${treatment.name} (${clientData.name})`;

			const totalAmount = Number(finalPrice);
			const { baseAmount, taxAmount } = calculateTaxReverse(totalAmount, DEFAULT_TAX_RATE);
			const year = date ? parseInt(date.slice(0, 4), 10) : new Date().getFullYear();

			let invoice_number = null;
			try {
				invoice_number = await getNextInvoiceNumber(userId, year);
			} catch {
				// RPC get_next_invoice_number no existe aún (migración no ejecutada). Guardamos sin número.
				// El PDF usará fallback F-YYYYMMDD-id. Ejecuta el SQL en Supabase para activar series.
			}

			const { error } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					date,
					type: "income",
					category: "Servicio",
					description: displayName,
					amount: totalAmount,
					total_amount: totalAmount,
					tax_rate: DEFAULT_TAX_RATE,
					tax_base: baseAmount,
					tax_amount: taxAmount,
					invoice_number,
					related_cost: Number(cost),
					client_id: clientData.id || null,
					internal_notes: internal_notes?.trim() || null,
				},
			]);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", userId] });
			queryClient.invalidateQueries({ queryKey: ["finance", userId] });
		},
	});
};
