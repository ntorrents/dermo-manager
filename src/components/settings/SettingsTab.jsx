// /src/components/settings/SettingsTab.jsx
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
	CheckCircle2,
} from "lucide-react";
// Asegúrate de importar la nueva función reauthenticate
import { updateUserPassword, reauthenticate } from "../../services/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export const SettingsTab = ({ user, profile, showToast }) => {
	const [formData, setFormData] = useState({
		companyName: "",
		name: "",
		surname: "",
		collegiateNumber: "",
		mobile: "",
	});

	// Estados para contraseñas
	const [currentPassword, setCurrentPassword] = useState(""); // Nueva validación
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	// Estados de carga y lógica
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [loadingPass, setLoadingPass] = useState(false);
	const [isGoogleUser, setIsGoogleUser] = useState(false);

	// 1. Detectar si el usuario usa Google al cargar
	useEffect(() => {
		if (user) {
			// providerId para Google es 'google.com'
			const isGoogle = user.providerData.some(
				(provider) => provider.providerId === "google.com",
			);
			setIsGoogleUser(isGoogle);
		}
	}, [user]);

	useEffect(() => {
		if (profile && Object.keys(profile).length > 0) {
			setFormData({
				companyName: profile.companyName || "",
				name: profile.name || "",
				surname: profile.surname || "",
				collegiateNumber: profile.collegiateNumber || "",
				mobile: profile.mobile || "",
			});
		}
	}, [profile]);

	const handleUpdateProfile = async () => {
		setLoadingProfile(true);
		try {
			await setDoc(doc(db, `users/${user.uid}/settings/profile`), formData, {
				merge: true,
			});
			showToast("Perfil actualizado correctamente");
		} catch (error) {
			showToast("Error al guardar datos", error);
		} finally {
			setLoadingProfile(false);
		}
	};

	const handleUpdatePassword = async () => {
		// Validaciones básicas
		if (!currentPassword || !password || !confirmPassword) {
			showToast("Rellena todos los campos de contraseña", "error");
			return;
		}
		if (password.length < 6) {
			showToast("La nueva contraseña debe tener 6 caracteres", "error");
			return;
		}
		if (password !== confirmPassword) {
			showToast("Las contraseñas nuevas no coinciden", "error");
			return;
		}

		setLoadingPass(true);
		try {
			// 1. Re-autenticar (Verificar contraseña actual)
			await reauthenticate(user, currentPassword);

			// 2. Si pasa, actualizamos a la nueva
			await updateUserPassword(user, password);

			showToast("Contraseña actualizada con éxito");

			// Limpiar campos
			setCurrentPassword("");
			setPassword("");
			setConfirmPassword("");
		} catch (e) {
			console.error(e);
			// Manejo de errores específicos de Firebase
			if (
				e.code === "auth/invalid-credential" ||
				e.code === "auth/wrong-password"
			) {
				showToast("La contraseña actual es incorrecta", "error");
			} else {
				showToast("Error al actualizar contraseña", "error");
			}
		} finally {
			setLoadingPass(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in">
			<h2 className="text-2xl font-bold text-gray-800">Configuración</h2>

			{/* Datos Profesionales */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<User size={20} className="text-rose-500" /> Perfil Profesional
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="md:col-span-2">
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Nombre de la Empresa
						</label>
						<div className="relative">
							<Building2
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								type="text"
								value={formData.companyName}
								onChange={(e) =>
									setFormData({ ...formData, companyName: e.target.value })
								}
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
								placeholder="DermoApp"
							/>
						</div>
					</div>
					{/* Resto de inputs de perfil igual que antes... */}
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Nombre
						</label>
						<input
							type="text"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							className="w-full p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
						/>
					</div>
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Apellidos
						</label>
						<input
							type="text"
							value={formData.surname}
							onChange={(e) =>
								setFormData({ ...formData, surname: e.target.value })
							}
							className="w-full p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
						/>
					</div>
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Nº Colegiado
						</label>
						<div className="relative">
							<FileText
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								type="text"
								value={formData.collegiateNumber}
								onChange={(e) =>
									setFormData({ ...formData, collegiateNumber: e.target.value })
								}
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
							/>
						</div>
					</div>
					<div>
						<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
							Móvil
						</label>
						<div className="relative">
							<Phone
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								type="text"
								value={formData.mobile}
								onChange={(e) =>
									setFormData({ ...formData, mobile: e.target.value })
								}
								className="w-full pl-10 p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
							/>
						</div>
					</div>
				</div>

				<div className="flex justify-end mt-6">
					<button
						onClick={handleUpdateProfile}
						disabled={loadingProfile}
						className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black flex items-center gap-2 disabled:opacity-50">
						{loadingProfile ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<Save size={16} />
						)}
						Guardar Perfil
					</button>
				</div>
			</div>

			{/* Seguridad - Lógica Condicional Google vs Email */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<Lock size={20} className="text-rose-500" /> Seguridad
				</h3>

				{isGoogleUser ? (
					// --- VISTA PARA USUARIOS DE GOOGLE ---
					<div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
						<div className="bg-blue-100 p-2 rounded-full text-blue-600">
							<CheckCircle2 size={20} />
						</div>
						<div>
							<h4 className="font-bold text-blue-900 text-sm">
								Sesión iniciada con Google
							</h4>
							<p className="text-blue-700 text-xs mt-1">
								Tu cuenta está gestionada por Google. Para cambiar tu
								contraseña, debes hacerlo desde la configuración de tu cuenta de
								Google.
							</p>
						</div>
					</div>
				) : (
					// --- VISTA PARA USUARIOS DE EMAIL (CON CAMPO ACTUAL) ---
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
								Contraseña Actual
							</label>
							<input
								type="password"
								placeholder="Escribe tu contraseña actual para verificar"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								className="w-full p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none bg-gray-50"
							/>
						</div>
						<div className="border-t border-gray-100 my-4"></div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
									Nueva Contraseña
								</label>
								<input
									type="password"
									placeholder="Mínimo 6 caracteres"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
								/>
							</div>
							<div>
								<label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
									Confirmar Nueva
								</label>
								<input
									type="password"
									placeholder="Repite la nueva contraseña"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="w-full p-3 border border-gray-200 rounded-xl focus:border-rose-500 outline-none"
								/>
							</div>
						</div>
						<div className="flex justify-end mt-2">
							<button
								onClick={handleUpdatePassword}
								disabled={loadingPass || !currentPassword || !password}
								className="bg-rose-50 text-rose-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
								{loadingPass ? (
									<Loader2 className="animate-spin" size={16} />
								) : (
									<ShieldAlert size={16} />
								)}
								Actualizar Contraseña
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
