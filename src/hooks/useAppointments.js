import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchAppointments = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("appointments")
		.select("*")
		.eq("user_id", userId)
		.eq("activo", true)
		.order("start_at", { ascending: true });

	if (error) throw error;
	return data || [];
};

export const useAppointments = (userId) => {
	const queryClient = useQueryClient();

	const {
		data: appointments = [],
		isLoading,
		refetch: refreshAppointments,
	} = useQuery({
		queryKey: ["appointments", userId],
		queryFn: () => fetchAppointments(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("appointments-realtime")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "appointments",
					filter: `user_id=eq.${userId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["appointments", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { appointments, loading: isLoading, refreshAppointments };
};
