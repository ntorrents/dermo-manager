import { supabase } from "./supabase";

/**
 * Obtiene el siguiente número de factura correlativo para el usuario y año.
 * Formato: F2026-001. Requiere la función get_next_invoice_number en Supabase.
 */
export const getNextInvoiceNumber = async (userId, year) => {
	const y = year ?? new Date().getFullYear();
	const { data, error } = await supabase.rpc("get_next_invoice_number", {
		p_user_id: userId,
		p_year: y,
	});
	if (error) throw error;
	return data;
};
