import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchTaxDeclarations = async () => {
	const { data, error } = await supabase
		.from("tax_declarations")
		.select("*")
		.order("year", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useTaxDeclarations = (userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();

	const {
		data: declarations = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["tax_declarations", clinicId],
		queryFn: fetchTaxDeclarations,
		enabled: !!userId && !!clinicId,
	});

	useEffect(() => {
		if (!clinicId) return;
		const channel = supabase
			.channel(`tax-decl-${clinicId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "tax_declarations",
					filter: `clinic_id=eq.${clinicId}`,
				},
				() => queryClient.invalidateQueries({ queryKey: ["tax_declarations", clinicId] }),
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, queryClient]);

	const upsertMutation = useMutation({
		mutationFn: async (payload) => {
			const { data, error } = await supabase
				.from("tax_declarations")
				.upsert(payload, { onConflict: "clinic_id,model,year,period" })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tax_declarations", clinicId] });
		},
	});

	return {
		declarations,
		loading: isLoading,
		refreshDeclarations: refetch,
		upsertDeclaration: upsertMutation.mutateAsync,
		upserting: upsertMutation.isPending,
	};
};
