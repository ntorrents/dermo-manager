import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { useAuth } from "../../../context/AuthContext";
import { useClients } from "../../../hooks/useClients";
import { EmailRichEditor } from "../EmailRichEditor";
import { EmailPreview } from "../shared/EmailPreview";
import { RecipientPicker } from "../shared/RecipientPicker";
import { parseExtraEmails, processEmailQueue } from "../shared/emailQueue";
import { EMAIL_TEMPLATE_VARS } from "../../../utils/emailBranding";

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
				.limit(40),
		]);
		setTemplates(tpls || []);
		setCampaigns(camps || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, [clinicId]);

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
				<Loader2 className="animate-spin text-rose-700" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-black text-gray-900">Campañas</h2>
				<p className="text-sm text-gray-500">
					Redacta, guarda borrador y elige a quién enviar — nunca a toda la base
					automáticamente.
				</p>
			</div>

			{sendTarget && (
				<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
						<div>
							<p className="text-lg font-black text-gray-900">Elegir destinatarios</p>
							<p className="text-sm text-gray-500 mt-0.5">
								Campaña: <span className="font-semibold">{sendTarget.name}</span>
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
								className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700">
								Cancelar
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={confirmSend}
								className="inline-flex items-center gap-2 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
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

			<div className="grid lg:grid-cols-2 gap-6">
				<div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Plantilla</span>
						<select
							value={form.template_id}
							onChange={(e) => applyTemplate(e.target.value)}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold">
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
						<span className="text-xs font-bold text-gray-500">Nombre interno</span>
						<input
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Asunto</span>
						<input
							value={form.subject}
							onChange={(e) => setForm({ ...form, subject: e.target.value })}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
							placeholder="Hola {{nombre_paciente}}"
						/>
					</label>
					<div className="flex flex-wrap gap-1.5">
						{EMAIL_TEMPLATE_VARS.map((v) => (
							<button
								key={v.key}
								type="button"
								onClick={() => insertVar(v.key)}
								className="text-[11px] font-bold px-2 py-1 rounded-lg bg-violet-50 text-violet-800 hover:bg-violet-100">
								{`{{${v.key}}}`}
							</button>
						))}
					</div>
					<EmailRichEditor
						value={form.body_html}
						onChange={(html) => setForm({ ...form, body_html: html })}
					/>
					<button
						type="button"
						disabled={busy}
						onClick={saveCampaign}
						className="inline-flex items-center gap-2 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
						Guardar borrador
					</button>
				</div>

				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<EmailPreview
						bodyHtml={form.body_html}
						clinicName={clinicName}
						sampleName={sampleName}
					/>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
				<table className="w-full text-sm min-w-[560px]">
					<thead>
						<tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 text-left">
							<th className="px-4 py-3">Campaña</th>
							<th className="px-4 py-3">Asunto</th>
							<th className="px-4 py-3">Estado</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{campaigns.map((c) => (
							<tr key={c.id} className="border-t border-gray-50">
								<td className="px-4 py-3 font-bold text-gray-900">{c.name}</td>
								<td className="px-4 py-3 text-gray-600">{c.subject}</td>
								<td className="px-4 py-3">
									<span className="text-[11px] font-bold uppercase text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
										{c.status}
									</span>
								</td>
								<td className="px-4 py-3 text-right">
									{c.status === "draft" && (
										<button
											type="button"
											disabled={busy}
											onClick={() => openSend(c)}
											className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
											<Send size={14} /> Elegir destinatarios…
										</button>
									)}
								</td>
							</tr>
						))}
						{campaigns.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-gray-400">
									Aún no hay campañas.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};
