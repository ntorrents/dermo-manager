import { supabase } from "./supabase";

/**
 * Deduce cantidad de un material usando FIFO (lote que caduca antes primero).
 */
export const consumeFromBatchesFIFO = async (inventoryId, quantity) => {
	const qtyNeeded = Number(quantity);
	if (qtyNeeded <= 0) return;

	const { data: batches, error: fetchError } = await supabase
		.from("inventory_batches")
		.select("*")
		.eq("inventory_id", inventoryId)
		.gt("quantity_remaining", 0)
		.order("expiry_date", { ascending: true });

	if (fetchError) throw fetchError;
	if (!batches?.length) throw new Error("No hay lotes disponibles para este material");

	let remaining = qtyNeeded;
	for (const batch of batches) {
		if (remaining <= 0) break;
		const deduct = Math.min(remaining, Number(batch.quantity_remaining));
		const newQty = Number(batch.quantity_remaining) - deduct;
		remaining -= deduct;

		if (newQty <= 0) {
			const { error } = await supabase
				.from("inventory_batches")
				.delete()
				.eq("id", batch.id);
			if (error) throw error;
		} else {
			const { error } = await supabase
				.from("inventory_batches")
				.update({ quantity_remaining: newQty })
				.eq("id", batch.id);
			if (error) throw error;
		}
	}

	if (remaining > 0) {
		throw new Error(`Stock insuficiente: faltan ${remaining} unidades`);
	}

	// Sincronizar inventory.stock con suma de lotes
	const { data: remainingBatches } = await supabase
		.from("inventory_batches")
		.select("quantity_remaining")
		.eq("inventory_id", inventoryId);

	const newStock = (remainingBatches || []).reduce(
		(sum, b) => sum + Number(b.quantity_remaining),
		0
	);

	const { error } = await supabase
		.from("inventory")
		.update({ stock: newStock })
		.eq("id", inventoryId);
	if (error) throw error;
};
