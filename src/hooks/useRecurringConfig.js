import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchRecurringConfig = async () => {
	const { data, error } = await supabase.from("recurring_config").select("*");
	if (error) throw error;
	return data || [];
};

export const useRecurringConfig = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: recurringConfig = [],
		isLoading,
		refetch: refreshRecurringConfig,
	} = useQuery({
		queryKey: ["recurringConfig", clinicId],
		queryFn: fetchRecurringConfig,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`recurring-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "recurring_config",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["recurringConfig", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { recurringConfig, loading: isLoading, refreshRecurringConfig };
};
