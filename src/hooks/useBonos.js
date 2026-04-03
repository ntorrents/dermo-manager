import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { calculateTaxReverse } from "../utils/calculations";
import { useTenant } from "../context/TenantContext";

const BONUS_TAX_RATE = 21;

const fetchBonusTemplates = async () => {
	const { data, error } = await supabase
		.from("bonus_templates")
		.select("*, treatments(id, name)")
		.order("name");
	if (error) throw error;
	return data || [];
};

const fetchClientBonuses = async (clientId) => {
	if (!clientId) return [];
	const { data, error } = await supabase
		.from("client_bonuses")
		.select("*, bonus_templates(name), treatments(id, name)")
		.eq("client_id", clientId)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return data || [];
};

/** Catálogo de plantillas de bonos: lectura + CRUD */
export const useBonusTemplates = (user) => {
	const userId = user?.id;
	const { clinicId } = useTenant();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["bonusTemplates", clinicId],
		queryFn: fetchBonusTemplates,
		enabled: !!userId && !!clinicId,
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
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", clinicId] });
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, payload }) => {
			const { data, error } = await supabase
				.from("bonus_templates")
				.update(payload)
				.eq("id", id)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", clinicId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id) => {
			const { error } = await supabase.from("bonus_templates").delete().eq("id", id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bonusTemplates", clinicId] });
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
	const { clinicId } = useTenant();
	return useQuery({
		queryKey: ["clientBonuses", clinicId, clientId],
		queryFn: () => fetchClientBonuses(clientId),
		enabled: !!userId && !!clinicId && !!clientId,
	});
};

/** Bono activo para cliente + tratamiento (para SessionModal) */
export const useActiveBonoForSession = (userId, clientId, treatmentId) => {
	const { clinicId } = useTenant();
	return useQuery({
		queryKey: ["activeBono", clinicId, clientId, treatmentId],
		queryFn: async () => {
			if (!clientId || !treatmentId) return null;
			const { data, error } = await supabase
				.from("client_bonuses")
				.select("id, total_sessions, used_sessions, bonus_templates(name)")
				.eq("client_id", clientId)
				.eq("treatment_id", treatmentId)
				.eq("status", "active")
				.limit(1)
				.maybeSingle();
			if (error) throw error;
			return data;
		},
		enabled: !!userId && !!clinicId && !!clientId && !!treatmentId,
	});
};

/** Vender bono: inserta client_bonuses + ingreso en finance_entries */
export const useSellBono = (user) => {
	const userId = user?.id;
	const { clinicId } = useTenant();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ clientId, templateId, templateName, treatmentId, totalSessions, pricePaid, paymentDate }) => {
			if (!clinicId) throw new Error("Clínica no disponible");
			const amount = Number(pricePaid) || 0;
			const { baseAmount, taxAmount } = calculateTaxReverse(amount, BONUS_TAX_RATE);

			const { data: bonus, error: bonusError } = await supabase
				.from("client_bonuses")
				.insert([
					{
						user_id: userId,
						clinic_id: clinicId,
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
					clinic_id: clinicId,
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
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["clientBonuses", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["activeBono", clinicId] });
		},
	});
};

/** Consumir una sesión del bono: +1 used_sessions, status → exhausted si llega al total */
export const useConsumeBono = () => {
	const { clinicId } = useTenant();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (clientBonoId) => {
			const { data: row, error: fetchErr } = await supabase
				.from("client_bonuses")
				.select("used_sessions, total_sessions")
				.eq("id", clientBonoId)
				.single();
			if (fetchErr || !row) throw new Error("Bono no encontrado");

			const newUsed = (row.used_sessions ?? 0) + 1;
			const status = newUsed >= row.total_sessions ? "exhausted" : "active";

			const { error: updateErr } = await supabase
				.from("client_bonuses")
				.update({ used_sessions: newUsed, status })
				.eq("id", clientBonoId);
			if (updateErr) throw updateErr;

			return { used_sessions: newUsed, status };
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["clientBonuses", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["activeBono", clinicId] });
		},
	});
};
