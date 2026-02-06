import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { calculateSessionCost } from "../utils/calculations";

export const useSessionMutation = (userId, inventory = []) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			treatment,
			clientData,
			finalPrice,
			date,
			extras = [],
		}) => {
			const baseRecipe = treatment.recipe || [];
			const totalConsumption = [...baseRecipe, ...extras];
			const combinedQuantities = totalConsumption.reduce((acc, item) => {
				const qty = Number(item.quantity) || 0;
				if (!item.materialId) return acc;
				acc[item.materialId] = (acc[item.materialId] || 0) + qty;
				return acc;
			}, {});

			// Descontar stock
			for (const [matId, qty] of Object.entries(combinedQuantities)) {
				const item = inventory.find((i) => i.id === matId);
				if (item) {
					const { error } = await supabase
						.from("inventory")
						.update({ stock: Number(item.stock) - qty })
						.eq("id", matId);
					if (error) throw error;
				}
			}

			const cost = calculateSessionCost(combinedQuantities, inventory);
			const displayName = clientData.id
				? `${treatment.name} (${clientData.name} ${clientData.surname || ""})`
				: `${treatment.name} (${clientData.name})`;

			const { error } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					date,
					type: "income",
					category: "Servicio",
					description: displayName,
					amount: Number(finalPrice),
					related_cost: Number(cost),
					client_id: clientData.id || null,
				},
			]);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", userId] });
			queryClient.invalidateQueries({ queryKey: ["finance", userId] });
		},
	});
};
