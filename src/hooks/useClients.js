import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";
import { QUERY_STALE } from "../providers/queryStale";

/** RLS restringe por clínica; no filtrar por user_id o cada usuario vería solo sus filas. */
const fetchClients = async ({ archived = false } = {}) => {
	let q = supabase
		.from("clients")
		.select("*")
		.eq("activo", !archived)
		.order("name", { ascending: true });
	// Pacientes reales: excluir leads (compat. si columna aún no existe en algún entorno)
	q = q.or("is_lead.is.null,is_lead.eq.false");
	const { data, error } = await q;
	if (error) throw error;
	return data || [];
};

const fetchLeads = async () => {
	const { data, error } = await supabase
		.from("clients")
		.select("*")
		.eq("activo", true)
		.eq("is_lead", true)
		.order("lead_entered_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });
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
		queryFn: () => fetchClients({ archived: false }),
		enabled: !!userId && !!clinicId,
		staleTime: QUERY_STALE.operational,
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
					queryClient.invalidateQueries({ queryKey: ["clientsArchived", clinicId] });
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

/** Pacientes archivados (soft-delete: activo=false). */
export const useArchivedClients = (user, { enabled = true } = {}) => {
	const userId = user?.id;
	const { clinicId } = useTenant();
	return useQuery({
		queryKey: ["clientsArchived", clinicId],
		queryFn: () => fetchClients({ archived: true }),
		enabled: !!userId && !!clinicId && enabled,
		staleTime: QUERY_STALE.operational,
	});
};

/** Leads / potenciales (is_lead = true). */
export const useLeads = (user, { enabled = true } = {}) => {
	const queryClient = useQueryClient();
	const userId = user?.id;
	const { clinicId } = useTenant();

	const query = useQuery({
		queryKey: ["clientsLeads", clinicId],
		queryFn: fetchLeads,
		enabled: !!userId && !!clinicId && enabled,
		staleTime: QUERY_STALE.operational,
	});

	useEffect(() => {
		if (!clinicId || !enabled) return;
		const channel = supabase
			.channel(`clients-leads-realtime-${clinicId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "clients", filter: `clinic_id=eq.${clinicId}` },
				() => {
					queryClient.invalidateQueries({ queryKey: ["clientsLeads", clinicId] });
					queryClient.invalidateQueries({ queryKey: ["clients", clinicId] });
				},
			)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [clinicId, enabled, queryClient]);

	return query;
};
