import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchAppointments = async () => {
	const { data, error } = await supabase
		.from("appointments")
		.select("*")
		.eq("activo", true)
		.order("start_at", { ascending: true });

	if (error) throw error;
	return data || [];
};

export const useAppointments = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();

	const {
		data: appointments = [],
		isLoading,
		refetch: refreshAppointments,
	} = useQuery({
		queryKey: ["appointments", clinicId],
		queryFn: fetchAppointments,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`appointments-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "appointments",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { appointments, loading: isLoading, refreshAppointments };
};
