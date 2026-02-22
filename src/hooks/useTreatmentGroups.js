import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchTreatmentGroups = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("treatment_groups")
		.select("*")
		.eq("user_id", userId)
		.order("sort_order", { ascending: true })
		.order("name", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useTreatmentGroups = (user) => {
	const userId = user?.id;
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["treatmentGroups", userId],
		queryFn: () => fetchTreatmentGroups(userId),
		enabled: !!userId,
	});

	const createMutation = useMutation({
		mutationFn: async ({ name, sort_order = 0 }) => {
			const { data, error } = await supabase
				.from("treatment_groups")
				.insert([{ user_id: userId, name: name.trim(), sort_order }])
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["treatmentGroups", userId] });
			queryClient.invalidateQueries({ queryKey: ["treatments", userId] });
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, name, sort_order }) => {
			const payload = {};
			if (name !== undefined) payload.name = name.trim();
			if (sort_order !== undefined) payload.sort_order = sort_order;
			const { data, error } = await supabase
				.from("treatment_groups")
				.update(payload)
				.eq("id", id)
				.eq("user_id", userId)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["treatmentGroups", userId] });
			queryClient.invalidateQueries({ queryKey: ["treatments", userId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id) => {
			// Poner group_id a null en los tratamientos del grupo
			await supabase
				.from("treatments")
				.update({ group_id: null })
				.eq("group_id", id);
			const { error } = await supabase
				.from("treatment_groups")
				.delete()
				.eq("id", id)
				.eq("user_id", userId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["treatmentGroups", userId] });
			queryClient.invalidateQueries({ queryKey: ["treatments", userId] });
		},
	});

	return {
		groups: query.data ?? [],
		loading: query.isLoading,
		refetch: query.refetch,
		create: createMutation.mutateAsync,
		update: updateMutation.mutateAsync,
		delete: deleteMutation.mutateAsync,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
};
