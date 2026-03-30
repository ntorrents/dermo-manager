import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchClients = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("clients")
		.select("*")
		.eq("user_id", userId)
		.eq("activo", true)
		.order("name", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useClients = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: clients = [],
		isLoading,
		refetch: refreshClients,
	} = useQuery({
		queryKey: ["clients", userId],
		queryFn: () => fetchClients(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("clients-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "clients", filter: `user_id=eq.${userId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["clients", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { clients, loading: isLoading, refreshClients };
};
