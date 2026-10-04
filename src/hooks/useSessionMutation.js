import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useTenant } from "../context/TenantContext";
import { consumeFromBatchesFIFO } from "../services/inventoryBatches";
import { calculateSessionCost } from "../utils/calculations";
import {
	calculateIncomeFromPvp,
	getTreatmentTaxRate,
	resolveClientIrpfRate,
} from "../utils/incomeTax";
import { getNextInvoiceNumber } from "../services/invoiceSeries";
import { addDaysToYmd } from "../utils/dateUtils";

export const useSessionMutation = (userId, inventory = []) => {
	const queryClient = useQueryClient();
	const { clinicId } = useTenant();

	return useMutation({
		mutationFn: async ({
			treatment,
			clientData,
			finalPrice,
			date,
			extras = [],
			internal_notes = "",
			planAmigo = false,
			allowShortfall = true,
			scheduleReviewReminder = false,
		}) => {
			if (!clinicId) throw new Error("Clínica no disponible");
			const baseRecipe = treatment.recipe || [];
			const totalConsumption = [...baseRecipe, ...extras];
			const combinedQuantities = totalConsumption.reduce((acc, item) => {
				const qty = Number(item.quantity) || 0;
				if (!item.materialId) return acc;
				acc[item.materialId] = (acc[item.materialId] || 0) + qty;
				return acc;
			}, {});

			const cost = calculateSessionCost(combinedQuantities, inventory);
			const displayName = clientData.id
				? `${treatment.name} (${clientData.name} ${clientData.surname || ""})`
				: `${treatment.name} (${clientData.name})`;

			const pvp = Number(finalPrice);
			const taxRate = getTreatmentTaxRate(treatment);
			const irpfRate = resolveClientIrpfRate(clientData);
			const {
				baseAmount: taxBase,
				taxAmount,
				irpfAmount,
				totalAmount,
			} = calculateIncomeFromPvp(pvp, taxRate, irpfRate);

			let invoice_number = null;
			if (!planAmigo) {
				const year = date ? parseInt(date.slice(0, 4), 10) : new Date().getFullYear();
				try {
					invoice_number = await getNextInvoiceNumber(clinicId, year);
				} catch {
					// RPC no existe aún. Guardamos sin número.
				}
			}

			const { data: finRow, error } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: userId,
						clinic_id: clinicId,
						date,
						type: "income",
						category: "Servicio",
						description: displayName,
						amount: totalAmount,
						total_amount: totalAmount,
						tax_rate: taxRate,
						tax_base: taxBase,
						tax_amount: taxAmount,
						irpf_rate: irpfRate,
						irpf_amount: irpfAmount,
						invoice_number,
						related_cost: Number(cost),
						client_id: clientData.id || null,
						internal_notes: internal_notes?.trim() || null,
						plan_amigo: !!planAmigo,
						activo: true,
					},
				])
				.select("id")
				.single();
			if (error) throw error;

			// Consumo FIFO + ledger (después de crear el income para enlazar finance_entry_id)
			for (const [matId, qty] of Object.entries(combinedQuantities)) {
				const item = inventory.find((i) => i.id === matId);
				if (item && (item.item_type || "material") === "material") {
					await consumeFromBatchesFIFO(matId, qty, {
						allowShortfall,
						clinicId,
						userId,
						clientId: clientData.id || null,
						financeEntryId: finRow?.id || null,
						occurredAt: date,
						reason: `Sesión: ${treatment.name}`,
					});
				}
			}

			// Recordatorio interno (+15 días): seguimiento, no cita en agenda
			if (scheduleReviewReminder && clientData?.id) {
				const due = addDaysToYmd(date, 15);
				if (due) {
					const clientLabel = [clientData.name, clientData.surname]
						.filter(Boolean)
						.join(" ");
					const { error: remErr } = await supabase
						.from("seguimientos_cliente")
						.insert([
							{
								user_id: userId,
								clinic_id: clinicId,
								client_id: clientData.id,
								titulo: `Revisión · ${treatment.name}`,
								tratamientos_interes: treatment.name || null,
								fecha_proximo_contacto: due,
								notas: `Recordatorio automático tras sesión del ${date}${
									clientLabel ? ` · ${clientLabel}` : ""
								}`,
							},
						]);
					if (remErr) {
						// La sesión ya está guardada: no revertimos por el recordatorio
						console.error("recordatorio revisión 15d:", remErr);
					}
				}
			}
		},
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["inventoryBatches", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["finance", clinicId] });
			queryClient.invalidateQueries({ queryKey: ["stock_movements", clinicId] });
			if (vars?.scheduleReviewReminder && vars?.clientData?.id) {
				queryClient.invalidateQueries({
					queryKey: ["clientSeguimientos", vars.clientData.id],
				});
				queryClient.invalidateQueries({ queryKey: ["clinicSeguimientos", clinicId] });
			}
		},
	});
};
