import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";

export const useClients = (user) => {
	const [clients, setClients] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchClients = useCallback(async () => {
		if (!user) return;
		try {
			setLoading(true);
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
	}, [user]);

	useEffect(() => {
		if (!user) {
			setClients([]);
			setLoading(false);
			return;
		}

		fetchClients();

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
	}, [user, fetchClients]);

	return { clients, loading, refreshClients: fetchClients };
};
