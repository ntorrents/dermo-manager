import React, { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "../../../services/supabase";
import { useTenant } from "../../../context/TenantContext";
import { useAuth } from "../../../context/AuthContext";
import { useClients } from "../../../hooks/useClients";
import { EmailRichEditor } from "../EmailRichEditor";
import { EmailPreview } from "../shared/EmailPreview";
import { EMAIL_TEMPLATE_VARS } from "../../../utils/emailBranding";

const KINDS = [
	{ value: "email_campaign", label: "Campaña" },
	{ value: "email_followup", label: "Seguimiento" },
	{ value: "email_reminder", label: "Recordatorio" },
];

const emptyForm = () => ({
	id: null,
	name: "",
	subject: "",
	body_html: "",
	kind: "email_campaign",
});

export const TemplatesView = ({ showToast }) => {
	const { user } = useAuth();
	const { clinicId, clinicName } = useTenant();
	const { clients } = useClients(user);
	const [templates, setTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState(emptyForm);

	const sampleName = useMemo(() => {
		const c = (clients || []).find((x) => x.email);
		return c ? [c.name, c.surname].filter(Boolean).join(" ") : "Cliente";
	}, [clients]);

	const clinicTemplates = useMemo(
		() => (templates || []).filter((t) => t.clinic_id === clinicId),
		[templates, clinicId],
	);
	const globalTemplates = useMemo(
		() =>
			(templates || []).filter(
				(t) =>
					!t.clinic_id &&
					["email_reminder", "email_followup", "email_campaign"].includes(t.kind),
			),
		[templates],
	);

	const load = async () => {
		if (!clinicId) return;
		setLoading(true);
		const { data } = await supabase
			.from("marketing_templates")
			.select("*")
			.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
			.order("name");
		setTemplates(data || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, [clinicId]);

	const startNew = () => setForm(emptyForm());

	const editLocal = (t) => {
		setForm({
			id: t.id,
			name: t.name || "",
			subject: t.subject || "",
			body_html: t.body_html || "",
			kind: t.kind || "email_campaign",
		});
	};

	const insertVar = (key) => {
		setForm((prev) => ({
			...prev,
			body_html: `${prev.body_html || ""}{{${key}}}`,
		}));
	};

	const cloneTemplate = async (id) => {
		setBusy(true);
		const { data, error } = await supabase.rpc("clone_marketing_template", {
			p_template_id: id,
		});
		setBusy(false);
		if (error) showToast?.(error.message, "error");
		else {
			showToast?.("Plantilla clonada a tu clínica");
			await load();
			if (data) {
				const { data: row } = await supabase
					.from("marketing_templates")
					.select("*")
					.eq("id", data)
					.maybeSingle();
				if (row) editLocal(row);
			}
		}
	};

	const saveTemplate = async () => {
		if (!clinicId || !form.name.trim()) {
			showToast?.("Nombre obligatorio", "error");
			return;
		}
		setBusy(true);
		const payload = {
			clinic_id: clinicId,
			name: form.name.trim(),
			subject: form.subject.trim() || null,
			body_html: form.body_html || "",
			kind: form.kind,
			is_active: true,
			updated_at: new Date().toISOString(),
		};
		const q = form.id
			? supabase.from("marketing_templates").update(payload).eq("id", form.id)
			: supabase
					.from("marketing_templates")
					.insert([{ ...payload, created_by: user?.id }]);
		const { error } = await q;
		setBusy(false);
		if (error) showToast?.(error.message, "error");
		else {
			showToast?.(form.id ? "Plantilla actualizada" : "Plantilla creada");
			setForm(emptyForm());
			await load();
		}
	};

	const deactivate = async (id) => {
		if (!window.confirm("¿Desactivar esta plantilla?")) return;
		setBusy(true);
		const { error } = await supabase
			.from("marketing_templates")
			.update({ is_active: false, updated_at: new Date().toISOString() })
			.eq("id", id)
			.eq("clinic_id", clinicId);
		setBusy(false);
		if (error) showToast?.(error.message, "error");
		else {
			showToast?.("Plantilla desactivada");
			if (form.id === id) setForm(emptyForm());
			await load();
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
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-black text-gray-900">Plantillas</h2>
					<p className="text-sm text-gray-500">
						Crea y gestiona plantillas de tu clínica. Las globales se clonan para
						personalizarlas.
					</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800">
					<Plus size={16} /> Nueva
				</button>
			</div>

			<div className="grid lg:grid-cols-2 gap-6">
				<div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Tipo</span>
						<select
							value={form.kind}
							onChange={(e) => setForm({ ...form, kind: e.target.value })}
							className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold">
							{KINDS.map((k) => (
								<option key={k.value} value={k.value}>
									{k.label}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-gray-500">Nombre</span>
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
						onClick={saveTemplate}
						className="inline-flex items-center gap-2 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
						{form.id ? "Guardar cambios" : "Crear plantilla"}
					</button>
				</div>

				<div className="space-y-4">
					<div className="rounded-2xl border border-gray-100 bg-white p-5">
						<EmailPreview
							bodyHtml={form.body_html}
							clinicName={clinicName}
							sampleName={sampleName}
						/>
					</div>

					<div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
						<p className="text-sm font-black text-gray-900">De tu clínica</p>
						<ul className="space-y-2">
							{clinicTemplates
								.filter((t) => t.is_active !== false)
								.map((t) => (
									<li
										key={t.id}
										className="flex items-center justify-between gap-2 border border-gray-50 rounded-xl px-3 py-2">
										<button
											type="button"
											onClick={() => editLocal(t)}
											className="min-w-0 text-left flex-1">
											<p className="font-semibold text-gray-800 truncate">{t.name}</p>
											<p className="text-[11px] text-gray-400 uppercase">{t.kind}</p>
										</button>
										<button
											type="button"
											disabled={busy}
											onClick={() => deactivate(t.id)}
											className="text-gray-400 hover:text-rose-700 p-1"
											title="Desactivar">
											<Trash2 size={14} />
										</button>
									</li>
								))}
							{clinicTemplates.filter((t) => t.is_active !== false).length === 0 && (
								<li className="text-sm text-gray-400 py-2">
									Ninguna plantilla local aún.
								</li>
							)}
						</ul>
					</div>

					<div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
						<p className="text-sm font-black text-gray-900">Globales (clonar)</p>
						<ul className="space-y-2">
							{globalTemplates.map((t) => (
								<li
									key={t.id}
									className="flex items-center justify-between gap-2 border border-gray-50 rounded-xl px-3 py-2">
									<div className="min-w-0">
										<p className="font-semibold text-gray-800 truncate">{t.name}</p>
										<p className="text-[11px] text-gray-400 uppercase">{t.kind}</p>
									</div>
									<button
										type="button"
										disabled={busy}
										onClick={() => cloneTemplate(t.id)}
										className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
										<Copy size={14} /> Clonar
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
};
