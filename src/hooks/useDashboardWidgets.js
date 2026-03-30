import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";
import {
	DEFAULT_WIDGETS,
	MAX_WIDGETS,
	getWidgetById,
} from "../components/dashboard/widgets";

/**
 * Normaliza datos guardados: soporta formato antiguo (string[]) y nuevo ({ id, colSpan?, rowSpan? }[]).
 * @returns { { id: string, colSpan: number, rowSpan: number }[] }
 */
function normalizeWidgets(saved) {
	if (!Array.isArray(saved) || saved.length === 0) {
		return DEFAULT_WIDGETS.slice(0, MAX_WIDGETS);
	}
	const withoutAlerts = saved.filter((item) => {
		const id = typeof item === "string" ? item : item?.id;
		return id !== "alerts";
	});
	if (withoutAlerts.length === 0) {
		return DEFAULT_WIDGETS.slice(0, MAX_WIDGETS);
	}
	return withoutAlerts.slice(0, MAX_WIDGETS).map((item) => {
		if (typeof item === "string") {
			const config = getWidgetById(item);
			return {
				id: item,
				colSpan: config?.defaultColSpan ?? 1,
				rowSpan: config?.defaultRowSpan ?? 1,
			};
		}
		const config = getWidgetById(item.id);
		return {
			id: item.id,
			colSpan: Math.max(1, Math.min(3, item.colSpan ?? config?.defaultColSpan ?? 1)),
			rowSpan: Math.max(1, Math.min(3, item.rowSpan ?? config?.defaultRowSpan ?? 1)),
		};
	});
}

/**
 * Carga y persiste la configuración de widgets del dashboard en profiles.dashboard_widgets.
 * Formato guardado: array de { id: string, colSpan: number, rowSpan: number }.
 */
export function useDashboardWidgets(userId) {
	const [widgets, setWidgets] = useState(() =>
		DEFAULT_WIDGETS.slice(0, MAX_WIDGETS)
	);
	const [loading, setLoading] = useState(!!userId);

	useEffect(() => {
		if (!userId) {
			setWidgets(DEFAULT_WIDGETS.slice(0, MAX_WIDGETS));
			setLoading(false);
			return;
		}

		const load = async () => {
			setLoading(true);
			try {
				const { data, error } = await supabase
					.from("profiles")
					.select("dashboard_widgets")
					.eq("id", userId)
					.maybeSingle();

				if (error) {
					console.error("Error cargando widgets del dashboard:", error);
					setLoading(false);
					return;
				}

				const saved = data?.dashboard_widgets;
				if (saved && Array.isArray(saved) && saved.length > 0) {
					setWidgets(normalizeWidgets(saved));
				}
			} catch (err) {
				console.error("useDashboardWidgets load:", err);
			} finally {
				setLoading(false);
			}
		};

		load();
	}, [userId]);

	const saveWidgets = useCallback(
		async (nextWidgets) => {
			if (!userId) return { error: null };
			const toSave = nextWidgets.slice(0, MAX_WIDGETS).map((w) => ({
				id: w.id,
				colSpan: w.colSpan ?? 1,
				rowSpan: w.rowSpan ?? 1,
			}));
			const { error } = await supabase
				.from("profiles")
				.update({ dashboard_widgets: toSave })
				.eq("id", userId);
			if (error) console.error("Error guardando widgets del dashboard:", error);
			return { error };
		},
		[userId]
	);

	return { widgets, setWidgets, saveWidgets, loading };
}
