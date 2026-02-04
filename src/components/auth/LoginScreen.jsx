import React, { useState } from "react";
import { login } from "../../services/auth";
import { Loader2, Lock, Mail } from "lucide-react";

export const LoginScreen = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			await login(email, password);
			// No hace falta redirigir manual, el AuthContext detectará el cambio
		} catch (err) {
			console.error(err);
			setError("Credenciales incorrectas o error de conexión.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
			<div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-md border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-black text-gray-800 tracking-tight">
						Bienvenido
					</h1>
					<p className="text-gray-400 font-medium">
						Inicia sesión en DermoManager
					</p>
				</div>

				{error && (
					<div className="bg-rose-50 text-rose-500 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-rose-100">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-1">
						<label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
							Email
						</label>
						<div className="relative">
							<Mail
								className="absolute left-4 top-3.5 text-gray-400"
								size={20}
							/>
							<input
								type="email"
								required
								className="w-full pl-12 p-3.5 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all"
								placeholder="usuario@ejemplo.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-1">
						<label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
							Contraseña
						</label>
						<div className="relative">
							<Lock
								className="absolute left-4 top-3.5 text-gray-400"
								size={20}
							/>
							<input
								type="password"
								required
								className="w-full pl-12 p-3.5 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
					</div>

					<button
						disabled={loading}
						className="w-full bg-[#1e293b] text-white font-black py-4 rounded-2xl shadow-lg hover:bg-black transition-all flex justify-center items-center gap-2 mt-4">
						{loading ? <Loader2 className="animate-spin" /> : "Entrar"}
					</button>
				</form>
			</div>
		</div>
	);
};
