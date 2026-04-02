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
	ArrowLeft,
	ChevronRight,
	Users,
	UserPlus,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { updateUserPassword, logout } from "../../services/auth";
import { exportUserBackup, downloadBackup } from "../../services/backupExport";
import { uploadProfileAsset } from "../../services/profileAssetStorage";
import { useTenant } from "../../context/TenantContext";
import { ConfirmModal } from "../ui/ConfirmModal";

const SETTINGS_VIEWS = {
	hub: "hub",
	clinic: "clinic",
	me: "me",
	team: "team",
	security: "security",
};

const ROLE_OPTIONS = [
	{ value: "admin", label: "Administrador" },
	{ value: "staff_medico", label: "Staff médico" },
	{ value: "recepcion", label: "Recepción" },
];

export const SettingsTab = ({ user, profile, showToast }) => {
	const { clinicId, clinic, isAdmin, refreshTenant } = useTenant();

	const initialClinicForm = useMemo(
		() => ({
			name: clinic?.name || "",
			billing_nif: clinic?.billing_nif || "",
			billing_address: clinic?.billing_address || "",
			billing_city: clinic?.billing_city || "",
			billing_phone: clinic?.billing_phone || "",
			logo_url: clinic?.logo_url || "",
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

	const [view, setView] = useState(SETTINGS_VIEWS.hub);

	const [clinicForm, setClinicForm] = useState(initialClinicForm);
	const [profileForm, setProfileForm] = useState(initialProfileForm);

	const [email, setEmail] = useState("");
	const [newEmail, setNewEmail] = useState("");

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [loadingProfile, setLoadingProfile] = useState(false);
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
		if (!isAdmin && view === SETTINGS_VIEWS.team) setView(SETTINGS_VIEWS.hub);
	}, [isAdmin, view]);

	const goHub = () => setView(SETTINGS_VIEWS.hub);

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
			};
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

	const subHeader = (title) => (
		<div className="flex items-center gap-3 mb-6">
			<button
				type="button"
				onClick={goHub}
				className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
				aria-label="Volver">
				<ArrowLeft size={20} />
			</button>
			<h2 className="text-xl font-bold text-gray-800">{title}</h2>
		</div>
	);

	const hubCard = ({ id, icon: Icon, title, desc, onClick, badge }) => (
		<button
			type="button"
			key={id}
			onClick={onClick}
			className="w-full text-left bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-rose-200 hover:shadow-md transition-all flex items-center gap-4 group">
			<div className="shrink-0 w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-100">
				<Icon size={22} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<h3 className="font-bold text-gray-800">{title}</h3>
					{badge}
				</div>
				<p className="text-sm text-gray-500 mt-1">{desc}</p>
			</div>
			<ChevronRight className="shrink-0 text-gray-300 group-hover:text-rose-400" size={20} />
		</button>
	);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{view === SETTINGS_VIEWS.hub && (
				<>
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
					</div>
					<p className="text-sm text-gray-500 -mt-2">
						Elige un apartado. Los datos de clínica son comunes para todo el personal.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{hubCard({
							id: "clinic",
							icon: Building2,
							title: "Datos clínica",
							desc: "Nombre, facturación y logo compartidos.",
							onClick: () => setView(SETTINGS_VIEWS.clinic),
							badge: !isAdmin ? (
								<span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
									Solo lectura
								</span>
							) : null,
						})}
						{hubCard({
							id: "me",
							icon: User,
							title: "Mis datos",
							desc: "Tu nombre, contacto y firma en PDFs.",
							onClick: () => setView(SETTINGS_VIEWS.me),
						})}
						{isAdmin &&
							hubCard({
								id: "team",
								icon: Users,
								title: "Perfiles del equipo",
								desc: "Quién tiene acceso, roles e invitaciones.",
								onClick: () => setView(SETTINGS_VIEWS.team),
							})}
						{hubCard({
							id: "security",
							icon: Lock,
							title: "Cuenta y seguridad",
							desc: "Correo, contraseña, copia de seguridad y sesión.",
							onClick: () => setView(SETTINGS_VIEWS.security),
						})}
					</div>
				</>
			)}

			{view === SETTINGS_VIEWS.clinic && (
				<>
					{subHeader("Datos clínica")}
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
										placeholder="Ej: DermoClinic"
									/>
								</div>
							</div>
							<div className="md:col-span-2">
								<label className="text-xs font-bold text-gray-500 uppercase">URL del logo (clínica)</label>
								<div className="flex gap-4 items-start mt-1">
									<input
										disabled={!isAdmin}
										className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
										value={clinicForm.logo_url}
										onChange={(e) => setClinicForm({ ...clinicForm, logo_url: e.target.value })}
										placeholder="https://..."
									/>
									{clinicForm.logo_url && (
										<div className="shrink-0 w-20 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
											<img
												src={clinicForm.logo_url}
												alt="Logo"
												className="w-full h-full object-contain"
												onError={(e) => {
													e.target.style.display = "none";
												}}
											/>
										</div>
									)}
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

			{view === SETTINGS_VIEWS.me && (
				<>
					{subHeader("Mis datos")}
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
								<label className="text-xs font-bold text-gray-500 uppercase">Firma profesional (PDF consentimientos)</label>
								<p className="text-[10px] text-gray-500 mt-0.5 mb-1">Solo en documentos que generes tú.</p>
								<div className="flex gap-4 items-start mt-1">
									<input
										className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
										value={profileForm.consent_signature_url}
										onChange={(e) =>
											setProfileForm({ ...profileForm, consent_signature_url: e.target.value })
										}
										placeholder="https://... (o sube imagen abajo)"
									/>
									{profileForm.consent_signature_url && (
										<div className="shrink-0 w-20 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
											<img
												src={profileForm.consent_signature_url}
												alt="Firma"
												className="w-full h-full object-contain"
												onError={(e) => {
													e.target.style.display = "none";
												}}
											/>
										</div>
									)}
								</div>
								<input
									type="file"
									accept="image/*"
									className="mt-2 text-sm text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-rose-50 file:text-rose-700 file:font-bold"
									onChange={async (e) => {
										const f = e.target.files?.[0];
										if (!f || !user?.id) return;
										try {
											const url = await uploadProfileAsset(user.id, f, "signature");
											if (url) {
												setProfileForm({ ...profileForm, consent_signature_url: url });
												showToast?.("Firma subida; pulsa Guardar para persistir");
											}
										} catch (err) {
											showToast?.(err?.message || "Error al subir firma", "error");
										}
										e.target.value = "";
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
					{subHeader("Perfiles del equipo")}
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
						<h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
							<UserPlus size={16} className="text-rose-500" /> Añadir persona
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
								className="bg-rose-500 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2">
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
													<span className="text-[10px] font-bold text-rose-600 uppercase">Tú</span>
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
														className="text-xs font-bold text-rose-600 hover:underline px-2">
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
					{subHeader("Cuenta y seguridad")}
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
						<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
							<Lock size={20} className="text-rose-500" /> Acceso
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
											className="bg-rose-50 text-rose-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center gap-2">
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
							className="text-rose-500 font-bold flex items-center gap-2 mx-auto hover:bg-rose-50 px-8 py-3 rounded-xl border border-transparent hover:border-rose-100">
							<LogOut size={18} /> Cerrar sesión
						</button>
					</div>
				</>
			)}

			<ConfirmModal
				isOpen={Boolean(confirmRemove)}
				onCancel={() => setConfirmRemove(null)}
				onConfirm={() => confirmRemove && runRemoveMember(confirmRemove.userId)}
				title="Quitar del equipo"
				message={`¿Seguro que quieres quitar a ${confirmRemove?.label ?? ""}? Pasará a la clínica por defecto del sistema y perderá acceso a los datos de esta clínica.`}
				isDestructive
			/>
		</div>
	);
};
