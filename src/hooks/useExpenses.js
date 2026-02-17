import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchExpenses = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("expenses")
		.select("*")
		.eq("user_id", userId)
		.order("date", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useExpenses = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: expenses = [],
		isLoading,
		refetch: refreshExpenses,
	} = useQuery({
		queryKey: ["expenses", userId],
		queryFn: () => fetchExpenses(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("expenses-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${userId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["expenses", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { expenses, loading: isLoading, refreshExpenses };
};
