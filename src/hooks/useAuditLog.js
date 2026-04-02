import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabase";

/**
 * @param {string | null} clinicId
 * @param {{ limit?: number; enabled?: boolean }} options
 */
export function useAuditLog(clinicId, options = {}) {
	const { limit = 80, enabled = true } = options;
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const load = useCallback(async () => {
		if (!clinicId || !enabled) {
			setRows([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const { data, error: err } = await supabase
				.from("audit_log")
				.select("id, action, entity_type, entity_id, summary, metadata, created_at, user_id, clinic_id")
				.eq("clinic_id", clinicId)
				.order("created_at", { ascending: false })
				.limit(limit);
			if (err) throw err;
			setRows(data || []);
		} catch (e) {
			console.error(e);
			setError(e);
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [clinicId, enabled, limit]);

	useEffect(() => {
		load();
	}, [load]);

	return { rows, loading, error, refresh: load };
}
