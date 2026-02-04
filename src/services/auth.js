import { supabase } from "./supabase";

// Iniciar sesión con Email y Contraseña
export const login = async (email, password) => {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
	return data.user;
};

// Cerrar sesión
export const logout = async () => {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
};

// Actualizar contraseña (mucho más simple que en Firebase)
export const updateUserPassword = async (newPassword) => {
	const { data, error } = await supabase.auth.updateUser({
		password: newPassword,
	});
	if (error) throw error;
	return data;
};

// Función auxiliar para obtener usuario actual
export const getCurrentUser = async () => {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
};
