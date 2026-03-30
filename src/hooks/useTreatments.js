import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchTreatments = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("treatments")
		.select("*, treatment_groups(id, name, sort_order)")
		.eq("user_id", userId)
		.eq("activo", true)
		.order("name");
	if (error) throw error;
	return data || [];
};

export const useTreatments = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: treatments = [],
		isLoading,
		refetch: refreshTreatments,
	} = useQuery({
		queryKey: ["treatments", userId],
		queryFn: () => fetchTreatments(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("treatments-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "treatments", filter: `user_id=eq.${userId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["treatments", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { treatments, loading: isLoading, refreshTreatments };
};
