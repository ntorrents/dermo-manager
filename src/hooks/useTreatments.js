import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchTreatments = async () => {
	const { data, error } = await supabase
		.from("treatments")
		.select("*, treatment_groups(id, name, sort_order)")
		.eq("activo", true)
		.order("name");
	if (error) throw error;
	return data || [];
};

export const useTreatments = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: treatments = [],
		isLoading,
		refetch: refreshTreatments,
	} = useQuery({
		queryKey: ["treatments", clinicId],
		queryFn: fetchTreatments,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`treatments-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "treatments", filter: `clinic_id=eq.${clinicId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["treatments", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { treatments, loading: isLoading, refreshTreatments };
};
