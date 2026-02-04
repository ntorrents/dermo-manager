import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export const useData = (user) => {
	const [data, setData] = useState({
		inventory: [],
		treatments: [],
		entries: [],
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
				// Dentro de fetchAllData en useData.js
				const [inv, treat, rec, fin] = await Promise.all([
					supabase
						.from("inventory")
						.select("*")
						.eq("user_id", user.uid)
						.order("name"),
					supabase
						.from("treatments")
						.select("*")
						.eq("user_id", user.uid)
						.order("name"),
					supabase.from("recurring_config").select("*").eq("user_id", user.uid),
					supabase
						.from("finance_entries")
						.select("*")
						.eq("user_id", user.uid)
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
		};

		fetchAllData();
		const channel = supabase
			.channel("db-changes")
			.on("postgres_changes", { event: "*", schema: "public" }, fetchAllData)
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [user]);

	return data;
};
