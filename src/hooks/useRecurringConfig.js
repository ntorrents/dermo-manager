import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchRecurringConfig = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("recurring_config")
		.select("*")
		.eq("user_id", userId);
	if (error) throw error;
	return data || [];
};

export const useRecurringConfig = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: recurringConfig = [],
		isLoading,
		refetch: refreshRecurringConfig,
	} = useQuery({
		queryKey: ["recurringConfig", userId],
		queryFn: () => fetchRecurringConfig(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("recurring-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "recurring_config", filter: `user_id=eq.${userId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["recurringConfig", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { recurringConfig, loading: isLoading, refreshRecurringConfig };
};
