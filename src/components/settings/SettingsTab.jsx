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
} from "lucide-react";
import { updateUserPassword, reauthenticate } from "../../services/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export const SettingsTab = ({ user, profile, showToast }) => {
	// --- ESTADOS ---
	const [formData, setFormData] = useState({
		// Datos Personales
		name: "",
		surname: "",
		mobile: "",
		// Datos Fiscales
		companyName: "",
		nif: "",
		collegiateNumber: "",
		address: "",
		city: "",
	});

	// Estados Contraseña
	const [currentPassword, setCurrentPassword] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	// Loaders y Flags
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [loadingPass, setLoadingPass] = useState(false);
	const [isGoogleUser, setIsGoogleUser] = useState(false);

	// --- EFECTOS ---

	// 1. Detectar usuario de Google
	useEffect(() => {
		if (user) {
			const isGoogle = user.providerData.some(
				(p) => p.providerId === "google.com",
			);
			setIsGoogleUser(isGoogle);
		}
	}, [user]);

	// 2. Cargar Perfil
	useEffect(() => {
		if (profile) {
			setFormData({
				name: profile.name || "",
				surname: profile.surname || "",
				mobile: profile.mobile || "",
				companyName: profile.companyName || "",
				nif: profile.nif || "",
				collegiateNumber: profile.collegiateNumber || "",
				address: profile.address || "",
				city: profile.city || "",
			});
		}
	}, [profile]);

	// --- MANEJADORES ---

	const handleUpdateProfile = async () => {
		setLoadingProfile(true);
		try {
			await setDoc(
				doc(db, `users/${user.uid}/settings/profile`),
				{
					...formData,
					id: "profile",
				},
				{ merge: true },
			);
			showToast("Datos guardados correctamente");
		} catch (error) {
			console.error(error);
			showToast("Error al guardar datos", "error");
		} finally {
			setLoadingProfile(false);
		}
	};

	const handleUpdatePassword = async () => {
		if (!currentPassword || !password || !confirmPassword)
			return showToast("Rellena todos los campos", "error");
		if (password !== confirmPassword)
			return showToast("Las contraseñas no coinciden", "error");
		if (password.length < 6) return showToast("Mínimo 6 caracteres", "error");

		setLoadingPass(true);
		try {
			await reauthenticate(user, currentPassword);
			await updateUserPassword(user, password);
			showToast("Contraseña actualizada");
			setCurrentPassword("");
			setPassword("");
			setConfirmPassword("");
		} catch (e) {
			showToast("Contraseña actual incorrecta", "error");
		} finally {
			setLoadingPass(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
			</div>

			{/* TARJETA 1: DATOS DE EMPRESA */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<Building2 size={20} className="text-rose-500" /> Datos de Facturación
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

				{/* Sub-sección Contacto */}
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
						)}
						Guardar Datos
					</button>
				</div>
			</div>

			{/* TARJETA 2: SEGURIDAD */}
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
					<Lock size={20} className="text-rose-500" /> Seguridad
				</h3>

				{!isGoogleUser ? (
					<div className="space-y-4 max-w-md">
						<div>
							<label className="text-xs font-bold text-gray-500 uppercase">
								Contraseña Actual
							</label>
							<input
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none bg-gray-50"
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Nueva
								</label>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none"
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-gray-500 uppercase">
									Repetir
								</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="w-full p-3 border border-gray-200 rounded-xl mt-1 outline-none"
								/>
							</div>
						</div>
						<div className="flex justify-end pt-2">
							<button
								onClick={handleUpdatePassword}
								disabled={loadingPass}
								className="bg-rose-50 text-rose-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center gap-2">
								{loadingPass ? (
									<Loader2 className="animate-spin" size={16} />
								) : (
									<ShieldAlert size={16} />
								)}{" "}
								Actualizar
							</button>
						</div>
					</div>
				) : (
					<div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100 flex items-center gap-3">
						<ShieldAlert size={20} />
						<div>
							<p className="font-bold">Cuenta vinculada a Google</p>
							<p className="opacity-80">
								La gestión de tu contraseña se realiza directamente a través de
								Google.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
