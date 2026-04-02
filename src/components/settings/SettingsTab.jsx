import React, { useState, useEffect } from "react";
import {
	User,
	Lock,
	Save,
	Loader2,
	ShieldAlert,
	Building2,
	Phone,
	FileText,
	MapPin,
	CreditCard,
	LogOut,
	Mail,
	CheckCircle2,
	Download,
	AlertTriangle,
	Plus,
	Trash2,
	Edit2,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { updateUserPassword, logout } from "../../services/auth";
import { exportUserBackup, downloadBackup } from "../../services/backupExport";
import { useTreatments } from "../../hooks/useTreatments";
import { useConsentTemplates } from "../../hooks/useConsentTemplates";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import ConsentEditor from "../consent/ConsentEditor";
import { CONSENT_VARIABLES } from "../../utils/consentGenerator";
import { uploadProfileAsset } from "../../services/profileAssetStorage";
import { useTenant } from "../../context/TenantContext";

export const SettingsTab = ({ user, profile, showToast }) => {
	const { clinicId } = useTenant();
	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		mobile: "",
		companyName: "",
		nif: "",
		collegiateNumber: "",
		address: "",
		city: "",
		logo_url: "",
		consent_signature_url: "",
	});

	// Estados para seguridad
	const [email, setEmail] = useState("");
	const [newEmail, setNewEmail] = useState("");

	// Cambio de contraseña
	const [currentPassword, setCurrentPassword] = useState(""); // Necesario para validar cambios sensibles
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [loadingProfile, setLoadingProfile] = useState(false);
	const [loadingPass, setLoadingPass] = useState(false);
	const [loadingEmail, setLoadingEmail] = useState(false);
	const [loadingBackup, setLoadingBackup] = useState(false);
	const [showConsentTplModal, setShowConsentTplModal] = useState(false);
	const [editingConsentTplId, setEditingConsentTplId] = useState(null);
	const [consentTplForm, setConsentTplForm] = useState({
		nombre: "",
		treatment_id: "",
		contenido: "",
	});
	const [savingConsentTpl, setSavingConsentTpl] = useState(false);

	const { treatments = [] } = useTreatments(user);
	const { consentTemplates = [], refreshConsentTemplates } = useConsentTemplates(user);

	const [isGoogleUser, setIsGoogleUser] = useState(false);

	useEffect(() => {
		if (user) {
			const isGoogle = user.app_metadata?.provider === "google";
			setIsGoogleUser(isGoogle);
			setEmail(user.email);
		}
	}, [user]);

	useEffect(() => {
		if (profile) {
			setFormData({
				name: profile.name || "",
				surname: profile.surname || "",
				mobile: profile.mobile || "",
				companyName: profile.company_name || "",
				nif: profile.nif || "",
				collegiateNumber: profile.collegiate_number || "",
				address: profile.address || "",
				city: profile.city || "",
				logo_url: profile.logo_url || "",
				consent_signature_url: profile.consent_signature_url || "",
			});
		}
	}, [profile]);

	const handleUpdateProfile = async () => {
		setLoadingProfile(true);
		try {
			const updates = {
				id: user.id,
				name: formData.name,
				surname: formData.surname,
				mobile: formData.mobile,
				company_name: formData.companyName,
				nif: formData.nif,
				collegiate_number: formData.collegiateNumber,
				address: formData.address,
				city: formData.city,
				logo_url: formData.logo_url || null,
				consent_signature_url: formData.consent_signature_url || null,
				email: user.email,
				updated_at: new Date(),
			};

			const { error } = await supabase.from("profiles").upsert(updates);

			if (error) throw error;
			showToast("Datos guardados correctamente");
		} catch (error) {
			console.error("Error saving profile:", error);
			showToast("Error al guardar datos", "error");
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
			showToast("Revisa tu nuevo correo para confirmar el cambio");
			setNewEmail("");
		} catch (error) {
			console.error(error);
			showToast("Error al actualizar email", "error");
		} finally {
			setLoadingEmail(false);
		}
	};

	const handleUpdatePassword = async () => {
		if (!password || !confirmPassword)
			return showToast("Rellena todos los campos", "error");
		if (password !== confirmPassword)
			return showToast("Las contraseñas no coinciden", "error");
		if (password.length < 6) return showToast("Mínimo 6 caracteres", "error");

		// Nota: Supabase permite cambiar la password sin la antigua si la sesión está activa,
		// pero por seguridad en el frontend a veces se pide re-autenticar.
		// Dado que no tenemos un endpoint fácil de "verificar password antigua" sin hacer logout,
		// confiaremos en la sesión activa actual.

		setLoadingPass(true);
		try {
			await updateUserPassword(password);
			showToast("Contraseña actualizada correctamente");
			setCurrentPassword("");
			setPassword("");
			setConfirmPassword("");
		} catch (e) {
			console.error(e);
			showToast("Error al actualizar contraseña", "error");
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
			showToast("Copia de seguridad descargada");
		} catch (err) {
			console.error(err);
			showToast("Error al generar la copia de seguridad", "error");
		} finally {
			setLoadingBackup(false);
		}
	};

	const openConsentTplModal = (tpl = null) => {
		if (tpl) {
			setEditingConsentTplId(tpl.id);
			setConsentTplForm({
				nombre: tpl.nombre || "",
				treatment_id: tpl.treatment_id || "",
				contenido: tpl.contenido || "",
			});
		} else {
			setEditingConsentTplId(null);
			setConsentTplForm({ nombre: "", treatment_id: "", contenido: "" });
		}
		setShowConsentTplModal(true);
	};

	const handleSaveConsentTpl = async (e) => {
		e.preventDefault();
		if (!user?.id || !consentTplForm.nombre?.trim()) {
			showToast("Nombre obligatorio", "error");
			return;
		}
		setSavingConsentTpl(true);
		try {
			const payload = {
				user_id: user.id,
				nombre: consentTplForm.nombre.trim(),
				treatment_id: consentTplForm.treatment_id?.trim() || null,
				contenido: consentTplForm.contenido?.trim() || "",
			};
			if (editingConsentTplId) {
				const { error } = await supabase
					.from("plantillas_consentimiento")
					.update(payload)
					.eq("id", editingConsentTplId);
				if (error) throw error;
				showToast("Plantilla actualizada");
			} else {
				const { error } = await supabase.from("plantillas_consentimiento").insert([payload]);
				if (error) throw error;
				showToast("Plantilla creada");
			}
			await refreshConsentTemplates();
			setShowConsentTplModal(false);
			setConsentTplForm({ nombre: "", treatment_id: "", contenido: "" });
			setEditingConsentTplId(null);
		} catch (err) {
			console.error(err);
			showToast("Error al guardar plantilla", "error");
		} finally {
			setSavingConsentTpl(false);
		}
	};

	const handleDeleteConsentTpl = async (id) => {
		try {
			const { error } = await supabase.from("plantillas_consentimiento").delete().eq("id", id);
			if (error) throw error;
			showToast("Plantilla eliminada");
			await refreshConsentTemplates();
		} catch (err) {
			showToast("Error al eliminar", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
			</div>

			{/* SECCIÓN 1: DATOS FACTURACIÓN (Igual que antes) */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<Building2 size={20} className="text-rose-500" /> Datos de Facturación
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="md:col-span-2">
						<label className="text-xs font-bold text-gray-500 uppercase">
							URL del Logo
						</label>
						<div className="flex gap-4 items-start mt-1">
							<input
								className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.logo_url}
								onChange={(e) =>
									setFormData({ ...formData, logo_url: e.target.value })
								}
								placeholder="https://..."
							/>
							{formData.logo_url && (
								<div className="shrink-0 w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
									<img
										src={formData.logo_url}
										alt="Logo"
										className="w-full h-full object-contain"
										onError={(e) => {
											e.target.style.display = "none";
										}}
									/>
								</div>
							)}
						</div>
						<p className="text-[10px] text-gray-500 mt-1">
							Puedes pegar una URL o subir desde el botón (se guarda en almacenamiento y rellena la URL).
						</p>
						<input
							type="file"
							accept="image/*"
							className="mt-2 text-sm text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-rose-50 file:text-rose-700 file:font-bold"
							onChange={async (e) => {
								const f = e.target.files?.[0];
								if (!f || !user?.id) return;
								try {
									const url = await uploadProfileAsset(user.id, f, "logo");
									if (url) {
										setFormData({ ...formData, logo_url: url });
										showToast("Logo subido; pulsa Guardar para persistir");
									}
								} catch (err) {
									showToast(err?.message || "Error al subir logo", "error");
								}
								e.target.value = "";
							}}
						/>
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-bold text-gray-500 uppercase">
							Firma profesional (consentimientos PDF)
						</label>
						<p className="text-[10px] text-gray-500 mt-0.5 mb-1">
							Se usa en todos los consentimientos generados, encima de la línea «Firma Profesional».
						</p>
						<div className="flex gap-4 items-start mt-1">
							<input
								className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.consent_signature_url}
								onChange={(e) =>
									setFormData({ ...formData, consent_signature_url: e.target.value })
								}
								placeholder="https://... (o sube imagen abajo)"
							/>
							{formData.consent_signature_url && (
								<div className="shrink-0 w-20 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
									<img
										src={formData.consent_signature_url}
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
										setFormData({ ...formData, consent_signature_url: url });
										showToast("Firma subida; pulsa Guardar para persistir");
									}
								} catch (err) {
									showToast(err?.message || "Error al subir firma", "error");
								}
								e.target.value = "";
							}}
						/>
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-bold text-gray-500 uppercase">
							Nombre Comercial
						</label>
						<div className="relative mt-1">
							<Building2
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.companyName}
								onChange={(e) =>
									setFormData({ ...formData, companyName: e.target.value })
								}
								placeholder="Ej: DermoClinic"
							/>
						</div>
					</div>
					<div>
						<label className="text-xs font-bold text-gray-500 uppercase">
							NIF / CIF
						</label>
						<div className="relative mt-1">
							<CreditCard
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.nif}
								onChange={(e) =>
									setFormData({ ...formData, nif: e.target.value })
								}
								placeholder="12345678X"
							/>
						</div>
					</div>
					<div>
						<label className="text-xs font-bold text-gray-500 uppercase">
							Nº Colegiado
						</label>
						<div className="relative mt-1">
							<FileText
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.collegiateNumber}
								onChange={(e) =>
									setFormData({ ...formData, collegiateNumber: e.target.value })
								}
							/>
						</div>
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-bold text-gray-500 uppercase">
							Dirección Fiscal
						</label>
						<div className="relative mt-1">
							<MapPin
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.address}
								onChange={(e) =>
									setFormData({ ...formData, address: e.target.value })
								}
								placeholder="Calle, Número..."
							/>
						</div>
					</div>
					<div>
						<label className="text-xs font-bold text-gray-500 uppercase">
							Ciudad / CP
						</label>
						<input
							className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
							value={formData.city}
							onChange={(e) =>
								setFormData({ ...formData, city: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-xs font-bold text-gray-500 uppercase">
							Teléfono
						</label>
						<div className="relative mt-1">
							<Phone
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
								value={formData.mobile}
								onChange={(e) =>
									setFormData({ ...formData, mobile: e.target.value })
								}
							/>
						</div>
					</div>
				</div>

				<div className="mt-6 pt-6 border-t border-gray-100">
					<h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
						Persona de Contacto
					</h4>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-xs font-bold text-gray-500 uppercase">
								Nombre
							</label>
							<input
								className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="text-xs font-bold text-gray-500 uppercase">
								Apellidos
							</label>
							<input
								className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
								value={formData.surname}
								onChange={(e) =>
									setFormData({ ...formData, surname: e.target.value })
								}
							/>
						</div>
					</div>
				</div>

				<div className="flex justify-end mt-6">
					<button
						onClick={handleUpdateProfile}
						disabled={loadingProfile}
						className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black flex items-center gap-2">
						{loadingProfile ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<Save size={16} />
						)}{" "}
						Guardar Datos
					</button>
				</div>
			</div>

			{/* SECCIÓN 2: SEGURIDAD (Diferenciada Google vs Email) */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<Lock size={20} className="text-rose-500" /> Cuenta y Seguridad
				</h3>

				{isGoogleUser ? (
					// BANNER PARA USUARIOS DE GOOGLE
					<div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100 flex items-start gap-3">
						<ShieldAlert size={20} className="shrink-0 mt-0.5" />
						<div>
							<p className="font-bold">Cuenta vinculada a Google Workspace</p>
							<p className="opacity-80 mt-1">
								Has iniciado sesión con <strong>{email}</strong>. Para cambiar
								tu contraseña o correo electrónico, debes hacerlo directamente
								desde tu cuenta de Google.
							</p>
						</div>
					</div>
				) : (
					// FORMULARIO PARA USUARIOS DE EMAIL
					<div className="space-y-6 max-w-lg">
						{/* Cambio de Email */}
						<div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
							<label className="text-xs font-bold text-gray-500 uppercase block mb-2">
								Correo Electrónico Actual
							</label>
							<div className="flex gap-2">
								<div className="relative flex-1">
									<Mail
										className="absolute left-3 top-3 text-gray-400"
										size={18}
									/>
									<input
										disabled
										className="w-full pl-10 p-3 bg-gray-200 text-gray-500 rounded-xl border-transparent"
										value={email}
									/>
								</div>
							</div>

							<div className="mt-4">
								<label className="text-xs font-bold text-gray-500 uppercase block mb-2">
									Cambiar Correo Electrónico
								</label>
								<div className="flex flex-col sm:flex-row gap-2">
									{" "}
									{/* CAMBIO AQUI: flex-col por defecto, row en sm */}
									<input
										className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-rose-500 w-full"
										placeholder="nuevo@email.com"
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
									/>
									<button
										onClick={handleUpdateEmail}
										disabled={loadingEmail || !newEmail || newEmail === email}
										className="bg-gray-900 text-white px-4 py-3 sm:py-0 rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50 transition-colors w-full sm:w-auto">
										{loadingEmail ? (
											<Loader2 className="animate-spin mx-auto" size={16} />
										) : (
											"Actualizar"
										)}
									</button>
								</div>
								<p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
									<CheckCircle2 size={10} /> Te enviaremos un email de
									confirmación.
								</p>
							</div>
						</div>

						{/* Cambio de Contraseña */}
						<div className="border-t border-gray-100 pt-6">
							<h4 className="text-sm font-bold text-gray-700 mb-4">
								Cambiar Contraseña
							</h4>

							{/* Nota: Supabase Auth gestiona la seguridad de la sesión actual. 
								Si quisiéramos validar la 'pass antigua' explícitamente, tendríamos que re-autenticar, 
								pero es complejo en el cliente. La práctica estándar aquí es confiar en la sesión activa. */}

							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2">
									<label className="text-xs font-bold text-gray-500 uppercase">
										Nueva Contraseña
									</label>
									<input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
										placeholder="Mínimo 6 caracteres"
									/>
								</div>
								<div className="col-span-2">
									<label className="text-xs font-bold text-gray-500 uppercase">
										Repetir Nueva Contraseña
									</label>
									<input
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-rose-500"
										placeholder="Repite la contraseña"
									/>
								</div>
							</div>
							<div className="flex justify-end pt-4">
								<button
									onClick={handleUpdatePassword}
									disabled={loadingPass || !password}
									className="bg-rose-50 text-rose-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center gap-2 transition-colors">
									{loadingPass ? (
										<Loader2 className="animate-spin" size={16} />
									) : (
										<ShieldAlert size={16} />
									)}{" "}
									Actualizar Contraseña
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* SECCIÓN: PLANTILLAS DE CONSENTIMIENTO */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<FileText size={20} className="text-rose-500" /> Plantillas de consentimiento informado
				</h3>
				<p className="text-sm text-gray-500 mb-4">
					Plantillas para generar PDFs desde la ficha del cliente. Puedes escribir con formato (negrita, listas), importar un Word (.docx) con variables tipo {"{{NOMBRE}}"}, {"{{FECHA}}"}, etc., o pegar desde Google Docs.
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
										onClick={() => openConsentTplModal(tpl)}
										className="p-2 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
										title="Editar">
										<Edit2 size={16} />
									</button>
									<button
										type="button"
										onClick={() => handleDeleteConsentTpl(tpl.id)}
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
					onClick={() => openConsentTplModal()}
					className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors">
					<Plus size={18} /> Añadir plantilla
				</button>
			</div>

			<AdaptiveModal
				isOpen={showConsentTplModal}
				onClose={() => {
					setShowConsentTplModal(false);
					setEditingConsentTplId(null);
					setConsentTplForm({ nombre: "", treatment_id: "", contenido: "" });
				}}
				title={editingConsentTplId ? "Editar plantilla" : "Nueva plantilla de consentimiento"}
				maxWidth="max-w-4xl">
				<form onSubmit={handleSaveConsentTpl} className="space-y-4">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nombre de la plantilla</label>
						<input
							required
							className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
							value={consentTplForm.nombre}
							onChange={(e) => setConsentTplForm({ ...consentTplForm, nombre: e.target.value })}
							placeholder="Ej: Consentimiento depilación láser"
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Tratamiento (opcional)</label>
						<select
							className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
							value={consentTplForm.treatment_id}
							onChange={(e) => setConsentTplForm({ ...consentTplForm, treatment_id: e.target.value })}>
							<option value="">— Genérica (cualquier tratamiento) —</option>
							{treatments.map((t) => (
								<option key={t.id} value={t.id}>{t.name}</option>
							))}
						</select>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Contenido (negrita, cursiva, listas; o importa un .docx)</label>
						<p className="text-[10px] text-gray-500 mb-2">
							Variables disponibles: {CONSENT_VARIABLES.join(", ")}
						</p>
						<ConsentEditor
							value={consentTplForm.contenido}
							onChange={(html) => setConsentTplForm({ ...consentTplForm, contenido: html })}
							placeholder="Yo, {{NOMBRE}} {{APELLIDOS}}, con DNI {{DNI}}..."
						/>
					</div>
					<div className="flex gap-2 pt-2">
						<button
							type="button"
							onClick={() => setShowConsentTplModal(false)}
							className="flex-1 py-3 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
							Cancelar
						</button>
						<button
							type="submit"
							disabled={savingConsentTpl || !consentTplForm.nombre?.trim()}
							className="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2">
							{savingConsentTpl ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
							{savingConsentTpl ? "Guardando..." : "Guardar"}
						</button>
					</div>
				</form>
			</AdaptiveModal>

			{/* ZONA DE PELIGRO / DATOS */}
			<div className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl">
				<h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2">
					<AlertTriangle size={20} className="text-amber-600" /> Zona de Datos
				</h3>
				<p className="text-sm text-amber-800/80 mb-4">
					Exporta todos tus datos (clientes, tratamientos, historial financiero,
					citas, inventario) en un archivo JSON. Las fotos no se incluyen para
					reducir el tamaño.
				</p>
				<button
					onClick={handleDownloadBackup}
					disabled={loadingBackup}
					className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 transition-colors disabled:opacity-60">
					{loadingBackup ? (
						<Loader2 size={18} className="animate-spin" />
					) : (
						<Download size={18} />
					)}
					{loadingBackup ? "Generando..." : "Descargar copia de seguridad"}
				</button>
			</div>

			<div className="text-center pt-8">
				<button
					onClick={logout}
					className="text-rose-500 font-bold flex items-center gap-2 mx-auto hover:bg-rose-50 px-8 py-3 rounded-xl transition-colors border border-transparent hover:border-rose-100">
					<LogOut size={18} /> Cerrar Sesión
				</button>
			</div>
		</div>
	);
};
