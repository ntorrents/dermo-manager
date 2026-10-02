/**
 * Tiempos de caché React Query por tipo de dato.
 * refetchOnWindowFocus queda desactivado a nivel global (QueryProvider).
 */
export const QUERY_STALE = {
	/** Catálogos / baja mutabilidad: tratamientos, stock, plantillas, grupos, bonos plantilla */
	catalog: 5 * 60_000,
	/** Listados operativos con realtime: clientes, finanzas, agenda */
	operational: 2 * 60_000,
	/** Declaraciones fiscales / config recurrente */
	semiStatic: 3 * 60_000,
};
