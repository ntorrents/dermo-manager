import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchFinanceEntries = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("finance_entries")
		.select("*")
		.eq("user_id", userId)
		.eq("activo", true)
		.order("date", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useFinance = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: entries = [],
		isLoading,
		refetch: refreshFinance,
	} = useQuery({
		queryKey: ["finance", userId],
		queryFn: () => fetchFinanceEntries(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("finance-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "finance_entries", filter: `user_id=eq.${userId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["finance", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { entries, loading: isLoading, refreshFinance };
};
