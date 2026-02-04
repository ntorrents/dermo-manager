import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export const useData = (user) => {
	const [data, setData] = useState({
		inventory: [],
		treatments: [],
		recurringConfig: [],
		loading: true,
	});

	useEffect(() => {
		if (!user) {
			setData((prev) => ({ ...prev, loading: false }));
			return;
		}

		const fetchAllData = async () => {
			try {
				// Ejecutamos todas las consultas a la vez para ganar velocidad
				const [invRes, treatRes, recRes] = await Promise.all([
					supabase.from("inventory").select("*").order("name"),
					supabase.from("treatments").select("*").order("name"),
					supabase.from("recurring_config").select("*"),
				]);

				if (invRes.error) throw invRes.error;
				if (treatRes.error) throw treatRes.error;
				if (recRes.error) throw recRes.error;

				setData({
					inventory: invRes.data || [],
					treatments: treatRes.data || [],
					recurringConfig: recRes.data || [],
					loading: false,
				});
			} catch (error) {
				console.error("Error cargando datos globales:", error.message);
				setData((prev) => ({ ...prev, loading: false }));
			}
		};

		fetchAllData();

		// Suscripciones en tiempo real para que los cambios se vean al instante
		const channels = [
			supabase
				.channel("realtime-inventory")
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "inventory" },
					fetchAllData
				),
			supabase
				.channel("realtime-treatments")
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "treatments" },
					fetchAllData
				),
			supabase
				.channel("realtime-recurring")
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "recurring_config" },
					fetchAllData
				),
		].map((channel) => channel.subscribe());

		return () => {
			channels.forEach((channel) => supabase.removeChannel(channel));
		};
	}, [user]);

	return data;
};
