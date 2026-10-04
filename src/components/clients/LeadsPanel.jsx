import React, { useMemo, useState } from "react";
import {
	Loader2,
	MessageCircle,
	Phone,
	Sparkles,
	UserCheck,
	Users,
} from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { StatusChip } from "../ui/StatusChip";

function buildWhatsAppUrl(phone, firstName, clinicName = "la clínica") {
	if (!phone || !String(phone).trim()) return null;
	const digits = String(phone).replace(/\D/g, "");
	if (!digits) return null;
	const num = digits.startsWith("34") ? digits : `34${digits}`;
	const msg = `Hola ${firstName || ""}, te escribo desde ${clinicName}. Vi tu consulta y me encantaría ayudarte. ¿Cuándo te viene bien hablar?`;
	return `https://wa.me/${num}?text=${encodeURIComponent(msg.trim())}`;
}

function formatEnteredAt(lead) {
	const raw = lead.lead_entered_at || lead.created_at;
	if (!raw) return "—";
	try {
		return new Date(raw).toLocaleDateString("es-ES", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	} catch {
		return "—";
	}
}

/**
 * Tabla de leads / potenciales (Contactar + Convertir a paciente).
 */
export const LeadsPanel = ({
	leads = [],
	loading = false,
	clinicName,
	onConvert,
	convertingId = null,
	searchTerm = "",
}) => {
	const filtered = useMemo(() => {
		const q = searchTerm.toLowerCase().trim();
		const list = [...(leads || [])].sort((a, b) => {
			const da = new Date(a.lead_entered_at || a.created_at || 0).getTime();
			const db = new Date(b.lead_entered_at || b.created_at || 0).getTime();
			return db - da;
		});
		if (!q) return list;
		return list.filter((l) => {
			const name = [l.name, l.surname].filter(Boolean).join(" ").toLowerCase();
			return (
				name.includes(q) ||
				String(l.phone || "").includes(searchTerm) ||
				String(l.lead_interest || "")
					.toLowerCase()
					.includes(q)
			);
		});
	}, [leads, searchTerm]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<Loader2 className="animate-spin text-primary" size={28} />
			</div>
		);
	}

	if (filtered.length === 0) {
		return (
			<div className="flex-1 bg-surface border border-edge rounded-2xl p-8">
				<EmptyState
					icon={Sparkles}
					title={searchTerm ? "Sin resultados" : "Sin leads aún"}
					description={
						searchTerm
							? "Prueba con otro término"
							: "Los contactos del formulario web o webhook aparecerán aquí. También puedes crearlos como lead."
					}
				/>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-surface border border-edge rounded-2xl">
			<table className="w-full text-left border-collapse min-w-[720px]">
				<thead className="sticky top-0 z-10">
					<tr className="bg-surface-2 border-b border-edge text-[11px] font-semibold text-muted uppercase tracking-wider">
						<th className="p-3.5 pl-5">Nombre</th>
						<th className="p-3.5">Tratamiento de interés</th>
						<th className="p-3.5">Fecha de entrada</th>
						<th className="p-3.5 text-right pr-5">Acciones</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-edge">
					{filtered.map((lead) => {
						const fullName = [lead.name, lead.surname].filter(Boolean).join(" ");
						const wa = buildWhatsAppUrl(lead.phone, lead.name, clinicName);
						const busy = convertingId === lead.id;
						return (
							<tr key={lead.id} className="hover:bg-surface-2/60 transition-colors">
								<td className="p-3.5 pl-5">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-fg truncate">
											{fullName || "Sin nombre"}
										</p>
										<p className="text-xs text-muted tabular-nums truncate flex items-center gap-1 mt-0.5">
											<Phone size={11} />
											{lead.phone || "Sin teléfono"}
										</p>
										{lead.lead_source && (
											<div className="mt-1">
												<StatusChip tone="neutral" className="normal-case tracking-normal">
													{lead.lead_source}
												</StatusChip>
											</div>
										)}
									</div>
								</td>
								<td className="p-3.5">
									<p className="text-sm text-fg">
										{lead.lead_interest?.trim() || "—"}
									</p>
									{lead.lead_message?.trim() && (
										<p className="text-xs text-muted mt-0.5 line-clamp-2 max-w-xs">
											{lead.lead_message}
										</p>
									)}
								</td>
								<td className="p-3.5 text-sm text-muted tabular-nums whitespace-nowrap">
									{formatEnteredAt(lead)}
								</td>
								<td className="p-3.5 pr-5">
									<div className="flex items-center justify-end gap-2">
										{wa ? (
											<a
												href={wa}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2 text-xs font-semibold text-fg hover:bg-surface-2"
												onClick={(e) => e.stopPropagation()}>
												<MessageCircle size={14} />
												Contactar
											</a>
										) : (
											<span
												className="inline-flex items-center gap-1.5 rounded-xl border border-edge px-3 py-2 text-xs font-semibold text-muted opacity-50"
												title="Sin teléfono">
												<MessageCircle size={14} />
												Contactar
											</span>
										)}
										<button
											type="button"
											disabled={busy}
											onClick={() => onConvert?.(lead)}
											className="inline-flex items-center gap-1.5 rounded-xl btn-inverse px-3 py-2 text-xs font-semibold disabled:opacity-50">
											{busy ? (
												<Loader2 size={14} className="animate-spin" />
											) : (
												<UserCheck size={14} />
											)}
											Convertir a Paciente
										</button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

/** Modal mínimo para alta manual de lead */
export const NewLeadForm = ({ onSubmit, onCancel, saving = false }) => {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [interest, setInterest] = useState("");
	const [message, setMessage] = useState("");

	const canSave = name.trim().length > 0 && !saving;

	return (
		<div className="rounded-2xl border border-edge bg-surface p-4 space-y-3">
			<p className="text-sm font-semibold text-fg flex items-center gap-2">
				<Users size={16} /> Nuevo lead
			</p>
			<div className="grid sm:grid-cols-2 gap-3">
				<label className="block space-y-1">
					<span className="text-xs font-bold text-muted">Nombre *</span>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="input-field"
						placeholder="Nombre"
						autoFocus
					/>
				</label>
				<label className="block space-y-1">
					<span className="text-xs font-bold text-muted">Teléfono</span>
					<input
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						className="input-field"
						placeholder="600…"
					/>
				</label>
			</div>
			<label className="block space-y-1">
				<span className="text-xs font-bold text-muted">Tratamiento de interés</span>
				<input
					value={interest}
					onChange={(e) => setInterest(e.target.value)}
					className="input-field"
					placeholder="Ej. Bioestimulación, limpieza…"
				/>
			</label>
			<label className="block space-y-1">
				<span className="text-xs font-bold text-muted">Mensaje</span>
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					className="input-field min-h-[4rem] resize-y"
					placeholder="Notas del contacto…"
				/>
			</label>
			<div className="flex justify-end gap-2 pt-1">
				<button type="button" onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
					Cancelar
				</button>
				<button
					type="button"
					disabled={!canSave}
					onClick={() =>
						onSubmit?.({
							name: name.trim(),
							phone: phone.trim() || null,
							lead_interest: interest.trim() || null,
							lead_message: message.trim() || null,
						})
					}
					className="btn-inverse px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50">
					{saving ? <Loader2 size={14} className="animate-spin" /> : null}
					Guardar lead
				</button>
			</div>
		</div>
	);
};
