import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { useAuth } from "../../../context/AuthContext";
import { useClients } from "../../../hooks/useClients";
import { EmailRichEditor } from "../EmailRichEditor";
import { EmailPreview } from "../shared/EmailPreview";
import { processEmailQueue } from "../shared/emailQueue";
import { EMAIL_TEMPLATE_VARS } from "../../../utils/emailBranding";

export const FollowUpView = ({ showToast }) => {
	const { user } = useAuth();
	const { clinicId, clinicName } = useTenant();
	const { clients } = useClients(user);
	const [templates, setTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [clientId, setClientId] = useState("");
	const [manualEmail, setManualEmail] = useState("");
	const [subject, setSubject] = useState("");
	const [bodyHtml, setBodyHtml] = useState("");
	const [templateId, setTemplateId] = useState("");

	const clientsWithEmail = useMemo(
		() => (clients || []).filter((c) => c.email && String(c.email).trim()),
		[clients],
	);

	const selectedClient = useMemo(
		() => clientsWithEmail.find((c) => c.id === clientId) || null,
		[clientsWithEmail, clientId],
	);

	const toEmail = (selectedClient?.email || manualEmail || "").trim().toLowerCase();
	const toName = selectedClient
		? [selectedClient.name, selectedClient.surname].filter(Boolean).join(" ")
		: toEmail.split("@")[0] || "Cliente";

	useEffect(() => {
		if (!clinicId) return;
		(async () => {
			setLoading(true);
			const { data } = await supabase
				.from("marketing_templates")
				.select("*")
				.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
				.eq("is_active", true)
				.in("kind", ["email_followup", "email_reminder", "email_campaign"])
				.order("name");
			setTemplates(data || []);
			setLoading(false);
		})();
	}, [clinicId]);

	const applyTemplate = (id) => {
		setTemplateId(id);
		const t = templates.find((x) => x.id === id);
		if (!t) return;
		setSubject(t.subject || "");
		setBodyHtml(t.body_html || "");
	};

	const insertVar = (key) => {
		setBodyHtml((prev) => `${prev || ""}{{${key}}}`);
	};

	const sendOne = async () => {
		if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
			showToast?.("Indica un email válido o un cliente", "error");
			return;
		}
		if (!subject.trim()) {
			showToast?.("Asunto obligatorio", "error");
			return;
		}
		setBusy(true);
		try {
			const { error } = await supabase.rpc("queue_marketing_email", {
				p_to_email: toEmail,
				p_subject: subject.trim(),
				p_body_html: bodyHtml,
				p_client_id: selectedClient?.id || null,
				p_to_name: toName,
				p_variables: {
					nombre_paciente: toName,
					client_name: toName,
				},
			});
			if (error) throw error;
			const result = await processEmailQueue();
			showToast?.(
				`Enviado a ${toEmail}: ${result?.sent ?? 0} ok · ${result?.failed ?? 0} fallidos`,
			);
			setSubject("");
			setBodyHtml("");
			setTemplateId("");
			setManualEmail("");
			setClientId("");
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
				<h2 className="text-xl font-black text-gray-900">Seguimiento 1:1</h2>
				<p className="text-sm text-gray-500">
					Un solo destinatario: elige un paciente o escribe un email suelto.
				</p>
			</div>

			<div className="grid lg:grid-cols-2 gap-6">
				<div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Paciente</span>
						<select
							value={clientId}
							onChange={(e) => {
								setClientId(e.target.value);
								if (e.target.value) setManualEmail("");
							}}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold">
							<option value="">— Elegir cliente —</option>
							{clientsWithEmail.map((c) => (
								<option key={c.id} value={c.id}>
									{[c.name, c.surname].filter(Boolean).join(" ")} · {c.email}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">
							O email suelto (si no es cliente)
						</span>
						<input
							value={manualEmail}
							disabled={!!clientId}
							onChange={(e) => setManualEmail(e.target.value)}
							placeholder="correo@ejemplo.com"
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold disabled:bg-gray-50 disabled:text-gray-400"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Plantilla</span>
						<select
							value={templateId}
							onChange={(e) => applyTemplate(e.target.value)}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold">
							<option value="">— Sin plantilla —</option>
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
									{t.clinic_id ? "" : " (global)"}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Asunto</span>
						<input
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
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
					<EmailRichEditor value={bodyHtml} onChange={setBodyHtml} />
					<button
						type="button"
						disabled={busy}
						onClick={sendOne}
						className="inline-flex items-center gap-2 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
						Enviar a {toEmail || "…"}
					</button>
				</div>

				<div className="rounded-2xl border border-gray-100 bg-white p-5">
					<EmailPreview
						bodyHtml={bodyHtml}
						clinicName={clinicName}
						sampleName={toName}
					/>
				</div>
			</div>
		</div>
	);
};
