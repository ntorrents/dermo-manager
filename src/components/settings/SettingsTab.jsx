import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	User,
	Lock,
	Save,
	Loader2,
	ShieldAlert,
	Building2,
	Phone,
	MapPin,
	CreditCard,
	LogOut,
	Mail,
	CheckCircle2,
	Download,
	AlertTriangle,
	Shield,
	Users,
	UserPlus,
	ScrollText,
	Palette,
	Sun,
	Moon,
	ImagePlus,
	Trash2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { updateUserPassword, logout } from "../../services/auth";
import { exportUserBackup, downloadBackup } from "../../services/backupExport";
import { uploadProfileAsset } from "../../services/profileAssetStorage";
import { useTenant } from "../../context/TenantContext";
import { useAppearance } from "../../context/AppearanceContext";
import {
	APPEARANCE_THEMES,
	DENSITY_OPTIONS,
} from "../../constants/appearanceThemes";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useAuditLog } from "../../hooks/useAuditLog";
import { auditActionLabel, auditEntityLabel, auditChangesLines } from "../../utils/auditLabels";
import { IntegrationsSettings } from "./IntegrationsSettings";
import { SignatureComposer } from "./SignatureComposer";

const SETTINGS_VIEWS = {
	appearance: "appearance",
	clinic: "clinic",
	me: "me",
	team: "team",
	security: "security",
	audit: "audit",
	integrations: "integrations",
};

const ROLE_OPTIONS = [
	{ value: "admin", label: "Administrador" },
	{ value: "staff_medico", label: "Staff médico" },
	{ value: "recepcion", label: "Recepción" },
];

