import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";

export const useData = (user) => {
	const [data, setData] = useState({
		inventory: [],
		treatments: [],
		entries: [],
		recurringConfig: [],
		loading: true,
	});

	// Usamos useCallback para que la función sea estable
	const fetchAllData = useCallback(async () => {
		// Si no hay usuario, limpiamos los datos y paramos de cargar
		if (!user) {
			setData({
				inventory: [],
				treatments: [],
				entries: [],
				recurringConfig: [],
				loading: false,
			});
			return;
		}

		try {
			const [inv, treat, rec, fin] = await Promise.all([
				supabase
					.from("inventory")
					.select("*")
					.eq("user_id", user.id)
					.order("name"),
				supabase
					.from("treatments")
					.select("*")
					.eq("user_id", user.id)
					.order("name"),
				supabase.from("recurring_config").select("*").eq("user_id", user.id),
				supabase
					.from("finance_entries")
					.select("*")
					.eq("user_id", user.id)
					.order("date", { ascending: false }),
			]);

			setData({
				inventory: inv.data || [],
				treatments: treat.data || [],
				recurringConfig: rec.data || [],
				entries: fin.data || [],
				loading: false,
			});
		} catch (error) {
			console.error("Error crítico en useData:", error);
			setData((prev) => ({ ...prev, loading: false }));
		}
	}, [user]);

	useEffect(() => {
		// 1. Cargamos (o limpiamos) los datos iniciales
		fetchAllData();

		// Si no hay usuario, no nos suscribimos a cambios
		if (!user) return;

		// 2. Nos suscribimos a cambios en la base de datos
		const channel = supabase
			.channel("global-db-changes")
			.on("postgres_changes", { event: "*", schema: "public" }, () => {
				// <--- CORREGIDO: Quitamos 'payload' que no se usaba
				fetchAllData();
			})
			.subscribe();

		return () => supabase.removeChannel(channel);
	}, [user, fetchAllData]);

	// Devolvemos la función refreshData para uso manual
	return { ...data, refreshData: fetchAllData };
};
