import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

/** RLS restringe por clínica; no filtrar por user_id o cada usuario vería solo sus filas. */
const fetchClients = async () => {
	const { data, error } = await supabase
		.from("clients")
		.select("*")
		.eq("activo", true)
		.order("name", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useClients = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: clients = [],
		isLoading,
		error,
		isError,
		refetch: refreshClients,
	} = useQuery({
		queryKey: ["clients", clinicId],
		queryFn: fetchClients,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`clients-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "clients", filter: `clinic_id=eq.${clinicId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["clients", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return {
		clients,
		loading: isLoading,
		error,
		isError,
		refreshClients,
	};
};
