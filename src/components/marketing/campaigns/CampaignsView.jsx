import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Send } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { useAuth } from "../../../context/AuthContext";
import { useClients } from "../../../hooks/useClients";
import { EmailRichEditor } from "../EmailRichEditor";
import { EmailPreview } from "../shared/EmailPreview";
import { RecipientPicker } from "../shared/RecipientPicker";
import { parseExtraEmails, processEmailQueue } from "../shared/emailQueue";
import { EMAIL_TEMPLATE_VARS } from "../../../utils/emailBranding";
import { StatusChip, statusToneFromLabel } from "../../ui/StatusChip";
import { SidePanel } from "../../ui/SidePanel";
import { EmptyState } from "../../ui/EmptyState";
import { Megaphone } from "lucide-react";

const emptyForm = () => ({
	name: "",
	subject: "",
	body_html: "",
	template_id: "",
});

export const CampaignsView = ({ showToast }) => {
	const { user } = useAuth();
	const { clinicId, clinicName } = useTenant();
	const { clients } = useClients(user);
	const [templates, setTemplates] = useState([]);
	const [campaigns, setCampaigns] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [editorOpen, setEditorOpen] = useState(false);
	const [sendTarget, setSendTarget] = useState(null);
	const [selectedIds, setSelectedIds] = useState([]);
	const [extraEmails, setExtraEmails] = useState("");

	const sampleName = useMemo(() => {
		const c = (clients || []).find((x) => x.email);
		return c ? [c.name, c.surname].filter(Boolean).join(" ") : "Cliente";
	}, [clients]);

	const load = async () => {
		if (!clinicId) return;
		setLoading(true);
		const [{ data: tpls }, { data: camps }] = await Promise.all([
			supabase
				.from("marketing_templates")
				.select("*")
				.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
				.eq("is_active", true)
				.order("name"),
			supabase
				.from("marketing_campaigns")
				.select("*")
				.eq("clinic_id", clinicId)
				.order("created_at", { ascending: false })
				.limit(80),
		]);
		setTemplates(tpls || []);
		setCampaigns(camps || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, [clinicId]);

	const openNew = () => {
		setForm(emptyForm());
		setEditorOpen(true);
	};

	const applyTemplate = (id) => {
		const t = templates.find((x) => x.id === id);
		if (!t) {
			setForm((p) => ({ ...p, template_id: "" }));
			return;
		}
		setForm({
			name: t.name,
			subject: t.subject || "",
			body_html: t.body_html || "",
			template_id: t.id,
		});
	};

	const insertVar = (key) => {
		setForm((prev) => ({
			...prev,
			body_html: `${prev.body_html || ""}{{${key}}}`,
		}));
	};

	const saveCampaign = async () => {
		if (!clinicId || !form.name.trim() || !form.subject.trim()) {
			showToast?.("Nombre y asunto obligatorios", "error");
			return;
		}
		setBusy(true);
		const { error } = await supabase.from("marketing_campaigns").insert([
			{
				clinic_id: clinicId,
				template_id: form.template_id || null,
				name: form.name.trim(),
				subject: form.subject.trim(),
				body_html: form.body_html,
				status: "draft",
				created_by: user?.id,
			},
		]);
		setBusy(false);
		if (error) showToast?.(error.message, "error");
		else {
			showToast?.("Borrador guardado");
			setForm(emptyForm());
			setEditorOpen(false);
			await load();
		}
	};

	const openSend = (campaign) => {
		setSendTarget(campaign);
		setSelectedIds([]);
		setExtraEmails("");
	};

	const confirmSend = async () => {
		if (!sendTarget) return;
		const extras = parseExtraEmails(extraEmails);
		if (selectedIds.length === 0 && extras.length === 0) {
			showToast?.("Elige al menos un destinatario", "error");
			return;
		}
		setBusy(true);
		try {
			const { data, error } = await supabase.rpc("queue_marketing_campaign", {
				p_campaign_id: sendTarget.id,
				p_client_ids: selectedIds.length ? selectedIds : null,
				p_extra_emails: extras.length ? extras : null,
			});
			if (error) throw error;
			showToast?.(`Encolados ${data ?? 0} correos. Enviando…`);
			setSendTarget(null);
			const result = await processEmailQueue();
			showToast?.(
				`Envío: ${result?.sent ?? 0} ok · ${result?.failed ?? 0} fallidos`,
			);
			await load();
		} catch (e) {
			showToast?.(e.message || "Error al enviar", "error");
		} finally {
			setBusy(false);
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
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold text-fg tracking-tight">Campañas</h2>
					<p className="text-sm text-muted mt-1">
						Borradores y envíos · elige destinatarios, nunca a toda la base
						automáticamente.
					</p>
				</div>
				<button
					type="button"
					onClick={openNew}
					className="btn-inverse inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0">
					<Plus size={16} /> Nueva campaña
				</button>
			</div>

			{sendTarget && (
				<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-lg rounded-2xl bg-surface border border-edge p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
						<div>
							<p className="text-lg font-bold text-fg">Elegir destinatarios</p>
							<p className="text-sm text-muted mt-0.5">
								Campaña: <span className="font-semibold text-fg">{sendTarget.name}</span>
							</p>
						</div>
						<RecipientPicker
							clients={clients}
							selectedIds={selectedIds}
							onChangeIds={setSelectedIds}
							extraEmails={extraEmails}
							onChangeExtra={setExtraEmails}
						/>
						<div className="flex flex-wrap gap-2 justify-end pt-2">
							<button
								type="button"
								disabled={busy}
								onClick={() => setSendTarget(null)}
								className="rounded-xl border border-edge px-4 py-2.5 text-sm font-bold text-fg">
								Cancelar
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={confirmSend}
								className="inline-flex items-center gap-2 rounded-xl btn-inverse px-4 py-2.5 text-sm font-bold disabled:opacity-50">
								{busy ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Send size={16} />
								)}
								Encolar y enviar
							</button>
						</div>
					</div>
				</div>
			)}

			{campaigns.length === 0 ? (
				<div className="rounded-2xl border border-edge bg-surface p-8">
					<EmptyState
						icon={Megaphone}
						title="Aún no hay campañas"
						description="Crea un borrador y elige a quién enviarlo cuando esté listo."
						actionLabel="Nueva campaña"
						onAction={openNew}
					/>
				</div>
			) : (
				<div className="rounded-2xl border border-edge bg-surface overflow-x-auto">
					<table className="w-full text-sm min-w-[640px]">
						<thead>
							<tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted text-left bg-surface-2">
								<th className="px-4 py-3">Campaña</th>
								<th className="px-4 py-3">Asunto</th>
								<th className="px-4 py-3">Estado</th>
								<th className="px-4 py-3">Fecha</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody className="divide-y divide-edge">
							{campaigns.map((c) => (
								<tr key={c.id} className="hover:bg-surface-2/50">
									<td className="px-4 py-3 font-semibold text-fg">{c.name}</td>
									<td className="px-4 py-3 text-muted">{c.subject}</td>
									<td className="px-4 py-3">
										<StatusChip tone={statusToneFromLabel(c.status)}>
											{c.status}
										</StatusChip>
									</td>
									<td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">
										{c.sent_at || c.created_at
											? new Date(c.sent_at || c.created_at).toLocaleDateString(
													"es-ES",
													{ day: "numeric", month: "short", year: "numeric" },
												)
											: "—"}
									</td>
									<td className="px-4 py-3 text-right">
										{c.status === "draft" && (
											<button
												type="button"
												disabled={busy}
												onClick={() => openSend(c)}
												className="inline-flex items-center gap-1 text-xs font-bold text-primary">
												<Send size={14} /> Enviar…
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<SidePanel
				isOpen={editorOpen}
				onClose={() => setEditorOpen(false)}
				title="Nueva campaña"
				subtitle="Redacta el mensaje · guardará como borrador"
				size="lg"
				footer={
					<button
						type="button"
						disabled={busy}
						onClick={saveCampaign}
						className="w-full btn-primary py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
						Guardar borrador
					</button>
				}>
				<div className="space-y-4">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">Plantilla</span>
						<select
							value={form.template_id}
							onChange={(e) => applyTemplate(e.target.value)}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg">
							<option value="">— Sin plantilla —</option>
							{(templates || []).map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
									{t.clinic_id ? "" : " (global)"}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">
							Nombre interno
						</span>
						<input
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted uppercase">Asunto</span>
						<input
							value={form.subject}
							onChange={(e) => setForm({ ...form, subject: e.target.value })}
							className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-semibold bg-surface text-fg"
							placeholder="Hola {{nombre_paciente}}"
						/>
					</label>
					<div className="flex flex-wrap gap-1.5">
						{EMAIL_TEMPLATE_VARS.map((v) => (
							<button
								key={v.key}
								type="button"
								onClick={() => insertVar(v.key)}
								className="text-[11px] font-bold px-2 py-1 rounded-lg border border-edge text-fg hover:bg-surface-2">
								{`{{${v.key}}}`}
							</button>
						))}
					</div>
					<EmailRichEditor
						value={form.body_html}
						onChange={(html) => setForm({ ...form, body_html: html })}
					/>
					<EmailPreview
						bodyHtml={form.body_html}
						clinicName={clinicName}
						sampleName={sampleName}
					/>
				</div>
			</SidePanel>
		</div>
	);
};
