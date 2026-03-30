import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { calculateTaxReverse } from "../utils/calculations";

const BONUS_TAX_RATE = 21;

const fetchBonusTemplates = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("bonus_templates")
		.select("*, treatments(id, name)")
		.eq("user_id", userId)
		.order("name");
	if (error) throw error;
	return data || [];
};

const fetchClientBonuses = async (userId, clientId) => {
	if (!userId || !clientId) return [];
	const { data, error } = await supabase
		.from("client_bonuses")
		.select("*, bonus_templates(name), treatments(id, name)")
		.eq("user_id", userId)
		.eq("client_id", clientId)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return data || [];
};

/** Catálogo de plantillas de bonos: lectura + CRUD */
export const useBonusTemplates = (user) => {
	const userId = user?.id;
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["bonusTemplates", userId],
		queryFn: () => fetchBonusTemplates(userId),
		enabled: !!userId,
	});

	const createMutation = useMutation({
		mutationFn: async (payload) => {
			const { data, error } = await supabase
				.from("bonus_templates")
				.insert([{ ...payload, user_id: userId }])
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", userId] });
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, payload }) => {
			const { data, error } = await supabase
				.from("bonus_templates")
				.update(payload)
				.eq("id", id)
				.eq("user_id", userId)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", userId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id) => {
			const { error } = await supabase
				.from("bonus_templates")
				.delete()
				.eq("id", id)
				.eq("user_id", userId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", userId] });
		},
	});

	return {
		templates: query.data ?? [],
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

/** Bonos de un cliente (solo lectura) */
export const useClientBonos = (userId, clientId) => {
	return useQuery({
		queryKey: ["clientBonuses", userId, clientId],
		queryFn: () => fetchClientBonuses(userId, clientId),
		enabled: !!userId && !!clientId,
	});
};

/** Bono activo para cliente + tratamiento (para SessionModal) */
export const useActiveBonoForSession = (userId, clientId, treatmentId) => {
	return useQuery({
		queryKey: ["activeBono", userId, clientId, treatmentId],
		queryFn: async () => {
			if (!userId || !clientId || !treatmentId) return null;
			const { data, error } = await supabase
				.from("client_bonuses")
				.select("id, total_sessions, used_sessions, bonus_templates(name)")
				.eq("user_id", userId)
				.eq("client_id", clientId)
				.eq("treatment_id", treatmentId)
				.eq("status", "active")
				.limit(1)
				.maybeSingle();
			if (error) throw error;
			return data;
		},
		enabled: !!userId && !!clientId && !!treatmentId,
	});
};

/** Vender bono: inserta client_bonuses + ingreso en finance_entries */
export const useSellBono = (user) => {
	const userId = user?.id;
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ clientId, templateId, templateName, treatmentId, totalSessions, pricePaid, paymentDate }) => {
			const amount = Number(pricePaid) || 0;
			const { baseAmount, taxAmount } = calculateTaxReverse(amount, BONUS_TAX_RATE);

			const { data: bonus, error: bonusError } = await supabase
				.from("client_bonuses")
				.insert([
					{
						user_id: userId,
						client_id: clientId,
						template_id: templateId,
						treatment_id: treatmentId,
						total_sessions: totalSessions,
						used_sessions: 0,
						price_paid: amount,
						status: "active",
					},
				])
				.select()
				.single();
			if (bonusError) throw bonusError;

			const { error: finError } = await supabase.from("finance_entries").insert([
				{
					user_id: userId,
					date: paymentDate,
					type: "income",
					category: "Bono",
					description: `Venta de bono: ${templateName || "Bono"}`,
					amount,
					total_amount: amount,
					tax_rate: BONUS_TAX_RATE,
					tax_base: baseAmount,
					tax_amount: taxAmount,
					client_id: clientId,
					activo: true,
				},
			]);
			if (finError) throw finError;

			return bonus;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["finance", userId] });
			queryClient.invalidateQueries({ queryKey: ["clientBonuses", userId] });
			queryClient.invalidateQueries({ queryKey: ["activeBono", userId] });
		},
	});
};

/** Consumir una sesión del bono: +1 used_sessions, status → exhausted si llega al total */
export const useConsumeBono = (user) => {
	const userId = user?.id;
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (clientBonoId) => {
			const { data: row, error: fetchErr } = await supabase
				.from("client_bonuses")
				.select("used_sessions, total_sessions")
				.eq("id", clientBonoId)
				.eq("user_id", userId)
				.single();
			if (fetchErr || !row) throw new Error("Bono no encontrado");

			const newUsed = (row.used_sessions ?? 0) + 1;
			const status = newUsed >= row.total_sessions ? "exhausted" : "active";

			const { error: updateErr } = await supabase
				.from("client_bonuses")
				.update({ used_sessions: newUsed, status })
				.eq("id", clientBonoId)
				.eq("user_id", userId);
			if (updateErr) throw updateErr;

			return { used_sessions: newUsed, status };
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["clientBonuses", userId] });
			queryClient.invalidateQueries({ queryKey: ["activeBono", userId] });
		},
	});
};
