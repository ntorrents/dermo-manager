import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

/**
 * Hook para obtener el historial de tratamientos de un cliente.
 * Solo necesita el ID del cliente.
 */
export const useClientHistory = (clientId) => {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Si no hay ID de cliente seleccionado, limpiamos el historial y salimos
		if (!clientId) {
			setHistory([]);
			setLoading(false);
			return;
		}

		const fetchHistory = async () => {
			setLoading(true);
			try {
				// Consultamos la tabla de finanzas filtrando por el client_id
				// Buscamos solo 'income' que son los servicios realizados
				const { data, error } = await supabase
					.from("finance_entries")
					.select("*")
					.eq("client_id", clientId)
					.eq("type", "income")
					.order("date", { ascending: false });

				if (error) throw error;
				setHistory(data || []);
			} catch (error) {
				console.error("Error cargando historial:", error.message);
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [clientId]); // Solo se vuelve a ejecutar si cambia el ID del cliente

	return { history, loading };
};
