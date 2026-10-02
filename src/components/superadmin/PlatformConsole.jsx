import React, { useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { Building2, LogOut, Mail, ScrollText, Shield, Users, Wrench } from "lucide-react";
import { logout } from "../../services/auth";
import { RouteFallback } from "../layout/RouteFallback";

const SuperadminShell = lazy(() =>
	import("./SuperadminShell").then((m) => ({ default: m.SuperadminShell })),
);

/**
 * Consola de plataforma independiente del ERP de clínica.
 * Solo se monta para JWT app_metadata.role === 'superadmin' (sin impersonar).
 */
export const PlatformConsole = () => {
	const navigate = useNavigate();

	useEffect(() => {
		if (!window.location.pathname.startsWith("/superadmin")) {
			navigate("/superadmin", { replace: true });
		}
	}, [navigate]);

	const linkClass = ({ isActive }) =>
		`px-3 py-1.5 rounded-lg text-xs font-bold ${
			isActive ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/5"
		}`;

	return (
		<div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans antialiased text-sm">
			<header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
					<div className="flex items-center gap-2 min-w-0">
						<Shield className="text-violet-400 shrink-0" size={22} />
						<div className="min-w-0">
							<p className="font-black tracking-tight truncate">Base Clínica · Plataforma</p>
							<p className="text-[10px] uppercase tracking-widest text-violet-300/80">
								Superadmin
							</p>
						</div>
					</div>
					<nav className="hidden md:flex items-center gap-1 flex-wrap justify-end">
						<NavLink to="/superadmin" end className={linkClass}>
							<span className="inline-flex items-center gap-1.5">
								<Building2 size={14} /> Clínicas
							</span>
						</NavLink>
						<NavLink to="/superadmin/users" className={linkClass}>
							<span className="inline-flex items-center gap-1.5">
								<Users size={14} /> Usuarios
							</span>
						</NavLink>
						<NavLink to="/superadmin/logs" className={linkClass}>
							<span className="inline-flex items-center gap-1.5">
								<ScrollText size={14} /> Logs
							</span>
						</NavLink>
						<NavLink to="/superadmin/templates" className={linkClass}>
							<span className="inline-flex items-center gap-1.5">
								<Mail size={14} /> Plantillas
							</span>
						</NavLink>
						<NavLink to="/superadmin/tools" className={linkClass}>
							<span className="inline-flex items-center gap-1.5">
								<Wrench size={14} /> Utilidades
							</span>
						</NavLink>
					</nav>
					<button
						type="button"
						onClick={() => logout()}
						className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5">
						<LogOut size={14} /> Salir
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
				<Suspense fallback={<RouteFallback />}>
					<Routes>
						<Route path="/superadmin" element={<SuperadminShell view="dashboard" />} />
						<Route
							path="/superadmin/clinics/:clinicId"
							element={<SuperadminShell view="clinic" />}
						/>
						<Route path="/superadmin/users" element={<SuperadminShell view="users" />} />
						<Route path="/superadmin/logs" element={<SuperadminShell view="logs" />} />
						<Route
							path="/superadmin/templates"
							element={<SuperadminShell view="templates" />}
						/>
						<Route path="/superadmin/tools" element={<SuperadminShell view="tools" />} />
						<Route path="*" element={<Navigate to="/superadmin" replace />} />
					</Routes>
				</Suspense>
			</main>
		</div>
	);
};
