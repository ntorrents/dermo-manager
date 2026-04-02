import { supabase } from "./supabase";

/**
 * Obtiene el siguiente número de factura correlativo para la clínica y año.
 * Formato: F2026-001. Requiere la función get_next_invoice_number_by_clinic en Supabase.
 */
export const getNextInvoiceNumber = async (clinicId, year) => {
	if (!clinicId) throw new Error("clinicId es obligatorio");
	const y = year ?? new Date().getFullYear();
	const { data, error } = await supabase.rpc("get_next_invoice_number_by_clinic", {
		p_clinic_id: clinicId,
		p_year: y,
	});
	if (error) throw error;
	return data;
};

/**
 * Obtiene el siguiente número de factura rectificativa (abono) para la clínica y año.
 * Formato: R-2026-01. Requiere get_next_rectified_invoice_number_by_clinic en Supabase.
 */
export const getNextRectifiedInvoiceNumber = async (clinicId, year) => {
	if (!clinicId) throw new Error("clinicId es obligatorio");
	const y = year ?? new Date().getFullYear();
	const { data, error } = await supabase.rpc("get_next_rectified_invoice_number_by_clinic", {
		p_clinic_id: clinicId,
		p_year: y,
	});
	if (error) throw error;
	return data;
};
