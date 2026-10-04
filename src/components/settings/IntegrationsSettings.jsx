import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	CalendarDays,
	Globe,
	Loader2,
	RefreshCw,
	Unplug,
	MessageCircle,
	CreditCard,
	Bell,
	Sparkles,
	Copy,
	Save,
	UserPlus,
	KeyRound,
	Link2,
	HelpCircle,
	Eye,
	EyeOff,
	Shuffle,
	Webhook,
	ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
	startGoogleCalendarLink,
	syncGoogleCalendar,
	disconnectGoogleCalendar,
	fetchGoogleCalendarLinkStatus,
} from "../../services/googleCalendar";
import { supabase } from "../../services/supabase";
import { SidePanel } from "../ui/SidePanel";
import { StatusChip } from "../ui/StatusChip";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import {
	AUTOMATION_CHANNELS,
	AUTOMATION_EVENTS,
} from "../../constants/messageAutomations";

function generateWebhookSecret() {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildLeadsWebhookUrl(clinicId) {
	const base = (
		import.meta.env.VITE_SUPABASE_URL ||
		import.meta.env.VITE_BBDD_PRE ||
		import.meta.env.VITE_BBDD_PRO ||
		""
	).replace(/\/$/, "");
	if (!base || !clinicId) return "";
	return `${base}/functions/v1/webhook-leads?clinic_id=${encodeURIComponent(clinicId)}`;
}

const DOMAIN_STATUS_LABEL = {
	not_configured: "Sin configurar",
	pending: "Pendiente DNS",
	verified: "Verificado",
	failed: "Error",
};

function domainStatusTone(status) {
	if (status === "verified") return "success";
	if (status === "pending") return "warning";
	if (status === "failed") return "danger";
	return "neutral";
}

/**
 * Catálogo de integraciones (Configuración → Integraciones).
 */
export function IntegrationsSettings({
	user,
	clinic,
	clinicId,
	clinicForm,
	setClinicForm,
	isAdmin,
	hasCustomDomainModule,
	hasWebLeadsModule = false,
	showToast,
	refreshTenant,
	onSaveSender,
	loading,
}) {
	const [gcStatus, setGcStatus] = useState(null);
	const [gcBusy, setGcBusy] = useState(false);
	const [domainOpen, setDomainOpen] = useState(false);
	const [domainBusy, setDomainBusy] = useState(false);
	const [leadsOpen, setLeadsOpen] = useState(false);
	const [leadsUpgradeOpen, setLeadsUpgradeOpen] = useState(false);
	const [leadsBusy, setLeadsBusy] = useState(false);
	const [showLeadsToken, setShowLeadsToken] = useState(false);
	const [localLeadsSecret, setLocalLeadsSecret] = useState("");
	const [webhooksOpen, setWebhooksOpen] = useState(false);
	const [webhooksBusy, setWebhooksBusy] = useState(false);
	const [outboundUrl, setOutboundUrl] = useState("");
	const [outboundSecret, setOutboundSecret] = useState("");
	const [showOutboundSecret, setShowOutboundSecret] = useState(false);
	const [eventRows, setEventRows] = useState([]);
	const [templates, setTemplates] = useState([]);

	const leadsWebhookUrl = useMemo(
		() => buildLeadsWebhookUrl(clinicId),
		[clinicId],
	);
	const leadsSecret =
		localLeadsSecret || clinic?.leads_webhook_secret || "";

	const dnsRecords = Array.isArray(clinic?.email_dns_records)
		? clinic.email_dns_records
		: [];
	const domainStatus =
		clinic?.email_domain_status ||
		clinic?.resend_domain_status ||
		"not_configured";

	const refreshGcStatus = useCallback(async () => {
		if (!user?.id) return;
		try {
			const s = await fetchGoogleCalendarLinkStatus();
			setGcStatus(s);
		} catch {
			setGcStatus({ connected: false });
		}
	}, [user?.id]);

	useEffect(() => {
		refreshGcStatus();
	}, [refreshGcStatus]);

	useEffect(() => {
		setLocalLeadsSecret(clinic?.leads_webhook_secret || "");
	}, [clinic?.leads_webhook_secret]);

	useEffect(() => {
		setOutboundUrl(clinic?.outbound_webhook_url || "");
		setOutboundSecret(clinic?.outbound_webhook_secret || "");
	}, [clinic?.outbound_webhook_url, clinic?.outbound_webhook_secret]);

	const loadEventBindings = useCallback(async () => {
		if (!clinicId) return;
		const [{ data: autos }, { data: tpls }] = await Promise.all([
			supabase
				.from("clinic_message_automations")
				.select("*")
				.eq("clinic_id", clinicId),
			supabase
				.from("marketing_templates")
				.select("id, name, kind, clinic_id")
				.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
				.eq("is_active", true)
				.order("name"),
		]);
		setEventRows(autos || []);
		setTemplates(tpls || []);
	}, [clinicId]);

	useEffect(() => {
		if (webhooksOpen) loadEventBindings();
	}, [webhooksOpen, loadEventBindings]);

	const persistLeadsSecret = async (secret) => {
		if (!clinicId || !isAdmin) return;
		setLeadsBusy(true);
		try {
			const { error } = await supabase
				.from("clinics")
				.update({ leads_webhook_secret: secret })
				.eq("id", clinicId);
			if (error) throw error;
			setLocalLeadsSecret(secret);
			await refreshTenant?.();
			showToast?.(secret ? "Token de leads guardado" : "Token eliminado");
		} catch (e) {
			console.error(e);
			showToast?.(e?.message || "No se pudo guardar el token", "error");
		} finally {
			setLeadsBusy(false);
		}
	};

	const saveOutboundWebhook = async () => {
		if (!clinicId || !isAdmin) return;
		setWebhooksBusy(true);
		try {
			const { error } = await supabase
				.from("clinics")
				.update({
					outbound_webhook_url: outboundUrl.trim() || null,
					outbound_webhook_secret: outboundSecret.trim() || null,
				})
				.eq("id", clinicId);
			if (error) throw error;
			await refreshTenant?.();
			showToast?.("Webhook de salida guardado");
		} catch (e) {
			console.error(e);
			showToast?.(e?.message || "No se pudo guardar", "error");
		} finally {
			setWebhooksBusy(false);
		}
	};

	const upsertEventBinding = async (eventKey, patch) => {
		if (!clinicId || !isAdmin) return;
		setWebhooksBusy(true);
		try {
			const existing = eventRows.find((r) => r.event_key === eventKey);
			if (existing) {
				const { error } = await supabase
					.from("clinic_message_automations")
					.update({ ...patch, updated_at: new Date().toISOString() })
					.eq("id", existing.id);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from("clinic_message_automations")
					.insert([
						{
							clinic_id: clinicId,
							event_key: eventKey,
							is_active: false,
							channel: "email",
							template_id: null,
							...patch,
						},
					]);
				if (error) throw error;
			}
			await loadEventBindings();
			showToast?.("Evento actualizado");
		} catch (e) {
			showToast?.(e?.message || "No se pudo actualizar el evento", "error");
		} finally {
			setWebhooksBusy(false);
		}
	};

	const openDomainPanel = () => {
		setClinicForm?.((prev) => ({
			...prev,
			sender_email_name:
				(prev.sender_email_name || "").trim() || clinic?.name || "",
			sender_reply_to:
				(prev.sender_reply_to || "").trim() || user?.email || "",
		}));
		setDomainOpen(true);
	};

	const copyText = async (text) => {
		try {
			await navigator.clipboard.writeText(text || "");
			showToast?.("Copiado");
		} catch {
			showToast?.("No se pudo copiar", "error");
		}
	};

	const invokeDomain = async (action) => {
		if (!clinicId) return;
		setDomainBusy(true);
		try {
			const { data, error } = await supabase.functions.invoke(
				"manage-email-domain",
				{
					body: {
						action,
						clinic_id: clinicId,
						domain:
							clinicForm.custom_email_domain?.trim().toLowerCase() ||
							undefined,
					},
				},
			);
			if (error) throw error;
			if (data?.error) throw new Error(data.error);
			showToast?.(
				action === "connect"
					? "Dominio registrado en Resend"
					: "Estado actualizado",
			);
			await refreshTenant?.();
		} catch (e) {
			console.error(e);
			showToast?.(e.message || "Error con Resend", "error");
		} finally {
			setDomainBusy(false);
		}
	};

	const comingSoon = [
		{
			id: "whatsapp",
			name: "WhatsApp Business",
			desc: "Recordatorios de cita y seguimiento por WhatsApp.",
			icon: MessageCircle,
			hint: "Próximamente",
		},
		{
			id: "stripe",
			name: "Stripe / pagos online",
			desc: "Cobros de presupuestos y depósitos con enlace de pago.",
			icon: CreditCard,
			hint: "Próximamente",
		},
		{
			id: "push",
			name: "Notificaciones push",
			desc: "Avisos en el móvil cuando haya citas o stock bajo.",
			icon: Bell,
			hint: "Próximamente",
		},
	];

	return (
		<div className="space-y-6">
			<p className="text-sm text-slate-500 -mt-1">
				Conecta herramientas externas para automatizar agenda, correo y marca.
			</p>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3 min-w-0">
							<div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 inline-flex items-center justify-center shrink-0">
								<CalendarDays size={22} />
							</div>
							<div className="min-w-0">
								<h3 className="font-bold text-slate-900">Google Calendar</h3>
								<p className="text-xs text-slate-500 mt-1 leading-snug">
									Sincroniza citas y tareas con tu calendario de Google (ida y
									vuelta).
								</p>
							</div>
						</div>
						{gcStatus?.connected ? (
							<StatusChip tone="info">Conectado</StatusChip>
						) : (
							<StatusChip tone="neutral">Disponible</StatusChip>
						)}
					</div>

					{gcStatus?.connected && (
						<p className="text-[11px] text-slate-400">
							Última sync:{" "}
							{gcStatus.last_sync_at
								? new Date(gcStatus.last_sync_at).toLocaleString("es-ES")
								: "—"}
							{gcStatus.last_error ? (
								<span className="text-rose-600"> · {gcStatus.last_error}</span>
							) : null}
						</p>
					)}

					<div className="flex flex-wrap gap-2 mt-auto">
						{!gcStatus?.connected ? (
							<button
								type="button"
								disabled={gcBusy || !user}
								onClick={async () => {
									setGcBusy(true);
									try {
										const url = await startGoogleCalendarLink();
										window.location.href = url;
									} catch (e) {
										console.error(e);
										showToast?.(e?.message || "No se pudo conectar", "error");
									} finally {
										setGcBusy(false);
									}
								}}
								className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
								{gcBusy ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<CalendarDays size={14} />
								)}
								Conectar Google
							</button>
						) : (
							<>
								<button
									type="button"
									disabled={gcBusy}
									onClick={async () => {
										setGcBusy(true);
										try {
											const r = await syncGoogleCalendar();
											showToast?.(
												`Sincronizado: ${r.pulled} desde Google, ${r.pushed} hacia Google`,
											);
											await refreshGcStatus();
										} catch (e) {
											console.error(e);
											showToast?.(
												e?.message || "Error al sincronizar",
												"error",
											);
										} finally {
											setGcBusy(false);
										}
									}}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
									<RefreshCw
										className={`size-3.5 ${gcBusy ? "animate-spin" : ""}`}
									/>
									Sincronizar
								</button>
								<button
									type="button"
									disabled={gcBusy}
									onClick={async () => {
										if (
											!confirm(
												"¿Desconectar Google Calendar? No se borran citas en el ERP.",
											)
										)
											return;
										setGcBusy(true);
										try {
											await disconnectGoogleCalendar();
											await refreshGcStatus();
											showToast?.("Google Calendar desconectado");
										} catch (e) {
											console.error(e);
											showToast?.(
												e?.message || "Error al desconectar",
												"error",
											);
										} finally {
											setGcBusy(false);
										}
									}}
									className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
									<Unplug size={14} /> Desconectar
								</button>
							</>
						)}
					</div>
				</article>

				<article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3 min-w-0">
							<div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
								<Globe size={22} />
							</div>
							<div className="min-w-0">
								<h3 className="font-bold text-slate-900">Dominio propio</h3>
								<p className="text-xs text-slate-500 mt-1 leading-snug">
									Envía correos desde tu clínica (DNS + verificación Resend).
								</p>
							</div>
						</div>
						<StatusChip tone={domainStatusTone(domainStatus)}>
							{DOMAIN_STATUS_LABEL[domainStatus] || domainStatus}
						</StatusChip>
					</div>
					<p className="text-xs text-slate-400">
						Remitente, reply-to y registros DNS se configuran en el panel.
					</p>
					<div className="mt-auto">
						<button
							type="button"
							onClick={openDomainPanel}
							className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
							<Globe size={14} /> Configurar
						</button>
					</div>
				</article>

				<article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3 min-w-0">
							<div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0">
								<UserPlus size={22} />
							</div>
							<div className="min-w-0">
								<h3 className="font-bold text-slate-900">Captación Web (Leads)</h3>
								<p className="text-xs text-slate-500 mt-1 leading-snug">
									Conecta el formulario de tu web para que los contactos entren
									como leads en el ERP.
								</p>
							</div>
						</div>
						{hasWebLeadsModule ? (
							<StatusChip tone={leadsSecret ? "success" : "neutral"}>
								{leadsSecret ? "Listo" : "Sin token"}
							</StatusChip>
						) : (
							<span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 border border-amber-200 bg-amber-50 rounded-lg px-2 py-1 inline-flex items-center gap-1 shrink-0">
								<Sparkles size={10} /> Módulo Premium
							</span>
						)}
					</div>
					<p className="text-xs text-slate-400">
						Webhook + token de seguridad. Compatible con Elementor, Contact Form 7,
						Wix y formularios JSON.
					</p>
					<div className="mt-auto">
						{hasWebLeadsModule ? (
							<button
								type="button"
								onClick={() => setLeadsOpen(true)}
								className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
								<UserPlus size={14} /> Configurar
							</button>
						) : (
							<button
								type="button"
								onClick={() => setLeadsUpgradeOpen(true)}
								className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100">
								<Sparkles size={14} /> Mejorar Plan
							</button>
						)}
					</div>
				</article>

				<article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3 min-w-0">
							<div className="h-11 w-11 rounded-xl bg-violet-50 text-violet-700 inline-flex items-center justify-center shrink-0">
								<Webhook size={22} />
							</div>
							<div className="min-w-0">
								<h3 className="font-bold text-slate-900">Webhooks y eventos</h3>
								<p className="text-xs text-slate-500 mt-1 leading-snug">
									Webhook de salida, asignación de plantillas a eventos y
									preparación Email / WhatsApp.
								</p>
							</div>
						</div>
						<StatusChip
							tone={clinic?.outbound_webhook_url ? "success" : "neutral"}>
							{clinic?.outbound_webhook_url ? "Salida OK" : "Configurar"}
						</StatusChip>
					</div>
					<p className="text-xs text-slate-400">
						Pre-sesión, post-sesión, reseña Google · canal Email (Resend) o
						WhatsApp (futuro).
					</p>
					<div className="mt-auto">
						<button
							type="button"
							onClick={() => setWebhooksOpen(true)}
							className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
							<Webhook size={14} /> Configurar
						</button>
					</div>
				</article>

				{comingSoon.map((item) => {
					const Icon = item.icon;
					return (
						<article
							key={item.id}
							className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 flex flex-col gap-3 opacity-90">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-start gap-3">
									<div className="h-11 w-11 rounded-xl bg-white border border-slate-100 text-slate-400 inline-flex items-center justify-center">
										<Icon size={20} />
									</div>
									<div>
										<h3 className="font-bold text-slate-700">{item.name}</h3>
										<p className="text-xs text-slate-500 mt-1 leading-snug">
											{item.desc}
										</p>
									</div>
								</div>
								<span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 border border-slate-200 bg-white rounded-lg px-2 py-1 inline-flex items-center gap-1">
									<Sparkles size={10} /> {item.hint}
								</span>
							</div>
						</article>
					);
				})}
			</div>

			<SidePanel
				isOpen={domainOpen}
				onClose={() => setDomainOpen(false)}
				title="Dominio e identidad de correo"
				subtitle="Remitente visible y verificación DNS del dominio"
				size="md"
				footer={
					isAdmin ? (
						<button
							type="button"
							onClick={async () => {
								await onSaveSender?.();
							}}
							disabled={loading || domainBusy}
							className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
							{loading ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Save size={16} />
							)}
							Guardar identidad de correo
						</button>
					) : null
				}>
				<div className="space-y-5">
					{!hasCustomDomainModule && (
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
							Tus correos se envían desde BaseClínica (
							<span className="font-semibold">hola@baseclinica.com</span>
							). Para enviar desde tu propio dominio (ej.{" "}
							<span className="font-semibold">info@tuclinica.com</span>),
							actualiza al Plan Clínica 360.
						</div>
					)}

					<div className="grid grid-cols-1 gap-4">
						<label className="block space-y-1">
							<span className="text-xs font-bold text-slate-500 uppercase">
								Nombre del remitente
							</span>
							<input
								disabled={!isAdmin}
								className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 disabled:bg-slate-100"
								value={clinicForm?.sender_email_name || ""}
								onChange={(e) =>
									setClinicForm?.({
										...clinicForm,
										sender_email_name: e.target.value,
									})
								}
							/>
							<p className="text-[11px] text-slate-400">
								Por defecto: nombre de la clínica
							</p>
						</label>
						<label className="block space-y-1">
							<span className="text-xs font-bold text-slate-500 uppercase">
								Reply-To
							</span>
							<input
								disabled={!isAdmin}
								type="email"
								className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 disabled:bg-slate-100"
								value={clinicForm?.sender_reply_to || ""}
								onChange={(e) =>
									setClinicForm?.({
										...clinicForm,
										sender_reply_to: e.target.value,
									})
								}
							/>
							<p className="text-[11px] text-slate-400">
								Por defecto: tu correo de acceso
							</p>
						</label>
					</div>

					{hasCustomDomainModule && (
						<div className="space-y-3 border-t border-slate-100 pt-4">
							<div className="flex flex-wrap items-end gap-3">
								<label className="flex-1 min-w-[200px] block space-y-1">
									<span className="text-xs font-bold text-slate-500 uppercase">
										Dominio propio
									</span>
									<input
										disabled={!isAdmin}
										className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 disabled:bg-slate-100"
										value={clinicForm?.custom_email_domain || ""}
										onChange={(e) =>
											setClinicForm?.({
												...clinicForm,
												custom_email_domain: e.target.value,
											})
										}
										placeholder="tuclinica.com"
									/>
								</label>
								<StatusChip tone={domainStatusTone(domainStatus)}>
									{DOMAIN_STATUS_LABEL[domainStatus] || domainStatus}
								</StatusChip>
							</div>

							{isAdmin && (
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										disabled={
											domainBusy || !clinicForm?.custom_email_domain?.trim()
										}
										onClick={() => invokeDomain("connect")}
										className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
										{domainBusy ? (
											<Loader2 size={16} className="animate-spin" />
										) : (
											<Globe size={16} />
										)}
										Conectar dominio
									</button>
									<button
										type="button"
										disabled={domainBusy || !clinic?.resend_domain_id}
										onClick={() => invokeDomain("verify")}
										className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
										Verificar estado
									</button>
								</div>
							)}

							{dnsRecords.length > 0 && (
								<div className="overflow-x-auto rounded-xl border border-slate-100">
									<table className="w-full text-sm min-w-[480px]">
										<thead>
											<tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 text-left">
												<th className="px-3 py-2">Tipo</th>
												<th className="px-3 py-2">Nombre</th>
												<th className="px-3 py-2">Valor</th>
												<th className="px-3 py-2">Estado</th>
												<th className="px-3 py-2" />
											</tr>
										</thead>
										<tbody>
											{dnsRecords.map((r, i) => (
												<tr key={i} className="border-t border-slate-50">
													<td className="px-3 py-2 font-mono text-xs">
														{r.type || r.record || "—"}
													</td>
													<td className="px-3 py-2 font-mono text-xs break-all">
														{r.name || "—"}
													</td>
													<td className="px-3 py-2 font-mono text-xs break-all max-w-[180px]">
														{r.value || "—"}
													</td>
													<td className="px-3 py-2">
														{String(r.status || "pending").toLowerCase() ===
														"verified" ? (
															<StatusChip tone="success">OK</StatusChip>
														) : (
															<StatusChip tone="warning">
																Pendiente DNS
															</StatusChip>
														)}
													</td>
													<td className="px-3 py-2 text-right">
														<button
															type="button"
															onClick={() => copyText(r.value)}
															className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900">
															<Copy size={12} /> Copiar
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
									<p className="text-[11px] text-slate-500 px-3 py-2">
										Pega estos registros en tu DNS y pulsa Verificar estado.
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			</SidePanel>

			<SidePanel
				isOpen={leadsOpen}
				onClose={() => setLeadsOpen(false)}
				title="Configuración de Leads"
				subtitle="Conecta el formulario de tu web en 3 pasos"
				size="md">
				<div className="space-y-5">
					<section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
						<div className="flex items-center gap-2">
							<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
								1
							</span>
							<h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
								<Link2 size={16} /> URL del webhook
							</h4>
						</div>
						<p className="text-xs text-slate-500 leading-relaxed">
							Copia esta URL y úsala como destino del webhook / notificación de tu
							formulario web.
						</p>
						<div className="flex gap-2">
							<input
								readOnly
								value={leadsWebhookUrl}
								className="flex-1 min-w-0 p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-mono text-slate-800 outline-none"
							/>
							<button
								type="button"
								onClick={() => copyText(leadsWebhookUrl)}
								disabled={!leadsWebhookUrl}
								className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
								<Copy size={14} /> Copiar
							</button>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
						<div className="flex items-center gap-2">
							<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
								2
							</span>
							<h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
								<KeyRound size={16} /> Token de seguridad
							</h4>
						</div>
						<p className="text-xs text-slate-500 leading-relaxed">
							Envíalo en el header <code className="text-[11px]">x-webhook-secret</code>{" "}
							o en el JSON como <code className="text-[11px]">token</code>. Sin este
							secreto el webhook rechaza la petición.
						</p>
						{isAdmin ? (
							<>
								<div className="flex gap-2">
									<input
										readOnly
										type={showLeadsToken ? "text" : "password"}
										value={leadsSecret}
										placeholder="Genera un token para activar el webhook"
										className="flex-1 min-w-0 p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-mono text-slate-800 outline-none"
									/>
									<button
										type="button"
										onClick={() => setShowLeadsToken((v) => !v)}
										className="inline-flex items-center justify-center shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
										title={showLeadsToken ? "Ocultar" : "Mostrar"}>
										{showLeadsToken ? <EyeOff size={14} /> : <Eye size={14} />}
									</button>
									<button
										type="button"
										onClick={() => copyText(leadsSecret)}
										disabled={!leadsSecret}
										className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
										<Copy size={14} /> Copiar
									</button>
								</div>
								<button
									type="button"
									disabled={leadsBusy}
									onClick={() => persistLeadsSecret(generateWebhookSecret())}
									className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
									{leadsBusy ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Shuffle size={14} />
									)}
									{leadsSecret ? "Regenerar token" : "Generar token"}
								</button>
							</>
						) : (
							<p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
								Solo el admin de la clínica puede ver o regenerar el token.
							</p>
						)}
					</section>

					<section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div className="flex items-center gap-2">
							<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
								3
							</span>
							<h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
								<HelpCircle size={16} /> Cómo conectarlo
							</h4>
						</div>
						<p className="text-sm text-slate-700 leading-relaxed">
							Añade esta URL como Webhook en el formulario de tu web (ej. Elementor,
							Contact Form 7 o Wix) para que los contactos entren directamente al
							ERP. El body debe ser JSON con{" "}
							<code className="text-xs">name</code>, y opcionalmente{" "}
							<code className="text-xs">phone</code>,{" "}
							<code className="text-xs">email</code>,{" "}
							<code className="text-xs">message</code> e{" "}
							<code className="text-xs">interest</code>.
						</p>
						<p className="text-xs text-slate-500">
							Los leads aparecen en Pacientes → Leads / Potenciales. Desde ahí puedes
							contactar por WhatsApp o convertirlos a paciente.
						</p>
					</section>
				</div>
			</SidePanel>

			<SidePanel
				isOpen={webhooksOpen}
				onClose={() => setWebhooksOpen(false)}
				title="Webhooks y eventos"
				subtitle="Entrada / salida y plantillas por evento"
				size="lg">
				<div className="space-y-6">
					<section className="rounded-2xl border border-slate-200 p-4 space-y-3">
						<h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
							<Link2 size={16} /> Webhook de entrada (Leads)
						</h4>
						<p className="text-xs text-slate-500">
							Los formularios web usan el endpoint de captación. Configúralo en la
							tarjeta Captación Web (Leads).
						</p>
						{leadsWebhookUrl ? (
							<input
								readOnly
								value={leadsWebhookUrl}
								className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-mono"
							/>
						) : null}
						<button
							type="button"
							onClick={() => {
								setWebhooksOpen(false);
								if (hasWebLeadsModule) setLeadsOpen(true);
								else setLeadsUpgradeOpen(true);
							}}
							className="text-xs font-bold text-slate-800 underline">
							Ir a Captación Web
						</button>
					</section>

					<section className="rounded-2xl border border-slate-200 p-4 space-y-3">
						<h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
							<Webhook size={16} /> Webhook de salida
						</h4>
						<p className="text-xs text-slate-500 leading-relaxed">
							Cuando un evento se dispare (futuro worker), se enviará un POST JSON
							a esta URL con header{" "}
							<code className="text-[11px]">x-webhook-secret</code>. Arquitectura
							lista para Email (Resend) o WhatsApp Business.
						</p>
						{isAdmin ? (
							<>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-slate-500 uppercase">
										URL de destino
									</span>
									<input
										value={outboundUrl}
										onChange={(e) => setOutboundUrl(e.target.value)}
										placeholder="https://tu-sistema.com/hooks/clinica"
										className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono"
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs font-bold text-slate-500 uppercase">
										Secreto
									</span>
									<div className="flex gap-2">
										<input
											type={showOutboundSecret ? "text" : "password"}
											value={outboundSecret}
											onChange={(e) => setOutboundSecret(e.target.value)}
											placeholder="Token compartido"
											className="flex-1 p-3 border border-slate-200 rounded-xl text-sm font-mono"
										/>
										<button
											type="button"
											onClick={() => setShowOutboundSecret((v) => !v)}
											className="rounded-xl border border-slate-200 px-3">
											{showOutboundSecret ? <EyeOff size={14} /> : <Eye size={14} />}
										</button>
										<button
											type="button"
											onClick={() => setOutboundSecret(generateWebhookSecret())}
											className="rounded-xl border border-slate-200 px-3 text-xs font-bold">
											Generar
										</button>
									</div>
								</label>
								<button
									type="button"
									disabled={webhooksBusy}
									onClick={saveOutboundWebhook}
									className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
									{webhooksBusy ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Save size={14} />
									)}
									Guardar salida
								</button>
							</>
						) : (
							<p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
								Solo el admin puede configurar el webhook de salida.
							</p>
						)}
					</section>

					<section className="rounded-2xl border border-slate-200 p-4 space-y-3">
						<div className="flex items-center justify-between gap-2 flex-wrap">
							<h4 className="text-sm font-bold text-slate-900">
								Plantillas por evento
							</h4>
							<Link
								to="/marketing/automatizaciones"
								className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900"
								onClick={() => setWebhooksOpen(false)}>
								Editar mensajes <ExternalLink size={12} />
							</Link>
						</div>
						<p className="text-xs text-slate-500">
							Asigna plantilla y canal. El contenido se edita en Marketing →
							Automatizaciones.
						</p>
						<div className="space-y-3">
							{AUTOMATION_EVENTS.map((ev) => {
								const row = eventRows.find((r) => r.event_key === ev.key);
								return (
									<div
										key={ev.key}
										className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
										<div className="flex items-center justify-between gap-2">
											<p className="text-sm font-bold text-slate-900">{ev.label}</p>
											<label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
												<input
													type="checkbox"
													disabled={!isAdmin || webhooksBusy}
													checked={!!row?.is_active}
													onChange={(e) =>
														upsertEventBinding(ev.key, {
															is_active: e.target.checked,
														})
													}
												/>
												Activo
											</label>
										</div>
										<div className="grid sm:grid-cols-2 gap-2">
											<select
												disabled={!isAdmin || webhooksBusy}
												value={row?.template_id || ""}
												onChange={(e) =>
													upsertEventBinding(ev.key, {
														template_id: e.target.value || null,
													})
												}
												className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold bg-white">
												<option value="">— Plantilla —</option>
												{templates.map((t) => (
													<option key={t.id} value={t.id}>
														{t.name}
													</option>
												))}
											</select>
											<select
												disabled={!isAdmin || webhooksBusy}
												value={row?.channel || "email"}
												onChange={(e) =>
													upsertEventBinding(ev.key, {
														channel: e.target.value,
													})
												}
												className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold bg-white">
												{AUTOMATION_CHANNELS.map((c) => (
													<option key={c.value} value={c.value}>
														{c.label}
													</option>
												))}
											</select>
										</div>
									</div>
								);
							})}
						</div>
					</section>
				</div>
			</SidePanel>

			<AdaptiveModal
				isOpen={leadsUpgradeOpen}
				onClose={() => setLeadsUpgradeOpen(false)}
				title="Captación Web (Leads)"
				maxWidth="max-w-md">
				<div className="space-y-4">
					<p className="text-sm text-slate-600 leading-relaxed">
						Este módulo Premium conecta el formulario de tu web con el ERP: los
						contactos entran como leads, listos para contactar o convertir a paciente.
					</p>
					<ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
						<li>Webhook listo para Elementor, CF7, Wix u otros</li>
						<li>Token de seguridad por clínica</li>
						<li>Bandeja de leads en Pacientes</li>
					</ul>
					<p className="text-xs text-slate-500">
						Contacta con soporte o tu administrador de plataforma para activar{" "}
						<strong>Captación web (Leads)</strong> en tu plan.
					</p>
					<button
						type="button"
						onClick={() => setLeadsUpgradeOpen(false)}
						className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
						Entendido
					</button>
				</div>
			</AdaptiveModal>
		</div>
	);
}
