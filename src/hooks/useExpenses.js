import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchExpenses = async () => {
	const { data, error } = await supabase
		.from("expenses")
		.select("*")
		.order("date", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useExpenses = (user) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const {
		data: expenses = [],
		isLoading,
		refetch: refreshExpenses,
	} = useQuery({
		queryKey: ["expenses", clinicId],
		queryFn: fetchExpenses,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`expenses-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "expenses", filter: `clinic_id=eq.${clinicId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["expenses", clinicId] });
				}
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	return { expenses, loading: isLoading, refreshExpenses };
};
