import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchSeguimientos = async (clientId) => {
	if (!clientId) return [];
	const { data, error } = await supabase
		.from("seguimientos_cliente")
		.select("id, tratamientos_interes, fecha_proximo_contacto, notas, created_at, updated_at")
		.eq("client_id", clientId)
		.order("fecha_proximo_contacto", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false });
	if (error) throw error;
	return data || [];
};

export const useClientSeguimientos = (clientId, userId) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();

	const {
		data: seguimientos = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["clientSeguimientos", clientId],
		queryFn: () => fetchSeguimientos(clientId),
		enabled: !!clientId,
	});

	const addMutation = useMutation({
		mutationFn: async (payload) => {
			if (!clinicId) throw new Error("No hay clínica activa");
			const { data, error } = await supabase
				.from("seguimientos_cliente")
				.insert([{ ...payload, user_id: userId, client_id: clientId, clinic_id: clinicId }])
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["clientSeguimientos", clientId] });
			if (clinicId) queryClient.invalidateQueries({ queryKey: ["seguimientosForCalendar", clinicId] });
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, ...updates }) => {
			const { data, error } = await supabase
				.from("seguimientos_cliente")
				.update({ ...updates, updated_at: new Date().toISOString() })
				.eq("id", id)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["clientSeguimientos", clientId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id) => {
			const { error } = await supabase.from("seguimientos_cliente").delete().eq("id", id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["clientSeguimientos", clientId] });
			if (clinicId) queryClient.invalidateQueries({ queryKey: ["seguimientosForCalendar", clinicId] });
		},
	});

	return {
		seguimientos,
		loading: isLoading,
		refetch,
		addSeguimiento: addMutation.mutateAsync,
		updateSeguimiento: updateMutation.mutateAsync,
		deleteSeguimiento: deleteMutation.mutateAsync,
		adding: addMutation.isPending,
		updating: updateMutation.isPending,
		deleting: deleteMutation.isPending,
	};
};
