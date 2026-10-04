import { supabase } from "./supabase";

/**
 * Inserta filas en inventory_stock_movements (best-effort si la tabla aún no existe en prod).
 */
export const logStockMovements = async (rows = []) => {
	if (!rows.length) return;
	const { error } = await supabase.from("inventory_stock_movements").insert(rows);
	if (error) {
		console.warn("inventory_stock_movements:", error.message);
	}
};

/**
 * Deduce cantidad de un material usando FIFO (lote que caduca antes primero).
 * @param {object} opts
 * @param {boolean} [opts.allowShortfall=true] Si true, permite stock negativo cuando faltan unidades.
 * @returns {Promise<{ consumed: Array<{batchId, lotNumber, quantity}>, shortfall: number, newStock: number }>}
 */
export const consumeFromBatchesFIFO = async (
	inventoryId,
	quantity,
	{
		allowShortfall = true,
		clinicId = null,
		userId = null,
		clientId = null,
		financeEntryId = null,
		occurredAt = null,
		reason = null,
	} = {},
) => {
	const qtyNeeded = Number(quantity);
	if (qtyNeeded <= 0) {
		return { consumed: [], shortfall: 0, newStock: null };
	}

	const { data: batches, error: fetchError } = await supabase
		.from("inventory_batches")
		.select("*")
		.eq("inventory_id", inventoryId)
		.gt("quantity_remaining", 0)
		.order("expiry_date", { ascending: true });

	if (fetchError) throw fetchError;

	let remaining = qtyNeeded;
	const consumed = [];

	for (const batch of batches || []) {
		if (remaining <= 0) break;
		const deduct = Math.min(remaining, Number(batch.quantity_remaining));
		const newQty = Number(batch.quantity_remaining) - deduct;
		remaining -= deduct;
		consumed.push({
			batchId: batch.id,
			lotNumber: batch.lot_number,
			quantity: deduct,
		});

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

	const shortfall = remaining > 0 ? remaining : 0;
	if (shortfall > 0 && !allowShortfall) {
		throw new Error(`Stock insuficiente: faltan ${shortfall} unidades`);
	}

	const { data: remainingBatches } = await supabase
		.from("inventory_batches")
		.select("quantity_remaining")
		.eq("inventory_id", inventoryId);

	const batchSum = (remainingBatches || []).reduce(
		(sum, b) => sum + Number(b.quantity_remaining),
		0,
	);
	// Si hubo shortfall, el stock de cabecera queda negativo respecto a lo pedido.
	const newStock = shortfall > 0 ? batchSum - shortfall : batchSum;

	const { error } = await supabase
		.from("inventory")
		.update({ stock: newStock })
		.eq("id", inventoryId);
	if (error) throw error;

	if (clinicId) {
		const day = occurredAt || new Date().toISOString().slice(0, 10);
		const movementRows = consumed.map((c) => ({
			clinic_id: clinicId,
			user_id: userId,
			inventory_id: inventoryId,
			batch_id: c.batchId,
			movement_type: "session_consume",
			quantity: -Math.abs(c.quantity),
			reason: reason || "Consumo en sesión",
			client_id: clientId,
			finance_entry_id: financeEntryId,
			occurred_at: day,
			metadata: { lot_number: c.lotNumber },
		}));
		if (shortfall > 0) {
			movementRows.push({
				clinic_id: clinicId,
				user_id: userId,
				inventory_id: inventoryId,
				batch_id: null,
				movement_type: "session_consume",
				quantity: -Math.abs(shortfall),
				reason: reason || "Consumo forzado sin lote (stock insuficiente)",
				client_id: clientId,
				finance_entry_id: financeEntryId,
				occurred_at: day,
				metadata: { shortfall: true },
			});
		}
		await logStockMovements(movementRows);
	}

	return { consumed, shortfall, newStock };
};

/**
 * Ajuste manual de stock (merma, rotura, error de cálculo) sin movimiento financiero.
 */
export const adjustInventoryStock = async ({
	inventoryId,
	clinicId,
	userId,
	delta,
	reason,
	reasonCode = "correction",
	batchId = null,
	occurredAt = null,
}) => {
	const qty = Number(delta);
	if (!qty || Number.isNaN(qty)) throw new Error("Cantidad de ajuste inválida");
	if (!reason?.trim()) throw new Error("Indica el motivo del ajuste");

	const { data: item, error: itemErr } = await supabase
		.from("inventory")
		.select("id, stock, item_type")
		.eq("id", inventoryId)
		.single();
	if (itemErr) throw itemErr;
	if ((item.item_type || "material") === "maquina") {
		throw new Error("Las máquinas no tienen stock ajustable");
	}

	let targetBatchId = batchId;

	if (qty < 0 && batchId) {
		const { data: batch, error: bErr } = await supabase
			.from("inventory_batches")
			.select("id, quantity_remaining, lot_number")
			.eq("id", batchId)
			.single();
		if (bErr) throw bErr;
		const next = Number(batch.quantity_remaining) + qty;
		if (next < 0) throw new Error("El ajuste supera la cantidad del lote");
		if (next === 0) {
			const { error } = await supabase.from("inventory_batches").delete().eq("id", batchId);
			if (error) throw error;
			targetBatchId = batchId;
		} else {
			const { error } = await supabase
				.from("inventory_batches")
				.update({ quantity_remaining: next })
				.eq("id", batchId);
			if (error) throw error;
		}
	} else if (qty > 0 && batchId) {
		const { data: batch, error: bErr } = await supabase
			.from("inventory_batches")
			.select("id, quantity_remaining")
			.eq("id", batchId)
			.single();
		if (bErr) throw bErr;
		const { error } = await supabase
			.from("inventory_batches")
			.update({ quantity_remaining: Number(batch.quantity_remaining) + qty })
			.eq("id", batchId);
		if (error) throw error;
	}

	const newStock = Number(item.stock) + qty;
	const { error: updErr } = await supabase
		.from("inventory")
		.update({ stock: newStock })
		.eq("id", inventoryId);
	if (updErr) throw updErr;

	const movementType =
		reasonCode === "waste" || reasonCode === "merma" || reasonCode === "rotura"
			? "waste"
			: "adjustment";

	await logStockMovements([
		{
			clinic_id: clinicId,
			user_id: userId,
			inventory_id: inventoryId,
			batch_id: targetBatchId,
			movement_type: movementType,
			quantity: qty,
			reason: reason.trim(),
			occurred_at: occurredAt || new Date().toISOString().slice(0, 10),
			metadata: { reason_code: reasonCode },
		},
	]);

	return { newStock };
};
