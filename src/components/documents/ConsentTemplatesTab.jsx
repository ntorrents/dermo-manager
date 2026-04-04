import React, { useState, useMemo } from "react";
import { FileText, Plus, Trash2, Edit2, Save, Loader2, Search } from "lucide-react";
import { useTreatments } from "../../hooks/useTreatments";
import { useConsentTemplates } from "../../hooks/useConsentTemplates";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import ConsentEditor from "../consent/ConsentEditor";
import { CONSENT_VARIABLES } from "../../utils/consentGenerator";
import { supabase } from "../../services/supabase";
import { useTenant } from "../../context/TenantContext";

export const ConsentTemplatesTab = ({ user, showToast }) => {
	const { clinicId } = useTenant();
	const [showModal, setShowModal] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({ nombre: "", treatment_id: "", contenido: "" });
	const [searchTerm, setSearchTerm] = useState("");

	const { treatments = [] } = useTreatments(user);
	const { consentTemplates = [], refreshConsentTemplates } = useConsentTemplates(user);

	const filtered = useMemo(() => {
		const q = searchTerm.trim().toLowerCase();
		if (!q) return consentTemplates;
		return consentTemplates.filter((tpl) => {
			const name = (tpl.nombre || "").toLowerCase();
			const tname = (tpl.treatments?.name || "").toLowerCase();
			return name.includes(q) || tname.includes(q);
		});
	}, [consentTemplates, searchTerm]);

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
			const fields = {
				nombre: form.nombre.trim(),
				treatment_id: form.treatment_id?.trim() || null,
				contenido: form.contenido?.trim() || "",
			};

			if (editingId) {
				const { error } = await supabase
					.from("plantillas_consentimiento")
					.update(fields)
					.eq("id", editingId);
				if (error) throw error;
				showToast?.("Plantilla actualizada");
			} else {
				if (!clinicId) {
					showToast?.("No hay clínica activa", "error");
					return;
				}
				const { error } = await supabase.from("plantillas_consentimiento").insert([
					{
						user_id: user.id,
						clinic_id: clinicId,
						...fields,
					},
				]);
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
		<div className="space-y-6 animate-in fade-in">
			<div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
				<div>
					<h2 className="text-xl font-bold text-gray-900">Consentimientos</h2>
					<p className="text-sm text-gray-500 mt-1">
						Plantillas para generar PDF de consentimiento informado desde la ficha del cliente (texto
						reutilizable; el uso clínico y la firma dependen de tu protocolo).
					</p>
				</div>
				<button
					type="button"
					onClick={() => open()}
					className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors shrink-0">
					<Plus size={20} /> Nueva plantilla
				</button>
			</div>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
				<input
					className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-rose-100"
					placeholder="Buscar por nombre de plantilla o tratamiento…"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
			</div>

			{filtered.length === 0 ? (
				<div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
					<FileText className="mx-auto mb-3 size-10 opacity-40 text-rose-400" />
					{consentTemplates.length === 0
						? "No hay plantillas. Crea una para generar consentimientos desde Clientes."
						: "Ninguna plantilla coincide con la búsqueda."}
				</div>
			) : (
				<div className="space-y-3">
					{filtered.map((tpl) => (
						<div
							key={tpl.id}
							className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="font-bold text-gray-800">{tpl.nombre}</p>
								<p className="text-xs text-gray-500 mt-0.5">
									{tpl.treatments?.name ? `Tratamiento: ${tpl.treatments.name}` : "Plantilla genérica"}
								</p>
							</div>
							<div className="flex gap-2 shrink-0">
								<button
									type="button"
									onClick={() => open(tpl)}
									className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold">
									<Edit2 size={16} /> Editar
								</button>
								<button
									type="button"
									onClick={() => remove(tpl.id)}
									className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-bold">
									<Trash2 size={16} /> Eliminar
								</button>
							</div>
						</div>
					))}
				</div>
			)}

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
