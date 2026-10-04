import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Bell,
	CalendarClock,
	Loader2,
	MessageSquareHeart,
	Pencil,
	Star,
} from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { useAuth } from "../../../context/AuthContext";
import { useClients } from "../../../hooks/useClients";
import {
	AUTOMATION_CHANNELS,
	AUTOMATION_EVENTS,
} from "../../../constants/messageAutomations";
import { EMAIL_TEMPLATE_VARS } from "../../../utils/emailBranding";
import { EmailRichEditor } from "../EmailRichEditor";
import { EmailPreview } from "../shared/EmailPreview";
import { SidePanel } from "../../ui/SidePanel";
import { StatusChip } from "../../ui/StatusChip";

const EVENT_ICONS = {
	pre_session: CalendarClock,
	reminder_24h: Bell,
	post_session: MessageSquareHeart,
	google_review: Star,
};

/**
 * Automatizaciones: tarjetas de eventos con toggle + editar mensaje (SidePanel).
 */
export const AutomationsView = ({ showToast }) => {
	const { user } = useAuth();
	const { clinicId, clinicName } = useTenant();
	const { clients } = useClients(user);
	const [rows, setRows] = useState([]);
	const [templates, setTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busyKey, setBusyKey] = useState(null);
	const [editEvent, setEditEvent] = useState(null);
	const [editForm, setEditForm] = useState({
		subject: "",
		body_html: "",
		channel: "email",
		name: "",
	});
	const [savingEdit, setSavingEdit] = useState(false);

	const sampleName = useMemo(() => {
		const c = (clients || []).find((x) => x.email);
		return c ? [c.name, c.surname].filter(Boolean).join(" ") : "Cliente";
	}, [clients]);

	const rowByKey = useMemo(() => {
		const map = {};
		for (const r of rows) map[r.event_key] = r;
		return map;
	}, [rows]);

	const load = useCallback(async () => {
		if (!clinicId) return;
		setLoading(true);
		const [{ data: autos }, { data: tpls }] = await Promise.all([
			supabase
				.from("clinic_message_automations")
				.select("*")
				.eq("clinic_id", clinicId),
			supabase
				.from("marketing_templates")
				.select("*")
				.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
				.order("name"),
		]);
		setRows(autos || []);
		setTemplates(tpls || []);
		setLoading(false);
	}, [clinicId]);

	useEffect(() => {
		load();
	}, [load]);

	const ensureRow = async (eventKey) => {
		const existing = rowByKey[eventKey];
		if (existing) return existing;
		const { data, error } = await supabase
			.from("clinic_message_automations")
			.insert([
				{
					clinic_id: clinicId,
					event_key: eventKey,
					is_active: false,
					channel: "email",
					template_id: null,
				},
			])
			.select("*")
			.single();
		if (error) {
			await load();
			const { data: again } = await supabase
				.from("clinic_message_automations")
				.select("*")
				.eq("clinic_id", clinicId)
				.eq("event_key", eventKey)
				.maybeSingle();
			if (!again) throw error;
			return again;
		}
		setRows((prev) => [...prev, data]);
		return data;
	};

	const ensureTemplate = async (eventKey, row) => {
		const meta = AUTOMATION_EVENTS.find((e) => e.key === eventKey);
		if (!meta) throw new Error("Evento desconocido");
		if (row?.template_id) {
			const found = templates.find((t) => t.id === row.template_id);
			if (found) return found;
			const { data } = await supabase
				.from("marketing_templates")
				.select("*")
				.eq("id", row.template_id)
				.maybeSingle();
			if (data) return data;
		}
		const { data, error } = await supabase
			.from("marketing_templates")
			.insert([
				{
					clinic_id: clinicId,
					kind: meta.templateKind,
					name: meta.defaultName,
					subject: meta.defaultSubject,
					body_html: `<p>Hola {{nombre_paciente}},</p><p></p><p>Equipo de {{nombre_clinica}}</p>`,
					is_active: true,
					created_by: user?.id,
				},
			])
			.select("*")
			.single();
		if (error) throw error;
		await supabase
			.from("clinic_message_automations")
			.update({
				template_id: data.id,
				updated_at: new Date().toISOString(),
			})
			.eq("id", row.id);
		setTemplates((prev) => [...prev, data]);
		setRows((prev) =>
			prev.map((r) =>
				r.id === row.id ? { ...r, template_id: data.id } : r,
			),
		);
		return data;
	};

	const toggleActive = async (eventKey, next) => {
		if (!clinicId) return;
		setBusyKey(eventKey);
		try {
			const row = await ensureRow(eventKey);
			const { error } = await supabase
				.from("clinic_message_automations")
				.update({
					is_active: next,
					updated_at: new Date().toISOString(),
				})
				.eq("id", row.id);
			if (error) throw error;
			setRows((prev) =>
				prev.map((r) =>
					r.id === row.id ? { ...r, is_active: next } : r,
				),
			);
			showToast?.(next ? "Automatización activada" : "Automatización pausada");
		} catch (e) {
			showToast?.(e.message || "No se pudo actualizar", "error");
		} finally {
			setBusyKey(null);
		}
	};

	const openEdit = async (eventKey) => {
		setBusyKey(eventKey);
		try {
			const row = await ensureRow(eventKey);
			const tpl = await ensureTemplate(eventKey, row);
			const meta = AUTOMATION_EVENTS.find((e) => e.key === eventKey);
			setEditEvent(eventKey);
			setEditForm({
				name: tpl.name || meta?.defaultName || "",
				subject: tpl.subject || meta?.defaultSubject || "",
				body_html: tpl.body_html || "",
				channel: row.channel || "email",
				templateId: tpl.id,
				automationId: row.id,
			});
		} catch (e) {
			showToast?.(e.message || "No se pudo abrir el editor", "error");
		} finally {
			setBusyKey(null);
		}
	};

	const saveEdit = async () => {
		if (!editForm.templateId || !editForm.automationId) return;
		setSavingEdit(true);
		try {
			const [{ error: tErr }, { error: aErr }] = await Promise.all([
				supabase
					.from("marketing_templates")
					.update({
						name: editForm.name.trim() || "Automatización",
						subject: editForm.subject.trim() || null,
						body_html: editForm.body_html || "",
						updated_at: new Date().toISOString(),
					})
					.eq("id", editForm.templateId),
				supabase
					.from("clinic_message_automations")
					.update({
						channel: editForm.channel,
						updated_at: new Date().toISOString(),
					})
					.eq("id", editForm.automationId),
			]);
			if (tErr) throw tErr;
			if (aErr) throw aErr;
			showToast?.("Mensaje guardado");
			setEditEvent(null);
			await load();
		} catch (e) {
			showToast?.(e.message || "Error al guardar", "error");
		} finally {
			setSavingEdit(false);
		}
	};

	if (loading) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div>
				<h2 className="text-xl font-bold text-fg tracking-tight">Automatizaciones</h2>
				<p className="text-sm text-muted mt-1">
					Activa eventos clave y edita el mensaje. El envío por Email/WhatsApp se
					conectará a esta configuración; hoy puedes preparar plantillas y canal.
				</p>
			</div>

			<div className="grid sm:grid-cols-2 gap-4">
				{AUTOMATION_EVENTS.map((ev) => {
					const Icon = EVENT_ICONS[ev.key] || Bell;
					const row = rowByKey[ev.key];
					const active = !!row?.is_active;
					const busy = busyKey === ev.key;
					const channelLabel =
						AUTOMATION_CHANNELS.find((c) => c.value === (row?.channel || "email"))
							?.label || "Email";
					return (
						<article
							key={ev.key}
							className="rounded-2xl border border-edge bg-surface p-5 shadow-sm flex flex-col gap-4">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-start gap-3 min-w-0">
									<div className="h-11 w-11 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center shrink-0 border border-edge">
										<Icon size={20} />
									</div>
									<div className="min-w-0">
										<h3 className="font-bold text-fg">{ev.label}</h3>
										<p className="text-xs text-muted mt-1 leading-snug">
											{ev.hint}
										</p>
									</div>
								</div>
								<StatusChip tone={active ? "success" : "neutral"}>
									{active ? "Activo" : "Inactivo"}
								</StatusChip>
							</div>
							<p className="text-[11px] text-muted">Canal: {channelLabel}</p>
							<div className="mt-auto flex flex-wrap items-center gap-2">
								<label className="inline-flex items-center gap-2 text-sm font-semibold text-fg cursor-pointer">
									<input
										type="checkbox"
										checked={active}
										disabled={busy}
										onChange={(e) => toggleActive(ev.key, e.target.checked)}
										className="w-4 h-4 rounded border-edge text-primary focus:ring-primary/30"
									/>
									{busy ? (
										<Loader2 size={14} className="animate-spin" />
									) : active ? (
										"Activado"
									) : (
										"Activar"
									)}
								</label>
								<button
									type="button"
									disabled={busy}
									onClick={() => openEdit(ev.key)}
									className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2 text-xs font-bold text-fg hover:bg-surface-2 disabled:opacity-50">
									<Pencil size={14} /> Editar mensaje
								</button>
							</div>
						</article>
					);
				})}
			</div>

			<SidePanel
				isOpen={!!editEvent}
				onClose={() => setEditEvent(null)}
				title={
					AUTOMATION_EVENTS.find((e) => e.key === editEvent)?.label ||
					"Editar mensaje"
				}
				subtitle="Plantilla del evento · se abrirá en el canal elegido"
				size="lg"
				footer={
					<button
						type="button"
						disabled={savingEdit}
						onClick={saveEdit}
						className="w-full btn-primary py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50">
						{savingEdit ? <Loader2 size={16} className="animate-spin" /> : null}
						Guardar mensaje
					</button>
				}>
				<div className="space-y-4">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">Canal</span>
						<select
							value={editForm.channel}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, channel: e.target.value }))
							}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg">
							{AUTOMATION_CHANNELS.map((c) => (
								<option key={c.value} value={c.value}>
									{c.label}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">
							Nombre interno
						</span>
						<input
							value={editForm.name}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, name: e.target.value }))
							}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">Asunto</span>
						<input
							value={editForm.subject}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, subject: e.target.value }))
							}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg"
							placeholder="Hola {{nombre_paciente}}"
						/>
					</label>
					<div className="flex flex-wrap gap-1.5">
						{EMAIL_TEMPLATE_VARS.map((v) => (
							<button
								key={v.key}
								type="button"
								onClick={() =>
									setEditForm((p) => ({
										...p,
										body_html: `${p.body_html || ""}{{${v.key}}}`,
									}))
								}
								className="text-[11px] font-bold px-2 py-1 rounded-lg border border-edge text-fg hover:bg-surface-2">
								{`{{${v.key}}}`}
							</button>
						))}
					</div>
					<EmailRichEditor
						value={editForm.body_html}
						onChange={(html) =>
							setEditForm((p) => ({ ...p, body_html: html }))
						}
					/>
					<EmailPreview
						bodyHtml={editForm.body_html}
						clinicName={clinicName}
						sampleName={sampleName}
					/>
				</div>
			</SidePanel>
		</div>
	);
};
