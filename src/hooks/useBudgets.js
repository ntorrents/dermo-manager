import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchBudgets = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("presupuestos")
		.select("*, presupuesto_lineas(*)")
		.eq("user_id", userId)
		.eq("activo", true)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return (data || []).map((b) => ({
		...b,
		presupuesto_lineas: [...(b.presupuesto_lineas || [])].sort(
			(a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0),
		),
	}));
};

export const useBudgets = (userId) => {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["presupuestos", userId],
		queryFn: () => fetchBudgets(userId),
		enabled: !!userId,
	});

	const createMutation = useMutation({
		mutationFn: async ({ client_id, nombre, notas, valid_until, discount_mode, discount_percent, lineas }) => {
			const { data: pres, error: e1 } = await supabase
				.from("presupuestos")
				.insert([
					{
						user_id: userId,
						client_id,
						nombre: nombre?.trim() || null,
						notas: notas?.trim() || null,
						valid_until: valid_until || null,
						discount_mode: discount_mode || "manual",
						discount_percent: discount_percent != null && discount_percent !== "" ? Number(discount_percent) : null,
					},
				])
				.select()
				.single();
			if (e1) throw e1;
			const pid = pres.id;
			const rows = (lineas || []).map((ln, idx) => ({
				presupuesto_id: pid,
				line_kind: ln.line_kind || "extra",
				treatment_id: ln.treatment_id || null,
				description: ln.description,
				quantity: Number(ln.quantity) || 1,
				original_unit_price_ttc:
					ln.original_unit_price_ttc != null && ln.original_unit_price_ttc !== ""
						? Number(ln.original_unit_price_ttc)
						: null,
				unit_price_ttc: Number(ln.unit_price_ttc) || 0,
				tax_rate: Number(ln.tax_rate) ?? 21,
				sort_order: idx,
			}));
			if (rows.length) {
				const { error: e2 } = await supabase.from("presupuesto_lineas").insert(rows);
				if (e2) throw e2;
			}
			return pres.id;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["presupuestos", userId] });
		},
	});

	const archiveMutation = useMutation({
		mutationFn: async (presupuestoId) => {
			const { error } = await supabase
				.from("presupuestos")
				.update({ activo: false, updated_at: new Date().toISOString() })
				.eq("id", presupuestoId)
				.eq("user_id", userId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["presupuestos", userId] });
		},
	});

	return {
		budgets: query.data ?? [],
		loading: query.isLoading,
		refetch: query.refetch,
		createBudget: createMutation.mutateAsync,
		archiving: archiveMutation.isPending,
		archiveBudget: archiveMutation.mutateAsync,
		creating: createMutation.isPending,
	};
};
