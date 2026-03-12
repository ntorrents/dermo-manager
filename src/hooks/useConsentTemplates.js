import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchConsentTemplates = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("plantillas_consentimiento")
		.select("*, treatments(id, name)")
		.eq("user_id", userId)
		.order("nombre");
	if (error) throw error;
	return data || [];
};

export const useConsentTemplates = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;

	const {
		data: consentTemplates = [],
		isLoading,
		refetch: refreshConsentTemplates,
	} = useQuery({
		queryKey: ["consentTemplates", userId],
		queryFn: () => fetchConsentTemplates(userId),
		enabled: !!userId,
	});

	useEffect(() => {
		if (!userId) return;
		const channel = supabase
			.channel("consent-templates-realtime")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "plantillas_consentimiento",
					filter: `user_id=eq.${userId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["consentTemplates", userId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [userId, queryClient]);

	return { consentTemplates, loading: isLoading, refreshConsentTemplates };
};
