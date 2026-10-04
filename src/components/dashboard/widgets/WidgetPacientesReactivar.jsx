import React, { useMemo } from "react";
import { MessageCircle, UserRound } from "lucide-react";
import { toLocalYmd } from "../../../utils/dateUtils";

const DAYS_INACTIVE = 60;

function buildWhatsAppUrl(phone, firstName, companyName = "la clínica") {
	if (!phone || !String(phone).trim()) return null;
	const digits = String(phone).replace(/\D/g, "");
	if (!digits) return null;
	const num = digits.startsWith("34") ? digits : `34${digits}`;
	const msg = `Hola ${firstName || ""}, te escribo desde ${companyName}. ¿Cómo estás? Nos encantaría verte de nuevo en la clínica.`;
	return `https://wa.me/${num}?text=${encodeURIComponent(msg.trim())}`;
}

/**
 * Pacientes sin visita reciente (pérdida de retención accionable).
 */
export const WidgetPacientesReactivar = ({
	clients = [],
	entries = [],
	clinicName,
	onOpenClient,
}) => {
	const toReactivate = useMemo(() => {
		const lastByClient = {};
		for (const e of entries || []) {
			if (e.type !== "income" || !e.client_id || e.activo === false) continue;
			const day = e.date || "";
			if (!day) continue;
			if (!lastByClient[e.client_id] || day > lastByClient[e.client_id]) {
				lastByClient[e.client_id] = day;
			}
		}

		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - DAYS_INACTIVE);
		const cutoffYmd = toLocalYmd(cutoff);

		return (clients || [])
			.filter((c) => c.activo !== false)
			.map((c) => {
				const last = lastByClient[c.id] || null;
				return { client: c, lastVisit: last };
			})
			.filter((row) => row.lastVisit && row.lastVisit <= cutoffYmd)
			.sort((a, b) => (a.lastVisit < b.lastVisit ? -1 : 1))
			.slice(0, 3);
	}, [clients, entries]);

	return (
		<section className="h-full min-h-[240px] rounded-2xl border border-edge bg-surface p-5 shadow-sm flex flex-col">
			<div className="mb-4">
				<p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
					<UserRound size={13} /> Pacientes a reactivar
				</p>
				<p className="text-sm text-muted mt-0.5">
					Sin visita en {DAYS_INACTIVE}+ días
				</p>
			</div>

			{toReactivate.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted text-center px-2">
					Ningún paciente pendiente de reactivar. Buen ritmo.
				</div>
			) : (
				<ul className="space-y-1 flex-1">
					{toReactivate.map(({ client, lastVisit }) => {
						const name = [client.name, client.surname].filter(Boolean).join(" ");
						const wa = buildWhatsAppUrl(client.phone, client.name, clinicName);
						const dateLabel = lastVisit
							? new Date(lastVisit + "T12:00:00").toLocaleDateString("es-ES", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})
							: "—";
						return (
							<li
								key={client.id}
								className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-2 transition-colors">
								<button
									type="button"
									onClick={() => onOpenClient?.(client.id)}
									className="min-w-0 flex-1 text-left">
									<p className="text-sm font-semibold text-fg truncate">
										{name}
									</p>
									<p className="text-[11px] text-muted tabular-nums">
										Última visita · {dateLabel}
									</p>
								</button>
								{wa ? (
									<a
										href={wa}
										target="_blank"
										rel="noopener noreferrer"
										title="Contactar por WhatsApp"
										className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-income-soft text-income border border-edge hover:brightness-110">
										<MessageCircle size={15} />
									</a>
								) : (
									<span
										className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted border border-edge"
										title="Sin teléfono">
										<MessageCircle size={15} />
									</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
};
