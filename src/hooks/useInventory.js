import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchInventory = async () => {
	const { data, error } = await supabase.from("inventory").select("*").order("name");
	if (error) throw error;
	return data || [];
};

export const useInventory = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: inventory = [],
		isLoading,
		refetch: refreshInventory,
	} = useQuery({
		queryKey: ["inventory", clinicId],
		queryFn: fetchInventory,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`inventory-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "inventory", filter: `clinic_id=eq.${clinicId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { inventory, loading: isLoading, refreshInventory };
};
