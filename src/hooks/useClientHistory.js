import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export const useClientHistory = (user, clientId) => {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Si no hay usuario o no se ha seleccionado un cliente, no buscamos nada
		if (!user || !clientId) {
			setHistory([]);
			setLoading(false);
			return;
		}

		const fetchHistory = async () => {
			try {
				setLoading(true);

				// Consultamos la tabla de finanzas filtrando por el cliente
				// Solo buscamos los 'income' (ingresos), que representan las sesiones realizadas
				const { data, error } = await supabase
					.from("finance_entries")
					.select("*")
					.eq("client_id", clientId)
					.eq("type", "income")
					.order("date", { ascending: false }); // El tratamiento más reciente primero

				if (error) throw error;

				setHistory(data || []);
			} catch (error) {
				console.error(
					"Error cargando el historial del cliente:",
					error.message
				);
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();

		// Suscripción opcional para actualizar el historial en tiempo real si se añade una sesión
		const subscription = supabase
			.channel(`history-${clientId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "finance_entries",
					filter: `client_id=eq.${clientId}`,
				},
				fetchHistory
			)
			.subscribe();

		return () => {
			supabase.removeChannel(subscription);
		};
	}, [user, clientId]);

	return { history, loading };
};
