/**
 * Lógica de negocio centralizada (IVA, totales, márgenes, stats).
 * Los componentes importan desde aquí en lugar de calcular inline.
 */

/** Extrae base imponible y cuota IVA desde un total con IVA incluido (PVP). rate en % (ej: 21). */
export const calculateTaxReverse = (total, rate = 21) => {
	const amount = Number(total) || 0;
	const r = Number(rate) || 0;
	if (amount <= 0) return { baseAmount: 0, taxAmount: 0 };
	const baseAmount = Math.round((amount / (1 + r / 100)) * 100) / 100;
	const taxAmount = Math.round((amount - baseAmount) * 100) / 100;
	return { baseAmount, taxAmount };
};

/** Calcula income, expense y net a partir de entries */
export const calculateStats = (entries = []) => {
	const income = (entries || [])
		.filter((e) => e.type === "income")
		.reduce((a, b) => a + Number(b.amount || 0), 0);
	const expense = (entries || [])
		.filter((e) => e.type === "expense")
		.reduce((a, b) => a + Number(b.amount || 0), 0);
	return { income, expense, net: income - expense };
};

/** Porcentaje de crecimiento entre dos valores (current vs previous) */
export const calculateGrowth = (current, previous) => {
	if (!previous || previous === 0) return 0;
	return ((current - previous) / previous) * 100;
};

/** Coste unitario: totalCost / stock */
export const calculateUnitCost = (totalCost, stock) => {
	const total = Number(totalCost) || 0;
	const s = Number(stock) || 0;
	if (s <= 0) return 0;
	return total / s;
};

/** Coste real de una sesión (receta + extras) dado inventario */
export const calculateSessionCost = (combinedQuantities, inventory) =>
	Object.entries(combinedQuantities).reduce(
		(total, [matId, qty]) => {
			const item = inventory.find((m) => m.id === matId);
			return total + (item ? (Number(item.unit_cost) || 0) * qty : 0);
		},
		0
	);

/** Top tratamientos por número de sesiones (ranking de entries) */
export const getTopTreatments = (entries, treatments, limit = 5) => {
	const officialTreatments = new Set(
		(treatments || []).map((t) => t.name.toLowerCase())
	);
	const ranking = {};
	(entries || [])
		.filter((e) => e.type === "income" && e.description)
		.forEach((e) => {
			const rawName = e.description.split("(")[0].trim();
			if (officialTreatments.has(rawName.toLowerCase())) {
				if (!ranking[rawName]) ranking[rawName] = { count: 0, amount: 0 };
				ranking[rawName].count += 1;
				ranking[rawName].amount += Number(e.amount || 0);
			}
		});
	return Object.entries(ranking)
		.map(([name, data]) => ({ name, ...data }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
};

/** Items con stock bajo (stock <= min_stock). Excluye máquinas (sin stock). */
export const getLowStockItems = (inventory = [], defaultMin = 5) =>
	(inventory || []).filter(
		(i) =>
			(i.item_type || "material") === "material" &&
			Number(i.stock) <= Number(i.min_stock ?? defaultMin)
	);

/** Items con al menos un lote caducado (expiry_date < hoy). batches: { inventory_id, expiry_date }[] */
export const getItemsWithExpiredBatches = (inventory = [], batches = []) => {
	const today = new Date().toISOString().slice(0, 10);
	const expiredInventoryIds = new Set(
		batches
			.filter((b) => b.expiry_date && b.expiry_date < today)
			.map((b) => b.inventory_id)
	);
	return (inventory || []).filter((i) => expiredInventoryIds.has(i.id));
};
