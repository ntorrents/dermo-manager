import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { calculateTaxFromTotal } from "../utils/format";

export const useCreateMaterial = (userId) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ formData, taxCalc }) => {
			const stockNum = Number(formData.stock);
			const totalCostNum = Number(formData.totalCost);
			if (stockNum <= 0) throw new Error("El stock debe ser mayor a 0");
			const calculatedUnitCost = totalCostNum / stockNum;
			const payload = {
				name: formData.name,
				stock: stockNum,
				unit: formData.unit,
				unit_cost: calculatedUnitCost,
				min_stock: Number(formData.min_stock),
				user_id: userId,
			};
			const { error: invError } = await supabase.from("inventory").insert([payload]);
			if (invError) throw invError;
			const taxRate = formData.tax_rate != null ? Number(formData.tax_rate) : 21;
			const { baseAmount, taxAmount } = calculateTaxFromTotal(totalCostNum, taxRate);
			const { error: finError } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					type: "expense",
					category: "Material",
					description: `Compra Stock Inicial: ${formData.name}`,
					amount: totalCostNum,
					tax_rate: taxRate,
					base_amount: baseAmount,
					tax_amount: taxAmount,
					date: new Date().toISOString().split("T")[0],
				},
			]);
			if (finError) throw finError;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
			queryClient.invalidateQueries({ queryKey: ["finance", userId] });
		},
	});
};

export const useUpdateMaterial = (userId) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ editingItem, formData }) => {
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
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
		},
	});
};

export const useRestockMaterial = (userId) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ restockItem, restockData }) => {
			const qtyBought = Number(restockData.quantity);
			const purchaseCost = Number(restockData.totalCost);
			const currentStock = Number(restockItem.stock);
			const currentUnitCost = Number(restockItem.unit_cost);
			const newStock = currentStock + qtyBought;
			const newUnitCost =
				(currentStock * currentUnitCost + purchaseCost) / newStock;
			const { error } = await supabase
				.from("inventory")
				.update({
					stock: newStock,
					unit_cost: parseFloat(newUnitCost.toFixed(4)),
				})
				.eq("id", restockItem.id);
			if (error) throw error;
			const taxRate = restockData.taxRate != null ? Number(restockData.taxRate) : 21;
			const { baseAmount, taxAmount } = calculateTaxFromTotal(purchaseCost, taxRate);
			const { error: finError } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					date: new Date().toISOString().split("T")[0],
					type: "expense",
					category: "Material",
					description: `Reposición: ${restockItem.name} (${qtyBought} ${restockItem.unit})`,
					amount: purchaseCost,
					tax_rate: taxRate,
					base_amount: baseAmount,
					tax_amount: taxAmount,
				},
			]);
			if (finError) throw finError;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
			queryClient.invalidateQueries({ queryKey: ["finance", userId] });
		},
	});
};

export const useDeleteMaterial = (userId) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (itemId) => {
			const { error } = await supabase.from("inventory").delete().eq("id", itemId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
		},
	});
};
