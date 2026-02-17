import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";

const fetchHistoryForClient = async (clientId) => {
	if (!clientId) return [];
	const { data, error } = await supabase
		.from("finance_entries")
		.select("*")
		.eq("client_id", clientId)
		.eq("type", "income")
		.order("date", { ascending: false });
	if (error) throw error;
	return data || [];
};

/**
 * Hook para obtener el historial de tratamientos de un cliente.
 * Solo necesita el ID del cliente. refetch para actualizar tras rectificativas.
 */
export const useClientHistory = (clientId) => {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(false);

	const refetch = useCallback(async () => {
		if (!clientId) {
			setHistory([]);
			return;
		}
		setLoading(true);
		try {
			const data = await fetchHistoryForClient(clientId);
			setHistory(data);
		} catch (err) {
			console.error("Error cargando historial:", err.message);
		} finally {
			setLoading(false);
		}
	}, [clientId]);

	useEffect(() => {
		if (!clientId) {
			setHistory([]);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		fetchHistoryForClient(clientId)
			.then((data) => {
				if (!cancelled) setHistory(data);
			})
			.catch((err) => {
				if (!cancelled) console.error("Error cargando historial:", err.message);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [clientId]);

	return { history, loading, refetch };
};
