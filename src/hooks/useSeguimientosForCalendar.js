import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchSeguimientosForCalendar = async () => {
	const { data, error } = await supabase
		.from("seguimientos_cliente")
		.select("id, client_id, tratamientos_interes, fecha_proximo_contacto, notas, created_at")
		.not("fecha_proximo_contacto", "is", null)
		.order("fecha_proximo_contacto", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useSeguimientosForCalendar = (userId) => {
	const { clinicId } = useTenant();
	const { data: seguimientos = [], isLoading, refetch } = useQuery({
		queryKey: ["seguimientosForCalendar", clinicId],
		queryFn: fetchSeguimientosForCalendar,
		enabled: !!userId && !!clinicId,
	});

	return { seguimientos, loading: isLoading, refetch };
};
