import React from "react";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	Loader2,
	Mail,
	Megaphone,
	Send,
	Zap,
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
		to: "/marketing/automatizaciones",
		label: "Automatizaciones",
		hint: "Pre-sesión, post-sesión, reseña Google…",
		icon: Zap,
		module: "marketing_campaigns",
		altModule: "client_followup",
	},
];

export const MarketingHubView = ({ showToast }) => {
	const { hasModule } = useTenant();
	const [processing, setProcessing] = React.useState(false);

	const visible = LINKS.filter(
		(l) => hasModule(l.module) || (l.altModule && hasModule(l.altModule)),
	);

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
					<h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2">
						<Mail className="text-primary" /> Marketing
					</h2>
					<p className="text-sm text-muted mt-1">
						Campañas selectivas y automatizaciones. Nunca se envía a «todos» sin
						elegir destinatarios.
					</p>
				</div>
				<button
					type="button"
					disabled={processing}
					onClick={runQueue}
					className="inline-flex items-center gap-2 rounded-xl border border-edge px-4 py-2.5 text-sm font-bold text-fg disabled:opacity-50">
					{processing ? (
						<Loader2 size={16} className="animate-spin" />
					) : (
						<Send size={16} />
					)}
					Procesar cola
				</button>
			</div>

			<div className="grid sm:grid-cols-2 gap-3">
				{visible.map((l) => {
					const Icon = l.icon;
					return (
						<Link
							key={l.to}
							to={l.to}
							className="group rounded-2xl border border-edge bg-surface p-5 hover:border-primary/40 hover:shadow-sm transition">
							<div className="flex items-start justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="rounded-xl bg-surface-2 text-fg p-2 border border-edge">
										<Icon size={18} />
									</span>
									<div>
										<p className="font-bold text-fg">{l.label}</p>
										<p className="text-xs text-muted mt-0.5">{l.hint}</p>
									</div>
								</div>
								<ChevronRight
									size={16}
									className="text-muted group-hover:text-primary shrink-0 mt-1"
								/>
							</div>
						</Link>
					);
				})}
			</div>

			{visible.length === 0 && (
				<div className="rounded-2xl border border-warning-border bg-warning-bg p-6 text-fg">
					<p className="font-bold">Sin módulos de marketing activos</p>
					<p className="text-sm mt-1 text-muted">
						Activa campañas o seguimiento en el plan de esta clínica.
					</p>
				</div>
			)}
		</div>
	);
};
