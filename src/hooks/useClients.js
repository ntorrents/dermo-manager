import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export const useClients = (user) => {
	const [clients, setClients] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setClients([]);
			setLoading(false);
			return;
		}

		const fetchClients = async () => {
			try {
				setLoading(true);
				// CORREGIDO: user.id
				const { data, error } = await supabase
					.from("clients")
					.select("*")
					.eq("user_id", user.id)
					.order("name", { ascending: true });

				if (error) throw error;
				setClients(data || []);
			} catch (err) {
				console.error("Error cargando clientes:", err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchClients();

		// CORREGIDO: Filtro de realtime con user.id
		const channel = supabase
			.channel("clients-realtime")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "clients",
					filter: `user_id=eq.${user.id}`,
				},
				fetchClients
			)
			.subscribe();

		return () => supabase.removeChannel(channel);
	}, [user]);

	return { clients, loading };
};
