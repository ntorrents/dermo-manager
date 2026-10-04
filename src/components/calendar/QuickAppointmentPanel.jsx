import React, { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarPlus } from "lucide-react";
import { SidePanel } from "../ui/SidePanel";
import { useTenant } from "../../context/TenantContext";
import { supabase } from "../../services/supabase";

const pad = (n) => String(n).padStart(2, "0");

const nextHalfHour = () => {
	const d = new Date();
	d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const addMinutes = (hhmm, mins) => {
	const [h, m] = hhmm.split(":").map(Number);
	const total = h * 60 + m + mins;
	const nh = Math.floor(total / 60) % 24;
	const nm = total % 60;
	return `${pad(nh)}:${pad(nm)}`;
};

const todayISO = () => {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Cita rápida en SidePanel con Smart Defaults (hoy, próxima media hora, 45′, confirmada).
 */
export const QuickAppointmentPanel = ({
	isOpen,
	onClose,
	user,
	clients = [],
	treatments = [],
	showToast,
	onSaved,
	initialClientId = "",
}) => {
	const { clinicId } = useTenant();
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({
		title: "",
		date: todayISO(),
		startTime: nextHalfHour(),
		durationMin: 45,
		status: "confirmed",
		clientId: "",
		treatmentId: "",
		notes: "",
	});

	useEffect(() => {
		if (!isOpen) return;
		setForm({
			title: "",
			date: todayISO(),
			startTime: nextHalfHour(),
			durationMin: 45,
			status: "confirmed",
			clientId: initialClientId || "",
			treatmentId: "",
			notes: "",
		});
	}, [isOpen, initialClientId]);

	const clientsActive = useMemo(
		() => (clients || []).filter((c) => c.activo !== false),
		[clients],
	);

	const selectedClient = clientsActive.find((c) => c.id === form.clientId);
	const selectedTreatment = (treatments || []).find((t) => t.id === form.treatmentId);
	const endTime = addMinutes(form.startTime, Number(form.durationMin) || 45);

	const titlePreview =
		form.title.trim() ||
		selectedTreatment?.name ||
		(selectedClient
			? `Cita · ${[selectedClient.name, selectedClient.surname].filter(Boolean).join(" ")}`
			: "Cita");

	const save = async () => {
		if (!clinicId || !user?.id) {
			showToast?.("No hay clínica activa", "error");
			return;
		}
		setSaving(true);
		try {
			const startAt = new Date(`${form.date}T${form.startTime}`);
			const endAt = new Date(`${form.date}T${endTime}`);
			const { error } = await supabase.from("appointments").insert([
				{
					user_id: user.id,
					clinic_id: clinicId,
					title: titlePreview,
					start_at: startAt.toISOString(),
					end_at: endAt.toISOString(),
					type: "appointment",
					all_day: false,
					status: form.status || "confirmed",
					client_id: form.clientId || null,
					treatment_id: form.treatmentId || null,
					notes: form.notes.trim() || null,
					activo: true,
				},
			]);
			if (error) throw error;
			showToast?.("Cita creada");
			onSaved?.();
			onClose?.();
		} catch (e) {
			console.error(e);
			showToast?.(e.message || "Error al crear cita", "error");
		} finally {
			setSaving(false);
		}
	};

	return (
		<SidePanel
			isOpen={isOpen}
			onClose={onClose}
			title="Nueva cita rápida"
			subtitle="Campos pre-rellenados · puedes ajustar en un momento"
			size="md"
			footer={
				<div className="flex gap-2 justify-end">
					<button type="button" onClick={onClose} className="btn-ghost">
						Cancelar
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={save}
						className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
						{saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
						Crear cita
					</button>
				</div>
			}>
			<div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
				<section className="space-y-3">
					<p className="erp-label">Esencial</p>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Cliente</span>
						<select
							value={form.clientId}
							onChange={(e) => setForm({ ...form, clientId: e.target.value })}
							className="input-field">
							<option value="">— Sin asignar —</option>
							{clientsActive.map((c) => (
								<option key={c.id} value={c.id}>
									{[c.name, c.surname].filter(Boolean).join(" ")}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Tratamiento (opcional)</span>
						<select
							value={form.treatmentId}
							onChange={(e) => {
								const id = e.target.value;
								const t = (treatments || []).find((x) => x.id === id);
								setForm({
									...form,
									treatmentId: id,
									durationMin: t?.duration_minutes || form.durationMin,
									title: form.title || t?.name || "",
								});
							}}
							className="input-field">
							<option value="">— Elegir —</option>
							{(treatments || []).map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Título</span>
						<input
							value={form.title}
							onChange={(e) => setForm({ ...form, title: e.target.value })}
							placeholder={titlePreview}
							className="input-field"
						/>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Fecha</span>
							<input
								type="date"
								value={form.date}
								onChange={(e) => setForm({ ...form, date: e.target.value })}
								className="input-field"
							/>
						</label>
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Hora inicio</span>
							<input
								type="time"
								value={form.startTime}
								onChange={(e) => setForm({ ...form, startTime: e.target.value })}
								className="input-field"
							/>
						</label>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Duración</span>
							<select
								value={form.durationMin}
								onChange={(e) =>
									setForm({ ...form, durationMin: Number(e.target.value) })
								}
								className="input-field">
								{[30, 45, 60, 90, 120].map((m) => (
									<option key={m} value={m}>
										{m} min
									</option>
								))}
							</select>
						</label>
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">Estado</span>
							<select
								value={form.status}
								onChange={(e) => setForm({ ...form, status: e.target.value })}
								className="input-field">
								<option value="confirmed">Confirmada</option>
								<option value="pending">Pendiente</option>
								<option value="cancelled">Cancelada</option>
							</select>
						</label>
					</div>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Notas</span>
						<textarea
							rows={2}
							value={form.notes}
							onChange={(e) => setForm({ ...form, notes: e.target.value })}
							className="input-field resize-none"
						/>
					</label>
				</section>

				<aside className="rounded-2xl border border-edge bg-surface-2 p-4 space-y-3 h-fit">
					<p className="erp-label">Vista previa</p>
					<p className="font-bold text-fg text-base leading-snug">{titlePreview}</p>
					<p className="text-sm text-muted">
						{form.date} · {form.startTime} – {endTime}
					</p>
					{selectedClient ? (
						<div className="rounded-xl border border-edge bg-surface p-3 space-y-1">
							<p className="text-xs font-bold text-muted uppercase tracking-wide">
								Cliente
							</p>
							<p className="text-sm font-semibold text-fg">
								{[selectedClient.name, selectedClient.surname].filter(Boolean).join(" ")}
							</p>
							{selectedClient.mobile && (
								<p className="text-xs text-muted">Tel. {selectedClient.mobile}</p>
							)}
							{selectedClient.estado && (
								<p className="text-xs text-muted">Estado: {selectedClient.estado}</p>
							)}
						</div>
					) : (
						<p className="text-xs text-muted">
							Elige un cliente para ver su ficha resumida aquí (sin abrir el perfil).
						</p>
					)}
					{selectedTreatment && (
						<p className="text-xs text-muted">
							Tratamiento: <strong className="text-fg">{selectedTreatment.name}</strong>
							{selectedTreatment.price != null &&
								` · ${Number(selectedTreatment.price).toFixed(2)} €`}
						</p>
					)}
				</aside>
			</div>
		</SidePanel>
	);
};
