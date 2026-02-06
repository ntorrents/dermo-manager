import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchPhotos = async (clientId) => {
	if (!clientId) return [];
	const { data, error } = await supabase
		.from("session_photos")
		.select("*")
		.eq("client_id", clientId)
		.order("created_at", { ascending: false });

	if (error) throw error;
	return data || [];
};

export const useSessionPhotos = (clientId, userId) => {
	const queryClient = useQueryClient();

	const {
		data: photos = [],
		isLoading,
		refetch: refreshPhotos,
	} = useQuery({
		queryKey: ["sessionPhotos", clientId],
		queryFn: () => fetchPhotos(clientId),
		enabled: !!clientId,
	});

	useEffect(() => {
		if (!userId || !clientId) return;
		const channel = supabase
			.channel("session-photos-realtime")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "session_photos",
					filter: `client_id=eq.${clientId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["sessionPhotos", clientId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clientId, userId, queryClient]);

	return { photos, loading: isLoading, refreshPhotos };
};
