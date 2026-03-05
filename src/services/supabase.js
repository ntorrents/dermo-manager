import { createClient } from "@supabase/supabase-js";

// Vite solo expone variables que empiezan por VITE_. Aceptamos varios nombres para compatibilidad.
const supabaseUrl =
	import.meta.env.VITE_SUPABASE_URL ||
	import.meta.env.VITE_BBDD_PRE ||
	import.meta.env.VITE_BBDD_PRO;
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	import.meta.env.VITE_BBDD_PRE_ANON_KEY ||
	import.meta.env.VITE_BBDD_PRO_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	const msg =
		"Faltan las variables de entorno de Supabase. Crea .env.local con la URL y la anon key (ej. VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, o VITE_BBDD_PRE y VITE_BBDD_PRE_ANON_KEY). Ver .env.example.";
	console.error(msg);
	throw new Error(msg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
