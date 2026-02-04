import { supabase } from "./supabase";

// Iniciar sesión con Email y Contraseña
export const login = async (email, password) => {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
	return data;
};

// Cerrar sesión
export const logout = async () => {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
};

// Actualizar contraseña
export const updateUserPassword = async (newPassword) => {
	const { data, error } = await supabase.auth.updateUser({
		password: newPassword,
	});
	if (error) throw error;
	return data;
};

// --- AÑADIDO: Iniciar sesión con Google ---
export const signInWithGoogle = async () => {
	// Redirige a la URL actual tras el login (funciona en localhost y en vercel si está configurado)
	const redirectTo = window.location.origin;

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: redirectTo,
		},
	});

	if (error) throw error;
	return data;
};