export const SettingsTab = ({
	user,
	profile,
	showToast,
	navigateAnchor,
	onNavigateAnchorConsumed,
}) => {
	const { clinicId, clinic, isAdmin, refreshTenant, hasModule } = useTenant();
	const { themeId, density, setThemeId, setDensity } = useAppearance();
	const [searchParams, setSearchParams] = useSearchParams();

	const initialClinicForm = useMemo(
		() => ({
			name: clinic?.name || "",
			billing_nif: clinic?.billing_nif || "",
			billing_address: clinic?.billing_address || "",
			billing_city: clinic?.billing_city || "",
			billing_phone: clinic?.billing_phone || "",
			logo_url: clinic?.logo_url || "",
			sender_email_name: clinic?.sender_email_name || "",
			sender_reply_to: clinic?.sender_reply_to || "",
			custom_email_domain: clinic?.custom_email_domain || "",
		}),
		[clinic]
	);

	const initialProfileForm = useMemo(
		() => ({
			name: profile?.name || "",
			surname: profile?.surname || "",
			mobile: profile?.mobile || "",
			collegiateNumber: profile?.collegiate_number || "",
			consent_signature_url: profile?.consent_signature_url || "",
		}),
		[profile]
	);

	const [view, setView] = useState(SETTINGS_VIEWS.clinic);

	const {
		rows: auditRows,
		loading: auditLoading,
		error: auditError,
		refresh: refreshAudit,
	} = useAuditLog(clinicId, { limit: 200, enabled: isAdmin && view === SETTINGS_VIEWS.audit });

	const [auditActorLabels, setAuditActorLabels] = useState({});

	const auditUserIdsKey = useMemo(() => {
		const u = new Set();
		(auditRows || []).forEach((r) => {
			if (r.user_id) u.add(r.user_id);
		});
		return [...u].sort().join("|");
	}, [auditRows]);

	useEffect(() => {
		if (!isAdmin || view !== SETTINGS_VIEWS.audit) {
			if (view !== SETTINGS_VIEWS.audit) setAuditActorLabels({});
			return;
		}
		const ids = auditUserIdsKey.split("|").filter(Boolean);
		if (ids.length === 0) {
			setAuditActorLabels({});
			return;
		}
		let cancelled = false;
		(async () => {
			const { data, error } = await supabase
				.from("profiles")
				.select("id, name, surname, email")
				.in("id", ids);
			if (cancelled || error) return;
			const next = {};
			(data || []).forEach((p) => {
				next[p.id] =
					[p.name, p.surname].filter(Boolean).join(" ").trim() || p.email || p.id;
			});
			setAuditActorLabels(next);
		})();
		return () => {
			cancelled = true;
		};
	}, [isAdmin, view, auditUserIdsKey]);

	const [clinicForm, setClinicForm] = useState(initialClinicForm);
	const [profileForm, setProfileForm] = useState(initialProfileForm);

	const [email, setEmail] = useState("");
	const [newEmail, setNewEmail] = useState("");

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [loadingProfile, setLoadingProfile] = useState(false);
	const [uploadingLogo, setUploadingLogo] = useState(false);
	const [loadingPass, setLoadingPass] = useState(false);
	const [loadingEmail, setLoadingEmail] = useState(false);
	const [loadingBackup, setLoadingBackup] = useState(false);

	const [isGoogleUser, setIsGoogleUser] = useState(false);

	const [teamMembers, setTeamMembers] = useState([]);
	const [loadingTeam, setLoadingTeam] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("recepcion");
	const [inviting, setInviting] = useState(false);
	const [removingId, setRemovingId] = useState(null);
	const [confirmRemove, setConfirmRemove] = useState(null);
	const [savingRoleId, setSavingRoleId] = useState(null);

	useEffect(() => {
		if (user) {
			const isGoogle = user.app_metadata?.provider === "google";
			setIsGoogleUser(isGoogle);
			setEmail(user.email);
		}
	}, [user]);

	useEffect(() => setClinicForm(initialClinicForm), [initialClinicForm]);
	useEffect(() => setProfileForm(initialProfileForm), [initialProfileForm]);

	const loadTeam = useCallback(async () => {
		if (!clinicId || !isAdmin) return;
		setLoadingTeam(true);
		try {
			const { data: rows, error: e1 } = await supabase
				.from("user_clinic_memberships")
				.select("id, user_id, role")
				.eq("clinic_id", clinicId);
			if (e1) throw e1;
			const ids = (rows || []).map((r) => r.user_id);
			if (ids.length === 0) {
				setTeamMembers([]);
				return;
			}
			const { data: profs, error: e2 } = await supabase
				.from("profiles")
				.select("id, email, name, surname, mobile")
				.in("id", ids);
			if (e2) throw e2;
			const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
			setTeamMembers(
				(rows || []).map((r) => ({
					membershipId: r.id,
					userId: r.user_id,
					role: r.role,
					profile: byId[r.user_id] || { id: r.user_id, email: "", name: "", surname: "" },
				}))
			);
		} catch (err) {
			console.error(err);
			showToast?.("No se pudo cargar el equipo", "error");
			setTeamMembers([]);
		} finally {
			setLoadingTeam(false);
		}
	}, [clinicId, isAdmin, showToast]);

	useEffect(() => {
		if (view === SETTINGS_VIEWS.team && isAdmin) loadTeam();
	}, [view, isAdmin, loadTeam]);

	useEffect(() => {
		if (!isAdmin && view === SETTINGS_VIEWS.team) setView(SETTINGS_VIEWS.clinic);
	}, [isAdmin, view]);

	useEffect(() => {
		if (!isAdmin && view === SETTINGS_VIEWS.audit) setView(SETTINGS_VIEWS.clinic);
	}, [isAdmin, view]);

	useEffect(() => {
		if (navigateAnchor === "audit" && isAdmin) {
			setView(SETTINGS_VIEWS.audit);
			onNavigateAnchorConsumed?.();
		}
	}, [navigateAnchor, isAdmin, onNavigateAnchorConsumed]);

	useEffect(() => {
		const section = searchParams.get("section");
		if (section === "appearance") {
			setView(SETTINGS_VIEWS.appearance);
			setSearchParams({}, { replace: true });
		} else if (section === "integrations") {
			setView(SETTINGS_VIEWS.integrations);
			setSearchParams({}, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	const handleUpdateClinic = async () => {
		if (!clinicId) return;
		if (!isAdmin) {
			showToast?.("Solo el admin puede editar la clínica", "error");
			return;
		}
		setLoadingProfile(true);
		try {
			const payload = {
				name: clinicForm.name?.trim() || null,
				billing_nif: clinicForm.billing_nif?.trim() || null,
				billing_address: clinicForm.billing_address?.trim() || null,
				billing_city: clinicForm.billing_city?.trim() || null,
				billing_phone: clinicForm.billing_phone?.trim() || null,
				logo_url: clinicForm.logo_url?.trim() || null,
				sender_email_name: clinicForm.sender_email_name?.trim() || null,
				sender_reply_to: clinicForm.sender_reply_to?.trim() || null,
			};
			if (hasModule("custom_email_domain") && clinicForm.custom_email_domain?.trim()) {
				payload.custom_email_domain = clinicForm.custom_email_domain.trim().toLowerCase();
			}
			const { error } = await supabase.from("clinics").update(payload).eq("id", clinicId);
			if (error) throw error;
			showToast?.("Clínica actualizada");
			await refreshTenant?.();
		} catch (error) {
			console.error("Error saving clinic:", error);
			showToast?.("Error al guardar la clínica", "error");
		} finally {
			setLoadingProfile(false);
		}
	};

	const handleUpdateProfile = async () => {
		if (!user?.id) return;
		setLoadingProfile(true);
		try {
			const updates = {
				id: user.id,
				name: profileForm.name,
				surname: profileForm.surname,
				mobile: profileForm.mobile,
				collegiate_number: profileForm.collegiateNumber,
				consent_signature_url: profileForm.consent_signature_url || null,
				email: user.email,
				updated_at: new Date(),
			};

			const { error } = await supabase.from("profiles").upsert(updates);
			if (error) throw error;
			showToast?.("Perfil actualizado");
		} catch (error) {
			console.error("Error saving profile:", error);
			showToast?.("Error al guardar perfil", "error");
		} finally {
			setLoadingProfile(false);
		}
	};

	const handleUpdateEmail = async () => {
		if (!newEmail || newEmail === email) return;

		setLoadingEmail(true);
		try {
			const { error } = await supabase.auth.updateUser({ email: newEmail });
			if (error) throw error;
			showToast?.("Revisa tu nuevo correo para confirmar el cambio");
			setNewEmail("");
		} catch (error) {
			console.error(error);
			showToast?.("Error al actualizar email", "error");
		} finally {
			setLoadingEmail(false);
		}
	};

	const handleUpdatePassword = async () => {
		if (!password || !confirmPassword) return showToast?.("Rellena todos los campos", "error");
		if (password !== confirmPassword) return showToast?.("Las contraseñas no coinciden", "error");
		if (password.length < 6) return showToast?.("Mínimo 6 caracteres", "error");

		setLoadingPass(true);
		try {
			await updateUserPassword(password);
			showToast?.("Contraseña actualizada correctamente");
			setPassword("");
			setConfirmPassword("");
		} catch (e) {
			console.error(e);
			showToast?.("Error al actualizar contraseña", "error");
		} finally {
			setLoadingPass(false);
		}
	};

	const handleDownloadBackup = async () => {
		if (!user?.id || !clinicId) return;
		setLoadingBackup(true);
		try {
			const backup = await exportUserBackup({ userId: user.id, clinicId });
			downloadBackup(backup);
			showToast?.("Copia de seguridad descargada");
		} catch (err) {
			console.error(err);
			showToast?.("Error al generar la copia de seguridad", "error");
		} finally {
			setLoadingBackup(false);
		}
	};

	const handleRoleChange = async (membershipId, userId, newRole) => {
		setSavingRoleId(membershipId);
		try {
			const { error } = await supabase
				.from("user_clinic_memberships")
				.update({ role: newRole })
				.eq("id", membershipId);
			if (error) throw error;
			showToast?.("Rol actualizado");
			setTeamMembers((prev) =>
				prev.map((m) => (m.membershipId === membershipId ? { ...m, role: newRole } : m))
			);
			if (userId === user?.id) await refreshTenant?.();
		} catch (err) {
			console.error(err);
			showToast?.(err?.message || "No se pudo cambiar el rol", "error");
		} finally {
			setSavingRoleId(null);
		}
	};

	const handleInvite = async (e) => {
		e.preventDefault();
		const em = inviteEmail?.trim();
		if (!em) {
			showToast?.("Indica un correo", "error");
			return;
		}
		setInviting(true);
		try {
			const { error } = await supabase.rpc("admin_invite_user_to_my_clinic", {
				p_email: em,
				p_role: inviteRole,
			});
			if (error) throw error;
			showToast?.("Usuario añadido a la clínica");
			setInviteEmail("");
			await loadTeam();
		} catch (err) {
			console.error(err);
			const msg = err?.message || "";
			if (msg.includes("No existe un usuario registrado")) {
				showToast?.("Ese correo no tiene cuenta aún: deben registrarse en la app antes.", "error");
			} else {
				showToast?.(msg || "No se pudo añadir el usuario", "error");
			}
		} finally {
			setInviting(false);
		}
	};

	const runRemoveMember = async (userId) => {
		setRemovingId(userId);
		try {
			const { error } = await supabase.rpc("admin_remove_user_from_my_clinic", {
				p_user_id: userId,
			});
			if (error) throw error;
			showToast?.("Usuario eliminado del equipo");
			setConfirmRemove(null);
			await loadTeam();
		} catch (err) {
			console.error(err);
			showToast?.(err?.message || "No se pudo eliminar", "error");
		} finally {
			setRemovingId(null);
		}
	};

	const settingsTabs = [
		{ id: SETTINGS_VIEWS.clinic, label: "Clínica" },
		{ id: SETTINGS_VIEWS.appearance, label: "Apariencia" },
		{ id: SETTINGS_VIEWS.integrations, label: "Integraciones" },
		{ id: SETTINGS_VIEWS.me, label: "Mi perfil" },
		isAdmin && { id: SETTINGS_VIEWS.team, label: "Equipo" },
		{ id: SETTINGS_VIEWS.security, label: "Seguridad" },
		isAdmin && { id: SETTINGS_VIEWS.audit, label: "Auditoría" },
	].filter(Boolean);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="space-y-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
						Configuración
					</h1>
					<p className="text-sm text-muted mt-1">
						Clínica, apariencia, equipo y seguridad
					</p>
				</div>
				<nav
					className="flex items-center gap-1 overflow-x-auto border-b border-edge [scrollbar-width:thin]"
					aria-label="Secciones de configuración">
					{settingsTabs.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setView(t.id)}
							className={`shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
								view === t.id
									? "border-primary text-primary"
									: "border-transparent text-muted hover:text-fg"
							}`}>
							{t.label}
						</button>
					))}
				</nav>
			</div>

			{view === SETTINGS_VIEWS.appearance && (
				<>
					<div className="ui-card space-y-8">
						<section className="space-y-3">
							<div>
								<h3 className="font-bold text-fg flex items-center gap-2">
									<Palette size={18} className="text-primary" /> Tema
								</h3>
								<p className="text-sm text-muted mt-1">
									Se guarda en este navegador. Incluye temas claros y oscuros.
								</p>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{APPEARANCE_THEMES.map((t) => {
									const selected = themeId === t.id;
									return (
										<button
											key={t.id}
											type="button"
											onClick={() => setThemeId(t.id)}
											className={`text-left rounded-2xl border p-3 transition-all ${
												selected
													? "border-primary ring-2 ring-primary/30"
													: "border-edge hover:border-primary/40"
											}`}>
											<div
												className="h-14 rounded-xl border border-edge mb-3 flex overflow-hidden"
												aria-hidden>
												<div className="w-1/3" style={{ background: t.preview.bg }} />
												<div className="w-1/3" style={{ background: t.preview.surface }} />
												<div className="w-1/3" style={{ background: t.preview.primary }} />
											</div>
											<p className="font-bold text-fg text-sm flex items-center gap-1.5">
												{t.mode === "dark" ? <Moon size={14} /> : <Sun size={14} />}
												{t.label}
											</p>
											<p className="text-xs text-muted mt-0.5">{t.desc}</p>
										</button>
									);
								})}
							</div>
						</section>

						<section className="space-y-3 border-t border-edge pt-6">
							<div>
								<h3 className="font-bold text-fg">Densidad</h3>
								<p className="text-sm text-muted mt-1">
									Por defecto: cómoda (más aire). Compacta junta un poco el contenido.
								</p>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{DENSITY_OPTIONS.map((d) => {
									const selected = density === d.id;
									return (
										<button
											key={d.id}
											type="button"
											onClick={() => setDensity(d.id)}
											className={`text-left rounded-2xl border px-4 py-3 transition-all ${
												selected
													? "border-primary bg-primary-soft"
													: "border-edge hover:bg-surface-2"
											}`}>
											<p className="font-bold text-fg text-sm">{d.label}</p>
											<p className="text-xs text-muted mt-0.5">{d.desc}</p>
										</button>
									);
								})}
							</div>
						</section>
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.clinic && (
				<>
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
						<p className="text-sm text-gray-500 mb-4">
							{isAdmin
								? "Edita los datos que verán todos en facturas y documentos."
								: "Solo el administrador puede modificar estos campos."}
						</p>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="md:col-span-2">
								<label className="text-xs font-bold text-gray-500 uppercase">Nombre de la clínica</label>
								<div className="relative mt-1">
									<Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
									<input
										disabled={!isAdmin}
										className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500 disabled:bg-gray-100"
										value={clinicForm.name}
										onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
										placeholder="Ej: Clínica Sol"
									/>
								</div>
							</div>
							<div className="md:col-span-2">
								<label className="text-xs font-bold text-gray-500 uppercase">
									Logo de la clínica
								</label>
								<div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
									<div className="shrink-0 w-24 h-24 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
										{clinicForm.logo_url ? (
											<img
												src={clinicForm.logo_url}
												alt="Logo"
												className="w-full h-full object-contain p-2"
												onError={(e) => {
													e.target.style.display = "none";
												}}
											/>
										) : (
											<ImagePlus className="text-slate-300" size={28} />
										)}
									</div>
									<div className="flex-1 min-w-0 space-y-2">
										<p className="text-sm text-slate-500">
											PNG, JPG, WebP o SVG. Se usa en facturas, PDFs y favicon.
										</p>
										{isAdmin ? (
											<div className="flex flex-wrap items-center gap-2">
												<label
													className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold cursor-pointer transition-colors ${
														uploadingLogo
															? "bg-slate-100 text-slate-400"
															: "bg-slate-900 text-white hover:bg-slate-800"
													}`}>
													{uploadingLogo ? (
														<Loader2 size={16} className="animate-spin" />
													) : (
														<ImagePlus size={16} />
													)}
													{clinicForm.logo_url ? "Cambiar archivo" : "Subir archivo"}
													<input
														type="file"
														accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
														className="hidden"
														disabled={uploadingLogo}
														onChange={async (e) => {
															const f = e.target.files?.[0];
															if (!f || !user?.id) return;
															if (f.size > 3 * 1024 * 1024) {
																showToast?.("El logo no puede superar 3 MB", "error");
																e.target.value = "";
																return;
															}
															setUploadingLogo(true);
															try {
																const url = await uploadProfileAsset(
																	user.id,
																	f,
																	"logo",
																);
																if (!url) throw new Error("No se obtuvo URL del logo");
																setClinicForm((prev) => ({ ...prev, logo_url: url }));
																if (clinicId) {
																	const { error } = await supabase
																		.from("clinics")
																		.update({ logo_url: url })
																		.eq("id", clinicId);
																	if (error) throw error;
																	await refreshTenant?.();
																}
																showToast?.("Logo actualizado");
															} catch (err) {
																console.error(err);
																showToast?.(
																	err?.message || "Error al subir el logo",
																	"error",
																);
															} finally {
																setUploadingLogo(false);
																e.target.value = "";
															}
														}}
													/>
												</label>
												{clinicForm.logo_url && (
													<button
														type="button"
														disabled={uploadingLogo}
														onClick={async () => {
															setClinicForm((prev) => ({ ...prev, logo_url: "" }));
															if (!clinicId) return;
															try {
																const { error } = await supabase
																	.from("clinics")
																	.update({ logo_url: null })
																	.eq("id", clinicId);
																if (error) throw error;
																await refreshTenant?.();
																showToast?.("Logo eliminado");
															} catch (err) {
																showToast?.(
																	err?.message || "No se pudo eliminar",
																	"error",
																);
															}
														}}
														className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
														<Trash2 size={14} /> Quitar
													</button>
												)}
											</div>
										) : (
											<p className="text-xs text-slate-400">
												Solo el administrador puede cambiar el logo.
											</p>
										)}
									</div>
								</div>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">NIF / CIF</label>
								<div className="relative mt-1">
									<CreditCard className="absolute left-3 top-3 text-gray-400" size={18} />
									<input
										disabled={!isAdmin}
										className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
										value={clinicForm.billing_nif}
										onChange={(e) => setClinicForm({ ...clinicForm, billing_nif: e.target.value })}
										placeholder="12345678X"
									/>
								</div>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Teléfono (clínica)</label>
								<div className="relative mt-1">
									<Phone className="absolute left-3 top-3 text-gray-400" size={18} />
									<input
										disabled={!isAdmin}
										className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
										value={clinicForm.billing_phone}
										onChange={(e) => setClinicForm({ ...clinicForm, billing_phone: e.target.value })}
									/>
								</div>
							</div>
							<div className="md:col-span-2">
								<label className="text-xs font-bold text-gray-500 uppercase">Dirección fiscal</label>
								<div className="relative mt-1">
									<MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
									<input
										disabled={!isAdmin}
										className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
										value={clinicForm.billing_address}
										onChange={(e) => setClinicForm({ ...clinicForm, billing_address: e.target.value })}
										placeholder="Calle, Número..."
									/>
								</div>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Ciudad / CP</label>
								<input
									disabled={!isAdmin}
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500 disabled:bg-gray-100"
									value={clinicForm.billing_city}
									onChange={(e) => setClinicForm({ ...clinicForm, billing_city: e.target.value })}
								/>
							</div>
						</div>

						{isAdmin && (
							<div className="flex justify-end mt-6">
								<button
									onClick={handleUpdateClinic}
									disabled={loadingProfile || !isAdmin}
									className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black flex items-center gap-2 disabled:opacity-50">
									{loadingProfile ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}{" "}
									Guardar clínica
								</button>
							</div>
						)}
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.integrations && (
				<>
					<IntegrationsSettings
						user={user}
						clinic={clinic}
						clinicId={clinicId}
						clinicForm={clinicForm}
						setClinicForm={setClinicForm}
						isAdmin={isAdmin}
						hasCustomDomainModule={hasModule("custom_email_domain")}
						hasWebLeadsModule={hasModule("web_leads")}
						showToast={showToast}
						refreshTenant={refreshTenant}
						onSaveSender={handleUpdateClinic}
						loading={loadingProfile}
					/>
				</>
			)}

			{view === SETTINGS_VIEWS.me && (
				<>
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
						<p className="text-sm text-gray-500 mb-4">Datos personales (no se comparten con el resto del equipo).</p>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
								<input
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
									value={profileForm.name}
									onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Apellidos</label>
								<input
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
									value={profileForm.surname}
									onChange={(e) => setProfileForm({ ...profileForm, surname: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Teléfono</label>
								<input
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
									value={profileForm.mobile}
									onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">Nº Colegiado</label>
								<input
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
									value={profileForm.collegiateNumber}
									onChange={(e) => setProfileForm({ ...profileForm, collegiateNumber: e.target.value })}
								/>
							</div>

							<div className="md:col-span-2">
								<SignatureComposer
									userId={user?.id}
									valueUrl={profileForm.consent_signature_url}
									defaultName={[profileForm.name, profileForm.surname]
										.filter(Boolean)
										.join(" ")}
									defaultSurname={profileForm.surname}
									defaultTitle={
										profileForm.collegiateNumber
											? `Nº col. ${profileForm.collegiateNumber}`
											: ""
									}
									showToast={showToast}
									onChangeUrl={(url) =>
										setProfileForm((prev) => ({
											...prev,
											consent_signature_url: url || "",
										}))
									}
									onPersist={async (url) => {
										if (!user?.id) return;
										const { error } = await supabase
											.from("profiles")
											.upsert({
												id: user.id,
												consent_signature_url: url || null,
												email: user.email,
												updated_at: new Date(),
											});
										if (error) throw error;
									}}
								/>
							</div>
						</div>

						<div className="flex justify-end mt-6">
							<button
								onClick={handleUpdateProfile}
								disabled={loadingProfile}
								className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black flex items-center gap-2">
								{loadingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{" "}
								Guardar perfil
							</button>
						</div>
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.team && isAdmin && (
				<>
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
						<h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
							<UserPlus size={16} className="text-rose-700" /> Añadir persona
						</h4>
						<p className="text-xs text-gray-500 mb-3">
							La cuenta debe existir ya (mismo correo con el que se registró en la app). Se asignará a esta
							clínica y al rol elegido.
						</p>
						<form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
							<div className="flex-1 min-w-0">
								<label className="text-[10px] font-bold text-gray-400 uppercase">Correo</label>
								<input
									type="email"
									className="w-full p-3 border border-gray-200 rounded-xl mt-0.5 outline-none focus:border-rose-500"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									placeholder="compañero@clinica.com"
								/>
							</div>
							<div className="w-full sm:w-44">
								<label className="text-[10px] font-bold text-gray-400 uppercase">Rol</label>
								<select
									className="w-full p-3 border border-gray-200 rounded-xl mt-0.5 font-bold text-gray-700 outline-none focus:border-rose-500"
									value={inviteRole}
									onChange={(e) => setInviteRole(e.target.value)}>
									{ROLE_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{o.label}
										</option>
									))}
								</select>
							</div>
							<button
								type="submit"
								disabled={inviting}
								className="bg-rose-700 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-rose-800 disabled:opacity-50 flex items-center justify-center gap-2">
								{inviting ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
								Añadir
							</button>
						</form>
					</div>

					<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
						{loadingTeam ? (
							<div className="p-8 flex justify-center">
								<Loader2 className="animate-spin text-rose-400" size={28} />
							</div>
						) : teamMembers.length === 0 ? (
							<p className="p-6 text-sm text-gray-500">No hay miembros registrados en esta clínica.</p>
						) : (
							<ul className="divide-y divide-gray-100">
								{teamMembers.map((m) => {
									const p = m.profile;
									const display = [p.name, p.surname].filter(Boolean).join(" ") || "Sin nombre";
									const isSelf = m.userId === user?.id;
									return (
										<li key={m.membershipId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-bold text-gray-800 truncate">{display}</p>
												<p className="text-xs text-gray-500 truncate">{p.email || m.userId}</p>
												{isSelf && (
													<span className="text-[10px] font-bold text-rose-700 uppercase">Tú</span>
												)}
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<select
													className="p-2.5 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-rose-500 bg-white"
													value={m.role}
													disabled={savingRoleId === m.membershipId}
													onChange={(e) =>
														handleRoleChange(m.membershipId, m.userId, e.target.value)
													}>
													{ROLE_OPTIONS.map((o) => (
														<option key={o.value} value={o.value}>
															{o.label}
														</option>
													))}
												</select>
												{savingRoleId === m.membershipId && (
													<Loader2 className="animate-spin text-rose-400" size={18} />
												)}
												{!isSelf && (
													<button
														type="button"
														onClick={() => setConfirmRemove({ userId: m.userId, label: display })}
														className="text-xs font-bold text-rose-700 hover:underline px-2">
														Quitar
													</button>
												)}
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.security && (
				<>
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
						<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
							<Lock size={20} className="text-rose-700" /> Acceso
						</h3>

						{isGoogleUser ? (
							<div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100 flex items-start gap-3">
								<ShieldAlert size={20} className="shrink-0 mt-0.5" />
								<div>
									<p className="font-bold">Cuenta vinculada a Google</p>
									<p className="opacity-80 mt-1">
										Has iniciado sesión con <strong>{email}</strong>. Para cambiar contraseña o correo, hazlo
										desde tu cuenta de Google.
									</p>
								</div>
							</div>
						) : (
							<div className="space-y-6 max-w-lg">
								<div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
									<label className="text-xs font-bold text-gray-500 uppercase block mb-2">
										Correo actual
									</label>
									<div className="relative">
										<Mail className="absolute left-3 top-3 text-gray-400" size={18} />
										<input
											disabled
											className="w-full pl-10 p-3 bg-gray-200 text-gray-500 rounded-xl border-transparent"
											value={email}
										/>
									</div>
									<div className="mt-4">
										<label className="text-xs font-bold text-gray-500 uppercase block mb-2">
											Nuevo correo
										</label>
										<div className="flex flex-col sm:flex-row gap-2">
											<input
												className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500 w-full"
												placeholder="nuevo@email.com"
												value={newEmail}
												onChange={(e) => setNewEmail(e.target.value)}
											/>
											<button
												onClick={handleUpdateEmail}
												disabled={loadingEmail || !newEmail || newEmail === email}
												className="bg-gray-900 text-white px-4 py-3 sm:py-0 rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50 w-full sm:w-auto">
												{loadingEmail ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Actualizar"}
											</button>
										</div>
										<p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
											<CheckCircle2 size={10} /> Te enviaremos un correo de confirmación.
										</p>
									</div>
								</div>

								<div className="border-t border-gray-100 pt-6">
									<h4 className="text-sm font-bold text-gray-700 mb-4">Nueva contraseña</h4>
									<div className="grid grid-cols-2 gap-4">
										<div className="col-span-2">
											<label className="text-xs font-bold text-gray-500 uppercase">Contraseña</label>
											<input
												type="password"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
												className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
												placeholder="Mínimo 6 caracteres"
											/>
										</div>
										<div className="col-span-2">
											<label className="text-xs font-bold text-gray-500 uppercase">Repetir</label>
											<input
												type="password"
												value={confirmPassword}
												onChange={(e) => setConfirmPassword(e.target.value)}
												className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
											/>
										</div>
									</div>
									<div className="flex justify-end pt-4">
										<button
											onClick={handleUpdatePassword}
											disabled={loadingPass || !password}
											className="bg-rose-50 text-rose-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center gap-2">
											{loadingPass ? <Loader2 className="animate-spin" size={16} /> : <ShieldAlert size={16} />}{" "}
											Actualizar contraseña
										</button>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl mb-4">
						<h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2">
							<AlertTriangle size={20} className="text-amber-600" /> Copia de seguridad
						</h3>
						<p className="text-sm text-amber-800/80 mb-4">
							Exporta datos de la clínica (JSON). Las fotos no se incluyen para reducir tamaño.
						</p>
						<button
							onClick={handleDownloadBackup}
							disabled={loadingBackup}
							className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 disabled:opacity-60">
							{loadingBackup ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
							{loadingBackup ? "Generando..." : "Descargar copia"}
						</button>
					</div>

					<div className="text-center pt-2">
						<button
							onClick={logout}
							className="text-rose-700 font-bold flex items-center gap-2 mx-auto hover:bg-rose-50 px-8 py-3 rounded-xl border border-transparent hover:border-rose-100">
							<LogOut size={18} /> Cerrar sesión
						</button>
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.audit && isAdmin && (
				<>
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
						<p className="text-sm text-gray-500 mb-4">
							Historial generado automáticamente al crear, modificar o eliminar registros en clientes,
							finanzas, citas, tratamientos, stock, equipo y datos de clínica. Solo administradores
							pueden ver esta lista.{" "}
							<strong className="text-gray-600">
								No incluye acciones anteriores a activar la auditoría:
							</strong>{" "}
							haz cualquier cambio de prueba (por ejemplo editar y guardar un cliente) y pulsa Actualizar.
						</p>
						{auditError?.message && (
							<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
								<p className="font-bold">No se pudo leer la auditoría</p>
								<p className="mt-1 font-mono text-xs break-all">{auditError.message}</p>
								<p className="mt-2 text-xs text-amber-800">
									Comprueba en Supabase → Table Editor que existe la tabla{" "}
									<code className="bg-white/80 px-1 rounded">audit_log</code> y revisa la consola del
									navegador (pestaña Red) por si la API devuelve 401 u otro error.
								</p>
							</div>
						)}
						<div className="flex justify-end mb-4">
							<button
								type="button"
								onClick={() => refreshAudit()}
								disabled={auditLoading}
								className="text-sm font-bold text-rose-700 hover:bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 disabled:opacity-50">
								{auditLoading ? "Cargando…" : "Actualizar"}
							</button>
						</div>
						<div className="rounded-xl border border-gray-100 overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
							{auditLoading && auditRows.length === 0 && !auditError ? (
								<p className="p-8 text-center text-gray-400 text-sm">Cargando eventos…</p>
							) : auditRows.length === 0 && !auditError ? (
								<div className="p-8 text-center text-gray-400 text-sm space-y-2">
									<p>
										Aún no hay filas en el registro: es normal justo después de crear la tabla.
									</p>
									<p>
										Los triggers solo guardan cambios{" "}
										<strong className="text-gray-600">a partir de ahora</strong>. Prueba a editar
										cualquier cliente o cita, vuelve aquí y pulsa Actualizar.
									</p>
								</div>
							) : auditRows.length === 0 && auditError ? (
								<p className="p-8 text-center text-gray-400 text-sm">Revisa el mensaje de error arriba.</p>
							) : (
								<table className="w-full min-w-[720px] text-left text-sm">
									<thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-[1]">
										<tr>
											<th className="px-3 py-2 whitespace-nowrap">Cuándo</th>
											<th className="px-3 py-2 whitespace-nowrap">Usuario</th>
											<th className="px-3 py-2 whitespace-nowrap">Acción</th>
											<th className="px-3 py-2 whitespace-nowrap">Entidad</th>
											<th className="px-3 py-2 min-w-[10rem]">Registro</th>
											<th className="px-3 py-2 min-w-[14rem]">Cambios</th>
										</tr>
									</thead>
									<tbody>
										{auditRows.map((r) => {
											const changeLines = auditChangesLines(r.metadata);
											const labelText =
												r.metadata?.label && String(r.metadata.label).trim()
													? r.metadata.label
													: r.summary;
											return (
												<tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/80 align-top">
													<td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
														{new Date(r.created_at).toLocaleString("es-ES")}
													</td>
													<td className="px-3 py-2 text-xs text-gray-700">
														{r.user_id ? (
															<>
																<span className="font-medium text-gray-800">
																	{auditActorLabels[r.user_id] || "…"}
																</span>
																<span className="mt-0.5 block text-[10px] text-gray-400 font-mono break-all">
																	{r.user_id}
																</span>
															</>
														) : (
															<span className="text-gray-400">—</span>
														)}
													</td>
													<td className="px-3 py-2 text-xs font-semibold text-rose-700 whitespace-nowrap">
														{auditActionLabel(r.action)}
													</td>
													<td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
														{auditEntityLabel(r.entity_type)}
													</td>
													<td className="px-3 py-2 text-xs text-gray-600">
														<p className="font-medium text-gray-800">{labelText}</p>
														{r.entity_id ? (
															<p className="mt-0.5 text-[10px] text-gray-400 font-mono break-all">
																ID: {r.entity_id}
															</p>
														) : null}
														{r.summary && r.summary !== labelText ? (
															<p className="mt-1 text-[11px] text-gray-500">{r.summary}</p>
														) : null}
													</td>
													<td className="px-3 py-2 text-xs text-gray-600">
														{changeLines.length > 0 ? (
															<ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug">
																{changeLines.map((line, i) => (
																	<li key={i}>{line}</li>
																))}
															</ul>
														) : (
															<span className="text-gray-400">
																{r.action === "update" ? "Sin diff (sin cambios reales)" : "—"}
															</span>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</div>
					</div>
				</>
			)}

			<ConfirmModal
				isOpen={Boolean(confirmRemove)}
				onCancel={() => setConfirmRemove(null)}
				onConfirm={() => confirmRemove && runRemoveMember(confirmRemove.userId)}
				title="Quitar del equipo"
				message={`Estás a punto de quitar a ${confirmRemove?.label ?? "este miembro"} del equipo.\n\nPerderá el acceso a los datos de esta clínica y pasará a la clínica por defecto del sistema.\n\n¿Confirmas la eliminación del acceso?`}
				isDestructive
				confirmLabel="Quitar del equipo"
			/>
		</div>
	);
};
