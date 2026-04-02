import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchConsentTemplates = async () => {
	const { data, error } = await supabase
		.from("plantillas_consentimiento")
		.select("*, treatments(id, name)")
		.order("nombre");
	if (error) throw error;
	return data || [];
};

export const useConsentTemplates = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: consentTemplates = [],
		isLoading,
		refetch: refreshConsentTemplates,
	} = useQuery({
		queryKey: ["consentTemplates", clinicId],
		queryFn: fetchConsentTemplates,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`consent-templates-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "plantillas_consentimiento",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["consentTemplates", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { consentTemplates, loading: isLoading, refreshConsentTemplates };
};
