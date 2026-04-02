import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchFinanceEntries = async () => {
	const { data, error } = await supabase
		.from("finance_entries")
		.select("*")
		.eq("activo", true)
		.order("date", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useFinance = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: entries = [],
		isLoading,
		refetch: refreshFinance,
	} = useQuery({
		queryKey: ["finance", clinicId],
		queryFn: fetchFinanceEntries,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`finance-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "finance_entries",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { entries, loading: isLoading, refreshFinance };
};
