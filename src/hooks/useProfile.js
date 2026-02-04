import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export const useProfile = (user) => {
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setProfile(null);
			setLoading(false);
			return;
		}

		const fetchProfile = async () => {
			try {
				setLoading(true);
				const { data, error } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", user.id) // CORREGIDO: user.id
					.single();

				if (error && error.code !== "PGRST116") {
					console.error("Error cargando perfil:", error.message);
				}

				if (data) {
					setProfile(data);
				} else {
					setProfile({
						id: user.id,
						company_name: "Mi Centro",
						theme_color: "#f43f5e",
					});
				}
			} catch (err) {
				console.error("Fallo en useProfile:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
	}, [user]);

	return profile;
};
