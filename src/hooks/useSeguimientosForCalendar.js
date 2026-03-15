import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

const fetchSeguimientosForCalendar = async (userId) => {
	if (!userId) return [];
	const { data, error } = await supabase
		.from("seguimientos_cliente")
		.select("id, client_id, tratamientos_interes, fecha_proximo_contacto, notas, created_at")
		.eq("user_id", userId)
		.not("fecha_proximo_contacto", "is", null)
		.order("fecha_proximo_contacto", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useSeguimientosForCalendar = (userId) => {
	const { data: seguimientos = [], isLoading, refetch } = useQuery({
		queryKey: ["seguimientosForCalendar", userId],
		queryFn: () => fetchSeguimientosForCalendar(userId),
		enabled: !!userId,
	});

	return { seguimientos, loading: isLoading, refetch };
};
