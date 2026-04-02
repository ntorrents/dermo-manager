import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchBatches = async () => {
	const { data, error } = await supabase
		.from("inventory_batches")
		.select("*")
		.gt("quantity_remaining", 0)
		.order("expiry_date", { ascending: true });

	if (error) throw error;
	return data || [];
};

export const useInventoryBatches = (userId) => {
	const { clinicId } = useTenant();

	const { data: batches = [], refetch } = useQuery({
		queryKey: ["inventoryBatches", clinicId],
		queryFn: fetchBatches,
		enabled: !!userId && !!clinicId,
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
