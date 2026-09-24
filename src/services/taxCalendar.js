import { supabase } from "./supabase";
import { buildTaxCalendarEvents } from "../utils/tax/deadlines";

/**
 * Asegura eventos tax_deadline del año fiscal en appointments.
 * No borra eventos clínicos. Idempotente por título+año aproximado vía notes.
 */
export const ensureTaxCalendarEvents = async (fiscalYear, clinicId, userId) => {
	if (!clinicId || !userId || !fiscalYear) return { created: 0 };

	const marker = `ejercicio ${fiscalYear}`;
	const { data: existing, error: fetchErr } = await supabase
		.from("appointments")
		.select("id, notes, title")
		.eq("clinic_id", clinicId)
		.eq("type", "tax_deadline")
		.eq("activo", true);
	if (fetchErr) throw fetchErr;

	const already = new Set(
		(existing || [])
			.filter((a) => (a.notes || "").includes(marker))
			.map((a) => a.title),
	);

	const toInsert = buildTaxCalendarEvents(fiscalYear, clinicId, userId).filter(
		(e) => !already.has(e.title),
	);

	if (!toInsert.length) return { created: 0 };

	const { error } = await supabase.from("appointments").insert(toInsert);
	if (error) throw error;
	return { created: toInsert.length };
};

/** Cita clínica (métricas / alertas de pacientes). Excluye ventanas fiscales. */
export const isClinicalAppointment = (a) =>
	a && a.type !== "tax_deadline" && a.type !== "task";

export const filterClinicalAppointments = (appointments = []) =>
	(appointments || []).filter(isClinicalAppointment);
