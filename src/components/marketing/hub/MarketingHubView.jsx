import React from "react";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	FileText,
	Loader2,
	Mail,
	Megaphone,
	Send,
	UserRound,
} from "lucide-react";
import { useTenant } from "../../../context/TenantContext";
import { processEmailQueue } from "../shared/emailQueue";

const LINKS = [
	{
		to: "/marketing/campanas",
		label: "Campañas",
		hint: "Envío a clientes o emails elegidos",
		icon: Megaphone,
		module: "marketing_campaigns",
	},
	{
		to: "/marketing/seguimiento",
		label: "Seguimiento 1:1",
		hint: "Un correo a un solo paciente",
		icon: UserRound,
		module: "client_followup",
	},
	{
		to: "/marketing/plantillas",
		label: "Plantillas",
		hint: "Crear y editar con previsualización",
		icon: FileText,
		module: "marketing_campaigns",
	},
];

export const MarketingHubView = ({ showToast }) => {
	const { hasModule } = useTenant();
	const [processing, setProcessing] = React.useState(false);

	const visible = LINKS.filter((l) => hasModule(l.module));

	const runQueue = async () => {
		setProcessing(true);
		try {
			const data = await processEmailQueue();
			showToast?.(
				`Cola: ${data?.sent ?? 0} enviados · ${data?.failed ?? 0} fallidos`,
			);
		} catch (e) {
			showToast?.(e.message || "Error al procesar cola", "error");
		} finally {
			setProcessing(false);
		}
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
						<Mail className="text-rose-700" /> Marketing
					</h2>
					<p className="text-sm text-gray-500 mt-1">
						Campañas selectivas, seguimiento individual y plantillas. Nunca se envía
						a «todos» sin elegir destinatarios.
					</p>
				</div>
				<button
					type="button"
					disabled={processing}
					onClick={runQueue}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 disabled:opacity-50">
					{processing ? (
						<Loader2 size={16} className="animate-spin" />
					) : (
						<Send size={16} />
					)}
					Procesar cola
				</button>
			</div>

			<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{visible.map((l) => {
					const Icon = l.icon;
					return (
						<Link
							key={l.to}
							to={l.to}
							className="group rounded-2xl border border-gray-100 bg-white p-5 hover:border-rose-200 hover:shadow-sm transition">
							<div className="flex items-start justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="rounded-xl bg-rose-50 text-rose-700 p-2">
										<Icon size={18} />
									</span>
									<div>
										<p className="font-black text-gray-900">{l.label}</p>
										<p className="text-xs text-gray-500 mt-0.5">{l.hint}</p>
									</div>
								</div>
								<ChevronRight
									size={16}
									className="text-gray-300 group-hover:text-rose-600 shrink-0 mt-1"
								/>
							</div>
						</Link>
					);
				})}
			</div>

			{visible.length === 0 && (
				<div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-amber-900">
					<p className="font-bold">Sin módulos de marketing activos</p>
					<p className="text-sm mt-1">
						Activa campañas o seguimiento en el plan de esta clínica.
					</p>
				</div>
			)}
		</div>
	);
};
