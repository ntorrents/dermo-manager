import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
	CalendarDays,
	Users,
	BarChart3,
	Sparkles,
	DollarSign,
	Settings,
	ArrowRight,
	Clock,
	Sun,
	Moon,
	Sunrise,
} from "lucide-react";

const QUICK_LINKS = [
	{
		id: "agenda",
		label: "Agenda",
		description: "Citas y recordatorios",
		path: "/agenda",
		icon: CalendarDays,
		color: "text-blue-600",
		bg: "bg-blue-50",
		hoverBg: "hover:bg-blue-100",
		borderColor: "border-blue-100",
	},
	{
		id: "clients",
		label: "Clientes",
		description: "Ficha y historial",
		path: "/clientes",
		icon: Users,
		color: "text-violet-600",
		bg: "bg-violet-50",
		hoverBg: "hover:bg-violet-100",
		borderColor: "border-violet-100",
	},
	{
		id: "dashboard",
		label: "Dashboard",
		description: "Indicadores y widgets",
		path: "/dashboard",
		icon: BarChart3,
		color: "text-rose-600",
		bg: "bg-rose-50",
		hoverBg: "hover:bg-rose-100",
		borderColor: "border-rose-100",
	},
	{
		id: "treatments",
		label: "Tratamientos",
		description: "Servicios y sesiones",
		path: "/tratamientos",
		icon: Sparkles,
		color: "text-amber-600",
		bg: "bg-amber-50",
		hoverBg: "hover:bg-amber-100",
		borderColor: "border-amber-100",
	},
	{
		id: "finance",
		label: "Movimientos",
		description: "Ingresos y gastos",
		path: "/finanzas/movimientos",
		icon: DollarSign,
		color: "text-emerald-600",
		bg: "bg-emerald-50",
		hoverBg: "hover:bg-emerald-100",
		borderColor: "border-emerald-100",
	},
	{
		id: "settings",
		label: "Configuración",
		description: "Clínica y perfil",
		path: "/configuracion",
		icon: Settings,
		color: "text-slate-600",
		bg: "bg-slate-50",
		hoverBg: "hover:bg-slate-100",
		borderColor: "border-slate-100",
	},
];

function getGreetingIcon() {
	const hour = new Date().getHours();
	if (hour >= 6 && hour < 13) return Sunrise;
	if (hour >= 13 && hour < 20) return Sun;
	return Moon;
}

function getGreetingText() {
	const hour = new Date().getHours();
	if (hour >= 6 && hour < 13) return "Buenos días";
	if (hour >= 13 && hour < 20) return "Buenas tardes";
	return "Buenas noches";
}

function formatTodayDate() {
	const d = new Date();
	return d.toLocaleDateString("es-ES", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export const HomeTab = ({ userName, appointments = [], clients = [] }) => {
	const greeting = getGreetingText();
	const GreetingIcon = getGreetingIcon();
	const todayFormatted = formatTodayDate();

	const todayYmd = new Date().toISOString().slice(0, 10);

	const todayAppointments = useMemo(
		() =>
			(appointments || [])
				.filter((a) => {
					if (a.type === "tax_deadline" || a.type === "task") return false;
					if (a.status === "cancelled") return false;
					const day = a.start_at ? String(a.start_at).slice(0, 10) : "";
					return day === todayYmd;
				})
				.sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
		[appointments, todayYmd],
	);

	const activeClientsCount = useMemo(
		() => (clients || []).filter((c) => c.activo !== false).length,
		[clients],
	);

	return (
		<div className="animate-in fade-in pb-20 md:pb-0 flex flex-col items-center justify-center min-h-[calc(100dvh-12rem)]">
			{/* Saludo principal */}
			<div className="text-center mb-10 space-y-3">
				<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold tracking-wide uppercase mb-2">
					<GreetingIcon size={14} />
					<span>{greeting}</span>
				</div>
				<h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
					Hola, <span className="text-rose-700">{userName || "usuario"}</span>
				</h1>
				<p className="text-gray-400 text-sm font-medium capitalize">
					{todayFormatted}
				</p>
			</div>

			{/* Mini resumen del día */}
			{(todayAppointments.length > 0 || activeClientsCount > 0) && (
				<div className="flex items-center justify-center gap-6 mb-10 text-sm text-gray-500">
					{todayAppointments.length > 0 && (
						<div className="flex items-center gap-2">
							<Clock size={15} className="text-blue-500" />
							<span>
								<span className="font-bold text-gray-800">
									{todayAppointments.length}
								</span>{" "}
								{todayAppointments.length === 1 ? "cita hoy" : "citas hoy"}
							</span>
						</div>
					)}
					<div className="flex items-center gap-2">
						<Users size={15} className="text-violet-500" />
						<span>
							<span className="font-bold text-gray-800">
								{activeClientsCount}
							</span>{" "}
							clientes activos
						</span>
					</div>
				</div>
			)}

			{/* Enlaces rápidos */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl">
				{QUICK_LINKS.map((link) => (
					<Link
						key={link.id}
						to={link.path}
						className={`group flex flex-col items-center gap-2.5 p-5 rounded-2xl border ${link.borderColor} ${link.bg} ${link.hoverBg} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
					>
						<div
							className={`p-2.5 rounded-xl bg-white/70 shadow-sm ${link.color}`}
						>
							<link.icon size={22} strokeWidth={1.8} />
						</div>
						<div className="text-center">
							<p className="text-sm font-bold text-gray-800">{link.label}</p>
							<p className="text-[11px] text-gray-500 font-medium mt-0.5">
								{link.description}
							</p>
						</div>
						<ArrowRight
							size={14}
							className="text-gray-300 group-hover:text-gray-500 transition-colors"
						/>
					</Link>
				))}
			</div>
		</div>
	);
};
