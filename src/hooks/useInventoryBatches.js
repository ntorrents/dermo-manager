import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchBatches = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("inventory_batches")
		.select("*")
		.eq("user_id", userId)
		.gt("quantity_remaining", 0)
		.order("expiry_date", { ascending: true });

	if (error) throw error;
	return data || [];
};

export const useInventoryBatches = (userId) => {
	const queryClient = useQueryClient();

	const { data: batches = [], refetch } = useQuery({
		queryKey: ["inventoryBatches", userId],
		queryFn: () => fetchBatches(userId),
		enabled: !!userId,
	});

	return { batches, refreshBatches: refetch };
};

/** Lotes de un material concreto (para edición), incluye los ya consumidos */
export const fetchBatchesForMaterial = async (inventoryId) => {
	if (!inventoryId) return [];
	const { data, error } = await supabase
		.from("inventory_batches")
		.select("*")
		.eq("inventory_id", inventoryId)
		.order("expiry_date", { ascending: true });
	if (error) throw error;
	return data || [];
};
