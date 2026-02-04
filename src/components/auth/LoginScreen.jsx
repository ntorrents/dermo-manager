import React, { useState } from "react";
import {
	Mail,
	Lock,
	Loader2,
	Eye,
	EyeOff,
	LayoutDashboard,
	ArrowRight,
} from "lucide-react";
import { login, signInWithGoogle } from "../../services/auth"; // Importamos Google

export const LoginScreen = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState(null);

	const handleLogin = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			await login(email, password);
		} catch (error) {
			console.error(error);
			setError("Credenciales incorrectas. Inténtalo de nuevo.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		try {
			setLoading(true);
			await signInWithGoogle();
		} catch (error) {
			console.error("Error Google:", error);
			setError("Error al iniciar con Google");
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
			<div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-300">
				{/* Logo / Header */}
				<div className="text-center mb-10">
					<div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200 transform rotate-3">
						<LayoutDashboard className="text-white" size={32} />
					</div>
					<h1 className="text-3xl font-black text-gray-800 tracking-tight">
						DermoManager
					</h1>
					<p className="text-gray-400 font-medium text-sm mt-2">
						Gestión inteligente para tu centro
					</p>
				</div>

				{/* Formulario Email */}
				<form onSubmit={handleLogin} className="space-y-5">
					<div className="space-y-1">
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">
							Email Corporativo
						</label>
						<div className="relative group">
							<Mail
								className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-rose-500 transition-colors"
								size={20}
							/>
							<input
								type="email"
								required
								className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all placeholder:text-gray-300"
								placeholder="nombre@empresa.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-1">
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">
							Contraseña
						</label>
						<div className="relative group">
							<Lock
								className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-rose-500 transition-colors"
								size={20}
							/>
							<input
								type={showPassword ? "text" : "password"}
								required
								className="w-full pl-12 pr-12 p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all placeholder:text-gray-300"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
								{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
							</button>
						</div>
					</div>

					{error && (
						<div className="p-4 bg-red-50 text-red-500 text-sm font-bold rounded-2xl flex items-center gap-2 animate-in shake">
							<span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
							{error}
						</div>
					)}

					<button
						disabled={loading}
						className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group">
						{loading ? (
							<Loader2 className="animate-spin" />
						) : (
							<>
								Iniciar Sesión{" "}
								<ArrowRight
									size={18}
									className="group-hover:translate-x-1 transition-transform"
								/>
							</>
						)}
					</button>
				</form>

				<div className="relative my-8">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-gray-100"></div>
					</div>
					<div className="relative flex justify-center text-sm">
						<span className="px-4 bg-white text-gray-400 font-bold text-xs uppercase tracking-widest">
							O continúa con
						</span>
					</div>
				</div>

				{/* Botón Google */}
				<button
					onClick={handleGoogleLogin}
					disabled={loading}
					className="w-full bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-3">
					<svg className="w-5 h-5" viewBox="0 0 24 24">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Google Workspace
				</button>
			</div>
		</div>
	);
};
