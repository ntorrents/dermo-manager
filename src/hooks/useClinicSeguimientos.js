import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";

const fetchClinicSeguimientos = async (clinicId) => {
	if (!clinicId) return [];
	const { data, error } = await supabase
		.from("seguimientos_cliente")
		.select(
			"id, titulo, fecha_proximo_contacto, client_id, notas, created_at, updated_at",
		)
		.eq("clinic_id", clinicId)
		.not("fecha_proximo_contacto", "is", null)
		.order("fecha_proximo_contacto", { ascending: true });
	if (error) throw error;
	return data || [];
};

export const useClinicSeguimientos = (userId) => {
	const { clinicId } = useTenant();
	return useQuery({
		queryKey: ["clinicSeguimientos", clinicId],
		queryFn: () => fetchClinicSeguimientos(clinicId),
		enabled: !!userId && !!clinicId,
		staleTime: 60_000,
	});
};

/** Seguimientos con fecha de contacto hoy o anterior. */
export function getOverdueSeguimientos(seguimientos = [], todayYmd) {
	const today = todayYmd || new Date().toISOString().slice(0, 10);
	return (seguimientos || []).filter((s) => {
		const d = s.fecha_proximo_contacto;
		return d && String(d).slice(0, 10) <= today;
	});
}
