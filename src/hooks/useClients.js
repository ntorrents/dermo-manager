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

		// Función para obtener clientes de Supabase
		const fetchClients = async () => {
			try {
				setLoading(true);
				const { data, error } = await supabase
					.from("clients")
					.select("*")
					.order("name", { ascending: true });

				if (error) throw error;
				setClients(data || []);
			} catch (error) {
				console.error("Error cargando clientes:", error.message);
			} finally {
				setLoading(false);
			}
		};

		fetchClients();

		// Suscripción en tiempo real (Opcional, pero muy pro)
		const subscription = supabase
			.channel("public:clients")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "clients" },
				fetchClients
			)
			.subscribe();

		return () => {
			supabase.removeChannel(subscription);
		};
	}, [user]);

	return { clients, loading };
};
