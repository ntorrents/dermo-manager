import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext();

export const useAuth = () => {
	return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// 1. Verificar sesión activa al iniciar
		const checkSession = async () => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				setUser(session?.user ?? null);
			} catch (error) {
				console.error("Error verificando sesión:", error);
			} finally {
				setLoading(false);
			}
		};

		checkSession();

		// 2. Escuchar cambios en la autenticación (Login, Logout, Auto-refresh)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		return () => {
			subscription?.unsubscribe();
		};
	}, []);

	const value = {
		user,
		loading,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
