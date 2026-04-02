import React, { useState } from "react";
import { FileText, Plus, Trash2, Edit2, Save, Loader2 } from "lucide-react";
import { useTreatments } from "../../hooks/useTreatments";
import { useConsentTemplates } from "../../hooks/useConsentTemplates";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import ConsentEditor from "../consent/ConsentEditor";
import { CONSENT_VARIABLES } from "../../utils/consentGenerator";
import { supabase } from "../../services/supabase";

export const ConsentTemplatesTab = ({ user, showToast }) => {
	const [showModal, setShowModal] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({ nombre: "", treatment_id: "", contenido: "" });

	const { treatments = [] } = useTreatments(user);
	const { consentTemplates = [], refreshConsentTemplates } = useConsentTemplates(user);

	const open = (tpl = null) => {
		if (tpl) {
			setEditingId(tpl.id);
			setForm({
				nombre: tpl.nombre || "",
				treatment_id: tpl.treatment_id || "",
				contenido: tpl.contenido || "",
			});
		} else {
			setEditingId(null);
			setForm({ nombre: "", treatment_id: "", contenido: "" });
		}
		setShowModal(true);
	};

	const save = async (e) => {
		e.preventDefault();
		if (!user?.id || !form.nombre?.trim()) {
			showToast?.("Nombre obligatorio", "error");
			return;
		}
		setSaving(true);
		try {
			const payload = {
				user_id: user.id,
				nombre: form.nombre.trim(),
				treatment_id: form.treatment_id?.trim() || null,
				contenido: form.contenido?.trim() || "",
			};

			if (editingId) {
				const { error } = await supabase
					.from("plantillas_consentimiento")
					.update(payload)
					.eq("id", editingId);
				if (error) throw error;
				showToast?.("Plantilla actualizada");
			} else {
				const { error } = await supabase.from("plantillas_consentimiento").insert([payload]);
				if (error) throw error;
				showToast?.("Plantilla creada");
			}

			await refreshConsentTemplates();
			setShowModal(false);
			setEditingId(null);
			setForm({ nombre: "", treatment_id: "", contenido: "" });
		} catch (err) {
			console.error(err);
			showToast?.("Error al guardar plantilla", "error");
		} finally {
			setSaving(false);
		}
	};

	const remove = async (id) => {
		try {
			const { error } = await supabase.from("plantillas_consentimiento").delete().eq("id", id);
			if (error) throw error;
			showToast?.("Plantilla eliminada");
			await refreshConsentTemplates();
		} catch (err) {
			console.error(err);
			showToast?.("Error al eliminar", "error");
		}
	};

	return (
		<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
			<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
				<FileText size={20} className="text-rose-500" /> Plantillas de consentimiento informado
			</h3>
			<p className="text-sm text-gray-500 mb-4">
				Plantillas para generar PDFs desde la ficha del cliente. Puedes escribir con formato (negrita, listas) o
				importar un Word (.docx) con variables tipo {"{{NOMBRE}}"}, {"{{FECHA}}"}, etc.
			</p>

			<div className="space-y-2">
				{consentTemplates.length === 0 ? (
					<div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">
						No hay plantillas. Añade una para poder generar consentimientos desde Clientes.
					</div>
				) : (
					consentTemplates.map((tpl) => (
						<div
							key={tpl.id}
							className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200">
							<div>
								<p className="font-bold text-gray-800">{tpl.nombre}</p>
								<p className="text-xs text-gray-500">
									{tpl.treatments?.name ? `Tratamiento: ${tpl.treatments.name}` : "Genérica"}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => open(tpl)}
									className="p-2 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
									title="Editar">
									<Edit2 size={16} />
								</button>
								<button
									type="button"
									onClick={() => remove(tpl.id)}
									className="p-2 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
									title="Eliminar">
									<Trash2 size={16} />
								</button>
							</div>
						</div>
					))
				)}
			</div>

			<button
				type="button"
				onClick={() => open()}
				className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors">
				<Plus size={18} /> Añadir plantilla
			</button>

			<AdaptiveModal
				isOpen={showModal}
				onClose={() => {
					setShowModal(false);
					setEditingId(null);
					setForm({ nombre: "", treatment_id: "", contenido: "" });
				}}
				title={editingId ? "Editar plantilla" : "Nueva plantilla de consentimiento"}
				maxWidth="max-w-4xl">
				<form onSubmit={save} className="space-y-4">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
							Nombre de la plantilla
						</label>
						<input
							required
							className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
							value={form.nombre}
							onChange={(e) => setForm({ ...form, nombre: e.target.value })}
							placeholder="Ej: Consentimiento depilación láser"
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
							Tratamiento (opcional)
						</label>
						<select
							className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
							value={form.treatment_id}
							onChange={(e) => setForm({ ...form, treatment_id: e.target.value })}>
							<option value="">— Genérica (cualquier tratamiento) —</option>
							{treatments.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
							Contenido (negrita, cursiva, listas; o importa un .docx)
						</label>
						<p className="text-[10px] text-gray-500 mb-2">
							Variables disponibles: {CONSENT_VARIABLES.join(", ")}
						</p>
						<ConsentEditor
							value={form.contenido}
							onChange={(html) => setForm({ ...form, contenido: html })}
							placeholder="Yo, {{NOMBRE}} {{APELLIDOS}}, con DNI {{DNI}}..."
						/>
					</div>
					<div className="flex gap-2 pt-2">
						<button
							type="button"
							onClick={() => setShowModal(false)}
							className="flex-1 py-3 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
							Cancelar
						</button>
						<button
							type="submit"
							disabled={saving || !form.nombre?.trim()}
							className="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2">
							{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
							{saving ? "Guardando..." : "Guardar"}
						</button>
					</div>
				</form>
			</AdaptiveModal>
		</div>
	);
};

