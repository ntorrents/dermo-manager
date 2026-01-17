// /Users/nilto/Documents/GitHub/DermoManager/src/components/auth/LoginScreen.jsx
import React, { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import {
	loginWithEmail,
	registerWithEmail,
	loginWithGoogle,
} from "../../services/auth";

export const LoginScreen = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [isRegistering, setIsRegistering] = useState(false);

	const handleAuth = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			if (isRegistering) await registerWithEmail(email, password);
			else await loginWithEmail(email, password);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
			<div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-rose-100">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-purple-600">
						DermoApp
					</h1>
					<p className="text-gray-400 text-sm">
						Gestión inteligente para esteticistas
					</p>
				</div>
				<button
					onClick={loginWithGoogle}
					className="w-full mb-4 py-3 rounded-xl border border-gray-200 flex justify-center items-center gap-2 hover:bg-gray-50 font-medium text-gray-700">
					<span className="text-lg">G</span> Continuar con Google
				</button>
				<div className="relative flex py-2 items-center">
					<div className="flex-grow border-t"></div>
					<span className="flex-shrink-0 mx-4 text-gray-400 text-xs">
						O usa tu email
					</span>
					<div className="flex-grow border-t"></div>
				</div>
				<form onSubmit={handleAuth} className="space-y-4 mt-4">
					<div className="relative">
						<Mail className="absolute left-3 top-3 text-gray-400" size={18} />
						<input
							type="email"
							placeholder="Email"
							className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="relative">
						<Lock className="absolute left-3 top-3 text-gray-400" size={18} />
						<input
							type="password"
							placeholder="Contraseña"
							className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					{error && <p className="text-red-500 text-xs">{error}</p>}
					<button className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600">
						{loading ? (
							<Loader2 className="animate-spin mx-auto" />
						) : isRegistering ? (
							"Crear Cuenta"
						) : (
							"Entrar"
						)}
					</button>
				</form>
				<button
					onClick={() => setIsRegistering(!isRegistering)}
					className="mt-4 text-sm text-rose-500 hover:underline w-full text-center">
					{isRegistering ? "¿Ya tienes cuenta?" : "Crear cuenta nueva"}
				</button>
			</div>
		</div>
	);
};
