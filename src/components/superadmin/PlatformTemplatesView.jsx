import React, { useEffect, useState } from "react";
import { Loader2, Mail, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "../../services/supabase";

const KINDS = [
	{ value: "email_reminder", label: "Email · Recordatorio" },
	{ value: "email_followup", label: "Email · Post-sesión" },
	{ value: "email_campaign", label: "Email · Campaña" },
	{ value: "budget", label: "Presupuesto" },
	{ value: "bonus", label: "Bono" },
];

const emptyForm = () => ({
	id: null,
	kind: "email_followup",
	name: "",
	subject: "",
	body_html: "",
	is_active: true,
});

export const PlatformTemplatesView = () => {
	const [rows, setRows] = useState([]);
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState(null);

	const load = async () => {
		setLoading(true);
		const { data, error } = await supabase
			.from("marketing_templates")
			.select("*")
			.is("clinic_id", null)
			.order("kind")
			.order("name");
		if (error) setMsg(error.message);
		else setRows(data || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, []);

	const save = async () => {
		if (!form.name.trim() || !form.body_html.trim()) {
			setMsg("Nombre y cuerpo son obligatorios");
			return;
		}
		setBusy(true);
		setMsg(null);
		const payload = {
			clinic_id: null,
			kind: form.kind,
			name: form.name.trim(),
			subject: form.subject.trim() || null,
			body_html: form.body_html,
			is_active: form.is_active,
			updated_at: new Date().toISOString(),
		};
		const q = form.id
			? supabase.from("marketing_templates").update(payload).eq("id", form.id)
			: supabase.from("marketing_templates").insert([{ ...payload, created_at: new Date().toISOString() }]);
		const { error } = await q;
		setBusy(false);
		if (error) setMsg(error.message);
		else {
			setMsg("Guardado");
			setForm(emptyForm());
			await load();
		}
	};

	const remove = async (id) => {
		if (!window.confirm("¿Eliminar plantilla maestra?")) return;
		const { error } = await supabase.from("marketing_templates").delete().eq("id", id);
		if (error) setMsg(error.message);
		else {
			if (form.id === id) setForm(emptyForm());
			await load();
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Mail className="text-violet-400" size={26} />
				<div>
					<h2 className="text-xl font-black text-white">Plantillas maestras globales</h2>
					<p className="text-sm text-slate-400">
						Presupuestos, bonos y emails que las clínicas pueden clonar
					</p>
				</div>
			</div>

			{msg && (
				<p className="text-sm rounded-xl px-4 py-3 border border-white/10 bg-white/5 text-slate-200">
					{msg}
				</p>
			)}

			<div className="grid lg:grid-cols-2 gap-6">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-sm font-black text-white">
							{form.id ? "Editar plantilla" : "Nueva plantilla"}
						</p>
						<button
							type="button"
							onClick={() => setForm(emptyForm())}
							className="text-xs font-bold text-violet-300 inline-flex items-center gap-1">
							<Plus size={14} /> Nueva
						</button>
					</div>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-400">Tipo</span>
						<select
							value={form.kind}
							onChange={(e) => setForm({ ...form, kind: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white">
							{KINDS.map((k) => (
								<option key={k.value} value={k.value}>
									{k.label}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-400">Nombre</span>
						<input
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-400">Asunto (emails)</span>
						<input
							value={form.subject || ""}
							onChange={(e) => setForm({ ...form, subject: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-400">
							Cuerpo HTML · vars: {"{{client_name}}"} {"{{clinic_name}}"} {"{{appointment_date}}"}{" "}
							{"{{treatment_name}}"}
						</span>
						<textarea
							value={form.body_html}
							onChange={(e) => setForm({ ...form, body_html: e.target.value })}
							rows={10}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white font-mono"
						/>
					</label>
					<label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
						<span className="text-sm font-semibold text-slate-200">Activa</span>
						<input
							type="checkbox"
							checked={form.is_active}
							onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
							className="accent-violet-500"
						/>
					</label>
					<button
						type="button"
						disabled={busy}
						onClick={save}
						className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
						Guardar
					</button>
				</div>

				<div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
					{loading ? (
						<div className="p-10 flex justify-center">
							<Loader2 className="animate-spin text-violet-400" />
						</div>
					) : (
						<ul className="divide-y divide-white/5">
							{rows.map((t) => (
								<li
									key={t.id}
									className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-white/5">
									<button
										type="button"
										className="text-left min-w-0"
										onClick={() =>
											setForm({
												id: t.id,
												kind: t.kind,
												name: t.name,
												subject: t.subject || "",
												body_html: t.body_html || "",
												is_active: t.is_active !== false,
											})
										}>
										<p className="font-bold text-white truncate">{t.name}</p>
										<p className="text-[11px] text-slate-400 uppercase tracking-wider">
											{t.kind}
											{!t.is_active && " · inactiva"}
										</p>
									</button>
									<button
										type="button"
										onClick={() => remove(t.id)}
										className="p-1.5 text-rose-300 hover:bg-rose-500/10 rounded-lg">
										<Trash2 size={14} />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
};
