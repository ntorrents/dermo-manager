import React, { useState } from "react";
import {
	Search,
	Plus,
	Users,
	Trash2,
	Edit2,
	FileText,
	UserPlus,
	X,
	Clock,
	Check,
	ExternalLink,
	FileDown,
	Camera,
	User,
	Stethoscope,
	Shield,
	RotateCcw,
	MessageCircle,
	Ticket,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useClientHistory } from "../../hooks/useClientHistory";
import { useSessionPhotos } from "../../hooks/useSessionPhotos";
import { useClientBonos } from "../../hooks/useBonos";
import { formatCurrency } from "../../utils/format";
import { generateInvoice } from "../../utils/invoiceGenerator";
import { calculateTaxReverse } from "../../utils/calculations";
import { getNextRectifiedInvoiceNumber } from "../../services/invoiceSeries";
import { ConfirmModal } from "../ui/ConfirmModal";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { PhotoUploadModal } from "../photos/PhotoUploadModal";
import { PhotoEditModal } from "../photos/PhotoEditModal";
import { BeforeAfterViewer } from "../photos/BeforeAfterViewer";
import { SessionPhotoThumbnail } from "../photos/SessionPhotoThumbnail";
import { deleteSessionPhoto } from "../../services/photoStorage";

const buildWhatsAppUrl = (phone, firstName, companyName = "C3linic") => {
	if (!phone || !String(phone).trim()) return null;
	const digits = String(phone).replace(/\D/g, "");
	const num = digits.startsWith("34") ? digits : "34" + digits;
	const msg = `Hola ${firstName || "cliente"}, te escribo desde ${companyName} para recordarte tu cita...`;
	return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
};

export const ClientsTab = ({
	user,
	clients = [],
	profile,
	showToast,
	onRefresh,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState(null);
	const [clientDetailTab, setClientDetailTab] = useState("filiacion");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		phone: "",
		email: "",
		nif: "",
		origin: "",
		notes: "",
		allergies: "",
		medical_history: "",
		has_consent: false,
		has_image_rights: false,
		drive_url: "",
	});

	// ESTADOS PARA EL MODAL DE BORRADO
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [clientToDelete, setClientToDelete] = useState(null);
	const [savingClient, setSavingClient] = useState(false);
	const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
	const [photoUploadSession, setPhotoUploadSession] = useState(null);
	const [showPhotoDeleteModal, setShowPhotoDeleteModal] = useState(false);
	const [photoToDelete, setPhotoToDelete] = useState(null);
	const [showPhotoEditModal, setShowPhotoEditModal] = useState(false);
	const [photoToEdit, setPhotoToEdit] = useState(null);
	const [viewerSession, setViewerSession] = useState(null);
	const [showRefundModal, setShowRefundModal] = useState(false);
	const [sessionToRefund, setSessionToRefund] = useState(null);
	const [refundAmount, setRefundAmount] = useState("");
	const [processingRefund, setProcessingRefund] = useState(false);

	const {
		history,
		loading: historyLoading,
		refetch: refetchHistory,
	} = useClientHistory(selectedClient?.id);
	const { photos, refreshPhotos } = useSessionPhotos(
		selectedClient?.id,
		user?.id,
	);
	const { data: clientBonos = [], isLoading: bonosLoading } = useClientBonos(
		user?.id,
		selectedClient?.id,
	);

	const filteredClients = clients.filter(
		(c) =>
			c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.phone?.includes(searchTerm),
	);

	const handleOpenModal = (client = null) => {
		if (client) {
			setFormData({
				name: client.name || "",
				surname: client.surname || "",
				phone: client.phone || "",
				email: client.email || "",
				nif: client.nif || "",
				origin: client.origin || "",
				notes: client.notes || "",
				allergies: client.allergies || "",
				medical_history: client.medical_history || "",
				has_consent: client.has_consent ?? false,
				has_image_rights: client.has_image_rights ?? false,
				drive_url: client.drive_url || "",
			});
			setSelectedClient(client);
		} else {
			setFormData({
				name: "",
				surname: "",
				phone: "",
				email: "",
				nif: "",
				origin: "",
				notes: "",
				allergies: "",
				medical_history: "",
				has_consent: false,
				has_image_rights: false,
				drive_url: "",
			});
			setSelectedClient(null);
		}
		setIsModalOpen(true);
	};

	const handleSaveClient = async (e) => {
		e.preventDefault();
		setSavingClient(true);
		try {
			const payload = {
				...formData,
				user_id: user.id,
				nif: formData.nif?.trim() || null,
				origin: formData.origin || null,
				allergies: formData.allergies?.trim() || null,
				medical_history: formData.medical_history?.trim() || null,
				has_consent: formData.has_consent,
				has_image_rights: formData.has_image_rights,
				drive_url: formData.drive_url?.trim() || null,
			};
			if (selectedClient && isModalOpen) {
				const { error } = await supabase
					.from("clients")
					.update(payload)
					.eq("id", selectedClient.id);
				if (error) throw error;
				showToast("Cliente actualizado");
				setSelectedClient({ ...selectedClient, ...payload });
			} else {
				const { error } = await supabase.from("clients").insert([payload]);
				if (error) throw error;
				showToast("Cliente creado");
			}
			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al guardar cliente", "error");
		} finally {
			setSavingClient(false);
		}
	};

	const handleDeleteClick = (e, client) => {
		e.stopPropagation();
		setClientToDelete(client);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!clientToDelete) return;
		try {
			const { error } = await supabase
				.from("clients")
				.delete()
				.eq("id", clientToDelete.id);
			if (error) throw error;
			showToast("Cliente eliminado");
			if (selectedClient?.id === clientToDelete.id) setSelectedClient(null);
			if (onRefresh) await onRefresh();
		} catch {
			showToast("Error al eliminar", "error");
		} finally {
			setShowDeleteModal(false);
			setClientToDelete(null);
		}
	};

	const handlePhotoDelete = (photo) => {
		setPhotoToDelete(photo);
		setShowPhotoDeleteModal(true);
	};

	const confirmPhotoDelete = async () => {
		if (!photoToDelete) return;
		try {
			await deleteSessionPhoto(photoToDelete);
			refreshPhotos();
			showToast("Foto eliminada");
		} catch {
			showToast("Error al eliminar foto", "error");
		} finally {
			setShowPhotoDeleteModal(false);
			setPhotoToDelete(null);
		}
	};

	const handlePhotoEdit = (photo) => {
		setPhotoToEdit(photo);
		setShowPhotoEditModal(true);
	};

	const handlePhotoSuccess = (err) => {
		refreshPhotos();
		if (!err) showToast("Foto guardada");
		else showToast("Error al subir", "error");
	};

	const handlePhotoEditSuccess = (err) => {
		refreshPhotos();
		if (!err) showToast("Foto actualizada");
		else showToast("Error al actualizar", "error");
	};

	const openRefundModal = (session) => {
		setSessionToRefund(session);
		setRefundAmount(String(Number(session.amount) || ""));
		setShowRefundModal(true);
	};

	const confirmRefund = async () => {
		if (!sessionToRefund || !selectedClient || !user) return;
		const amount = Number(refundAmount);
		const maxRefund = Number(sessionToRefund.amount) || 0;
		if (!amount || amount <= 0 || amount > maxRefund) {
			showToast(
				"Importe no válido (máx. " + formatCurrency(maxRefund) + ")",
				"error",
			);
			return;
		}
		setProcessingRefund(true);
		try {
			const { baseAmount, taxAmount } = calculateTaxReverse(amount, 21);
			const today = new Date().toISOString().slice(0, 10);
			const year = today.slice(0, 4);
			let invoiceNumber = null;
			try {
				invoiceNumber = await getNextRectifiedInvoiceNumber(user.id, year);
			} catch {
				// Serie R no disponible
			}
			const { data: inserted, error } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: user.id,
						date: today,
						type: "income",
						category: "Servicio",
						description: "Abono: " + (sessionToRefund.description || "Sesión"),
						amount: -amount,
						total_amount: -amount,
						tax_rate: 21,
						tax_base: -baseAmount,
						tax_amount: -taxAmount,
						invoice_number: invoiceNumber,
						client_id: selectedClient.id,
					},
				])
				.select()
				.single();
			if (error) throw error;
			await generateInvoice(inserted, selectedClient, profile, null, {
				isAbono: true,
			});
			showToast("Abono generado y guardado");
			refetchHistory();
			if (onRefresh) await onRefresh();
			setShowRefundModal(false);
			setSessionToRefund(null);
			setRefundAmount("");
		} catch (err) {
			showToast(err?.message || "Error al crear abono", "error");
		} finally {
			setProcessingRefund(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0 h-[calc(100vh-120px)] md:h-auto flex flex-col md:flex-row gap-6">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Cliente"
				message={`¿Seguro que quieres eliminar a ${clientToDelete?.name}? Se perderá todo su historial.`}
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>
			<ConfirmModal
				isOpen={showPhotoDeleteModal}
				title="Eliminar foto"
				message="¿Eliminar esta foto del historial? Esta acción no se puede deshacer."
				onConfirm={confirmPhotoDelete}
				onCancel={() => setShowPhotoDeleteModal(false)}
				isDestructive={true}
			/>

			{/* LISTA DE CLIENTES: Se oculta en móvil si hay uno seleccionado */}
			<div
				className={`flex-1 min-w-0 bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col ${
					selectedClient ? "hidden md:flex" : "flex"
				}`}>
				<div className="p-6 border-b border-gray-50 flex flex-col gap-4">
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
							<Users className="text-rose-500" /> Clientes
						</h2>
						<span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
							{clients.length}
						</span>
					</div>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search
								className="absolute left-3 top-3 text-gray-400"
								size={18}
							/>
							<input
								placeholder="Buscar..."
								className="w-full pl-10 p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl outline-none font-bold text-gray-700"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
						<button
							onClick={() => handleOpenModal()}
							className="bg-gray-900 text-white p-3 rounded-xl hover:bg-black shadow-lg">
							<Plus size={20} />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto custom-scrollbar p-2">
					{filteredClients.length === 0 ? (
						<EmptyState
							icon={Users}
							title={searchTerm ? "Sin resultados" : "No hay clientes"}
							description={
								searchTerm
									? "Prueba con otro término de búsqueda"
									: "Añade tu primer cliente para empezar a gestionar citas y facturación."
							}
							actionLabel={searchTerm ? undefined : "Añadir cliente"}
							onAction={searchTerm ? undefined : () => handleOpenModal()}
						/>
					) : (
						<div className="space-y-2">
							{filteredClients.map((client) => (
								<div
									key={client.id}
									onClick={() => setSelectedClient(client)}
									className={`p-4 rounded-2xl cursor-pointer transition-all border ${
										selectedClient?.id === client.id
											? "bg-rose-50 border-rose-200 shadow-sm"
											: "bg-white border-transparent hover:bg-gray-50"
									}`}>
									<div className="flex justify-between items-start">
										<div className="flex items-center gap-3 flex-1 min-w-0">
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
													selectedClient?.id === client.id
														? "bg-rose-200 text-rose-700"
														: "bg-gray-100 text-gray-500"
												}`}>
												{client.name.charAt(0)}
											</div>
											<div className="min-w-0 flex-1">
												<h4
													className={`font-bold ${
														selectedClient?.id === client.id
															? "text-rose-900"
															: "text-gray-800"
													}`}>
													{client.name} {client.surname}
												</h4>
												<div className="flex items-center gap-1.5">
													<p className="text-xs text-gray-400">
														{client.phone || "Sin tlf"}
													</p>
													{client.phone && (
														<a
															href={buildWhatsAppUrl(
																client.phone,
																client.name,
																profile?.company_name,
															)}
															target="_blank"
															rel="noopener noreferrer"
															onClick={(e) => e.stopPropagation()}
															className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
															title="Abrir WhatsApp">
															<MessageCircle size={14} />
														</a>
													)}
												</div>
												<div className="flex items-center gap-2 mt-1.5 flex-wrap">
													<span
														className="inline-flex items-center gap-0.5 text-[10px] font-bold"
														title="Consentimiento">
														{client.has_consent ? (
															<Check size={12} className="text-emerald-500" />
														) : (
															<X size={12} className="text-gray-400" />
														)}
														<span className="text-gray-500">Cons.</span>
													</span>
													<span
														className="inline-flex items-center gap-0.5 text-[10px] font-bold"
														title="Derechos de imagen">
														{client.has_image_rights ? (
															<Check size={12} className="text-emerald-500" />
														) : (
															<X size={12} className="text-gray-400" />
														)}
														<span className="text-gray-500">Imagen</span>
													</span>
													{client.drive_url && (
														<a
															href={client.drive_url}
															target="_blank"
															rel="noopener noreferrer"
															onClick={(e) => e.stopPropagation()}
															className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700"
															title="Abrir carpeta en Drive">
															<ExternalLink size={12} />
															Ver Drive
														</a>
													)}
												</div>
											</div>
										</div>
										<button
											onClick={(e) => handleDeleteClick(e, client)}
											className="p-2 text-gray-300 hover:text-rose-500 shrink-0"
											title="Eliminar cliente">
											<Trash2 size={16} />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* DETALLE CLIENTE (Panel derecho) */}
			<div
				className={`flex-[2] min-w-0 bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col ${
					selectedClient ? "flex" : "hidden md:flex"
				}`}>
				{selectedClient ? (
					<>
						<div className="p-6 xl:p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-start">
							<div className="flex items-center gap-4">
								<button
									onClick={() => setSelectedClient(null)}
									className="md:hidden p-2 -ml-2 text-gray-400">
									<X size={24} />
								</button>
								<div className="w-12 h-12 xl:w-16 xl:h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-2xl flex items-center justify-center text-white text-xl xl:text-2xl font-black shadow-lg shadow-rose-100">
									{selectedClient.name.charAt(0)}
								</div>
								<div>
									<h2 className="text-xl xl:text-3xl font-black text-gray-800 tracking-tight">
										{selectedClient.name} {selectedClient.surname}
									</h2>
									<div className="flex items-center gap-2 mt-1">
										<p className="text-sm font-bold text-gray-500">
											{selectedClient.phone}
										</p>
										{selectedClient.phone && (
											<a
												href={buildWhatsAppUrl(
													selectedClient.phone,
													selectedClient.name,
													profile?.company_name,
												)}
												target="_blank"
												rel="noopener noreferrer"
												className="p-2 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
												title="Abrir WhatsApp">
												<MessageCircle size={18} />
											</a>
										)}
									</div>
								</div>
							</div>
							<button
								onClick={() => handleOpenModal(selectedClient)}
								className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-rose-600 transition-all shadow-sm"
								title="Editar cliente">
								<Edit2 size={18} />
							</button>
						</div>

						{/* Pestañas perfil 360º */}
						<div className="flex border-b border-gray-100 bg-white px-4 gap-1 overflow-x-auto">
							{[
								{ id: "filiacion", label: "Filiación", icon: User },
								{ id: "medico", label: "Médico", icon: Stethoscope },
								{ id: "legal", label: "Legal", icon: Shield },
								{ id: "bonos", label: "Bonos", icon: Ticket },
								{ id: "historial", label: "Historial", icon: Clock },
							].map(({ id, label, icon: Icon }) => (
								<button
									key={id}
									type="button"
									onClick={() => setClientDetailTab(id)}
									className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
										clientDetailTab === id
											? "border-rose-500 text-rose-600"
											: "border-transparent text-gray-400 hover:text-gray-600"
									}`}>
									<Icon size={16} />
									{label}
								</button>
							))}
						</div>

						<div className="flex-1 overflow-y-auto p-6 xl:p-8 custom-scrollbar bg-gray-50/30">
							{clientDetailTab === "filiacion" && (
								<div className="space-y-6">
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<User size={14} /> Datos personales
									</h3>
									<dl className="space-y-3 text-sm">
										<div>
											<dt className="text-[10px] font-black text-gray-400 uppercase">
												Nombre
											</dt>
											<dd className="font-bold text-gray-800">
												{selectedClient.name} {selectedClient.surname}
											</dd>
										</div>
										{selectedClient.phone && (
											<div>
												<dt className="text-[10px] font-black text-gray-400 uppercase">
													Teléfono
												</dt>
												<dd className="font-bold text-gray-800">
													{selectedClient.phone}
												</dd>
											</div>
										)}
										{selectedClient.email && (
											<div>
												<dt className="text-[10px] font-black text-gray-400 uppercase">
													Email
												</dt>
												<dd className="font-bold text-gray-800">
													{selectedClient.email}
												</dd>
											</div>
										)}
										<div>
											<dt className="text-[10px] font-black text-gray-400 uppercase">
												NIF/CIF
											</dt>
											<dd className="font-bold text-gray-800">
												{selectedClient.nif || "—"}
											</dd>
										</div>
										<div>
											<dt className="text-[10px] font-black text-gray-400 uppercase">
												Origen
											</dt>
											<dd className="font-bold text-gray-800">
												{selectedClient.origin === "instagram"
													? "Instagram"
													: selectedClient.origin === "google"
														? "Google"
														: selectedClient.origin === "recommendation"
															? "Recomendación"
															: selectedClient.origin === "other"
																? "Otro"
																: selectedClient.origin || "—"}
											</dd>
										</div>
										{selectedClient.notes && (
											<div>
												<dt className="text-[10px] font-black text-gray-400 uppercase">
													Notas
												</dt>
												<dd className="font-medium text-gray-700">
													{selectedClient.notes}
												</dd>
											</div>
										)}
									</dl>
								</div>
							)}

							{clientDetailTab === "medico" && (
								<div className="space-y-6">
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<Stethoscope size={14} /> Datos médicos
									</h3>
									<div>
										<dt className="text-[10px] font-black text-gray-400 uppercase mb-1">
											Alergias
										</dt>
										<dd
											className={`p-4 rounded-2xl text-sm font-medium ${
												selectedClient.allergies
													? "bg-red-50 border-2 border-red-200 text-red-900"
													: "bg-gray-50 text-gray-500 border border-gray-100"
											}`}>
											{selectedClient.allergies || "Ninguna indicada"}
										</dd>
									</div>
									<div>
										<dt className="text-[10px] font-black text-gray-400 uppercase mb-1">
											Antecedentes
										</dt>
										<dd className="p-4 bg-gray-50 rounded-2xl text-sm font-medium text-gray-700 border border-gray-100 min-h-[80px]">
											{selectedClient.medical_history || "—"}
										</dd>
									</div>
								</div>
							)}

							{clientDetailTab === "legal" && (
								<div className="space-y-6">
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<Shield size={14} /> Consentimientos
									</h3>
									<div className="flex flex-col gap-4">
										<div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
											{selectedClient.has_consent ? (
												<Check
													size={22}
													className="text-emerald-500 shrink-0"
												/>
											) : (
												<X size={22} className="text-gray-400 shrink-0" />
											)}
											<span className="font-bold text-gray-800">
												RGPD firmada
											</span>
										</div>
										<div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
											{selectedClient.has_image_rights ? (
												<Check
													size={22}
													className="text-emerald-500 shrink-0"
												/>
											) : (
												<X size={22} className="text-gray-400 shrink-0" />
											)}
											<span className="font-bold text-gray-800">
												Derechos de imagen
											</span>
										</div>
										{selectedClient.drive_url && (
											<a
												href={selectedClient.drive_url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">
												<ExternalLink size={16} /> Carpeta Drive
											</a>
										)}
									</div>
								</div>
							)}

							{clientDetailTab === "bonos" && (
								<div className="space-y-6">
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<Ticket size={14} /> Bonos adquiridos
									</h3>
									{bonosLoading ? (
										<div className="space-y-3">
											{[1, 2].map((i) => (
												<div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
											))}
										</div>
									) : clientBonos.length === 0 ? (
										<div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center">
											<p className="text-sm font-medium text-gray-500">
												Este paciente no tiene bonos registrados.
											</p>
											<p className="text-xs text-gray-400 mt-1">
												Vende un bono desde la pestaña Bonos.
											</p>
										</div>
									) : (
										<div className="space-y-3">
											{clientBonos.map((bono) => {
												const name = bono.bonus_templates?.name ?? "Bono";
												const treatmentName = bono.treatments?.name ?? "";
												const used = Number(bono.used_sessions) ?? 0;
												const total = Number(bono.total_sessions) ?? 0;
												const isExhausted = bono.status === "exhausted";
												const pct = total > 0 ? Math.round((used / total) * 100) : 0;
												return (
													<div
														key={bono.id}
														className={`p-4 rounded-2xl border shadow-sm ${
															isExhausted
																? "bg-gray-50 border-gray-100"
																: "bg-white border-rose-100"
														}`}>
														<div className="flex justify-between items-start gap-2">
															<div>
																<p className="font-bold text-gray-900">{name}</p>
																{treatmentName && (
																	<p className="text-xs text-gray-500">{treatmentName}</p>
																)}
															</div>
															<span
																className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
																	isExhausted
																		? "bg-gray-200 text-gray-600"
																		: "bg-rose-100 text-rose-700"
																}`}>
																{isExhausted ? "Agotado" : "Activo"}
															</span>
														</div>
														<p className="text-xs font-medium text-gray-600 mt-2">
															Consumidas: {used} de {total} sesiones
														</p>
														<div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
															<div
																className={`h-full rounded-full transition-all ${
																	isExhausted ? "bg-gray-400" : "bg-rose-500"
																}`}
																style={{ width: `${Math.min(pct, 100)}%` }}
															/>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>
							)}

							{clientDetailTab === "historial" && (
								<>
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
										<Clock size={14} /> Tratamientos previos
									</h3>

									{historyLoading ? (
										<div className="space-y-4">
											{[1, 2].map((i) => (
												<div
													key={i}
													className="h-24 bg-gray-100 rounded-2xl animate-pulse"
												/>
											))}
										</div>
									) : history.length > 0 ? (
										<div className="space-y-4">
											{history.map((session) => {
												const sessionPhotos = photos.filter(
													(p) => p.finance_entry_id === session.id,
												);
												const beforePhoto = sessionPhotos.find(
													(p) => p.type === "before",
												);
												const afterPhoto = sessionPhotos.find(
													(p) => p.type === "after",
												);

												return (
													<div
														key={session.id}
														className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-rose-100 transition-all">
														<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
															<div className="flex items-start gap-4 flex-1 min-w-0">
																<div className="flex flex-col items-center justify-center w-12 h-12 bg-rose-50 rounded-xl text-rose-500 font-bold border border-rose-100 shrink-0">
																	<span className="text-sm leading-none">
																		{new Date(session.date).getDate()}
																	</span>
																	<span className="text-[9px] uppercase">
																		{new Date(session.date).toLocaleString(
																			"es-ES",
																			{ month: "short" },
																		)}
																	</span>
																</div>
																<div className="min-w-0 flex-1">
																	<h4 className="font-bold text-gray-800 text-sm xl:text-lg">
																		{session.description?.split("(")[0] ||
																			"Sesión"}
																	</h4>
																	<p className="text-[10px] text-gray-400 font-medium uppercase">
																		{session.date}
																		{session.plan_amigo && " • Plan Amigo (sin factura)"}
																	</p>
																	{/* Miniaturas de fotos integradas */}
																	<div className="flex items-center gap-2 mt-3 flex-wrap">
																		{beforePhoto && (
																			<SessionPhotoThumbnail
																				photo={beforePhoto}
																				label="Antes"
																				onView={() =>
																					setViewerSession({
																						session,
																						before: beforePhoto,
																						after: afterPhoto,
																					})
																				}
																				onEdit={handlePhotoEdit}
																				onDelete={handlePhotoDelete}
																			/>
																		)}
																		{afterPhoto && (
																			<SessionPhotoThumbnail
																				photo={afterPhoto}
																				label="Después"
																				onView={() =>
																					setViewerSession({
																						session,
																						before: beforePhoto,
																						after: afterPhoto,
																					})
																				}
																				onEdit={handlePhotoEdit}
																				onDelete={handlePhotoDelete}
																			/>
																		)}
																		<button
																			onClick={() => {
																				setPhotoUploadSession(session);
																				setShowPhotoUploadModal(true);
																			}}
																			className="w-16 h-20 rounded-lg border-2 border-dashed border-gray-200 hover:border-rose-300 hover:bg-rose-50/50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors shrink-0"
																			title="Añadir foto">
																			<Camera size={20} />
																		</button>
																	</div>
																</div>
															</div>
															<div className="flex items-center gap-3 shrink-0">
																{!session.plan_amigo && (
																	<button
																		onClick={async () => {
																			try {
																				await generateInvoice(
																					session,
																					selectedClient,
																					profile,
																					profile?.logo_url,
																				);
																				showToast("Factura generada");
																			} catch {
																				showToast(
																					"Error al generar factura",
																					"error",
																				);
																			}
																		}}
																		className="p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
																		title="Generar factura">
																		<FileDown size={18} />
																	</button>
																)}
																{Number(session.amount) > 0 && (
																	<button
																		onClick={() => openRefundModal(session)}
																		className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
																		title="Rectificar / Devolución">
																		<RotateCcw size={18} />
																	</button>
																)}
																<div className="text-right">
																	<span className="block font-black text-gray-800 text-lg xl:text-xl">
																		{formatCurrency(session.amount)}
																	</span>
																	<span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
																		Pagado
																	</span>
																</div>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center h-40 text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl">
											<FileText size={32} className="mb-2 opacity-50" />
											<p className="font-bold text-sm">Sin historial previo</p>
										</div>
									)}
								</>
							)}
						</div>
					</>
				) : (
					<div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
						<UserPlus size={40} className="opacity-20 mb-4" />
						<h3 className="text-xl font-black text-gray-400">
							Selecciona un cliente
						</h3>
					</div>
				)}
			</div>

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={selectedClient ? "Editar Cliente" : "Nuevo Cliente"}
				maxWidth="max-w-lg">
				<form onSubmit={handleSaveClient} className="space-y-5">
					<div className="grid grid-cols-2 gap-4">
						<input
							required
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
							placeholder="Nombre"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
						/>
						<input
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
							placeholder="Apellidos"
							value={formData.surname}
							onChange={(e) =>
								setFormData({ ...formData, surname: e.target.value })
							}
						/>
					</div>
					<input
						type="tel"
						className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
						placeholder="Teléfono"
						value={formData.phone}
						onChange={(e) =>
							setFormData({ ...formData, phone: e.target.value })
						}
					/>
					<input
						type="email"
						className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
						placeholder="Email (Opcional)"
						value={formData.email}
						onChange={(e) =>
							setFormData({ ...formData, email: e.target.value })
						}
					/>
					<input
						type="text"
						className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
						placeholder="NIF/CIF (obligatorio para facturación)"
						value={formData.nif}
						onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
					/>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Origen
						</label>
						<select
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
							value={formData.origin}
							onChange={(e) =>
								setFormData({ ...formData, origin: e.target.value })
							}>
							<option value="">— Seleccionar —</option>
							<option value="instagram">Instagram</option>
							<option value="google">Google</option>
							<option value="recommendation">Recomendación</option>
							<option value="other">Otro</option>
						</select>
					</div>
					<textarea
						rows="2"
						className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold resize-none"
						placeholder="Notas privadas..."
						value={formData.notes}
						onChange={(e) =>
							setFormData({ ...formData, notes: e.target.value })
						}
					/>
					<div>
						<label className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-1 block ml-1">
							Alergias
						</label>
						<textarea
							rows="2"
							className={`w-full p-4 rounded-2xl outline-none font-bold resize-none border-2 ${
								formData.allergies
									? "bg-red-50 border-red-200 focus:border-red-300 text-red-900"
									: "bg-gray-50 border-transparent focus:bg-white focus:border-rose-100"
							}`}
							placeholder="Indicar si hay alergias conocidas..."
							value={formData.allergies}
							onChange={(e) =>
								setFormData({ ...formData, allergies: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Antecedentes médicos
						</label>
						<textarea
							rows="3"
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold resize-none"
							placeholder="Antecedentes relevantes..."
							value={formData.medical_history}
							onChange={(e) =>
								setFormData({ ...formData, medical_history: e.target.value })
							}
						/>
					</div>
					<p className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
						Legal
					</p>
					<div className="flex flex-col gap-3 pt-2">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={formData.has_consent}
								onChange={(e) =>
									setFormData({ ...formData, has_consent: e.target.checked })
								}
								className="w-5 h-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
							/>
							<span className="font-bold text-gray-700">
								¿Ha firmado Consentimiento?
							</span>
						</label>
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={formData.has_image_rights}
								onChange={(e) =>
									setFormData({
										...formData,
										has_image_rights: e.target.checked,
									})
								}
								className="w-5 h-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
							/>
							<span className="font-bold text-gray-700">
								¿Derechos de Imagen?
							</span>
						</label>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
							Link carpeta Drive (cliente)
						</label>
						<input
							type="url"
							placeholder="https://drive.google.com/..."
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
							value={formData.drive_url}
							onChange={(e) =>
								setFormData({ ...formData, drive_url: e.target.value })
							}
						/>
					</div>
					<LoadingButton
						loading={savingClient}
						type="submit"
						className="w-full bg-surface-dark text-white font-black py-4 rounded-[1.5rem] shadow-xl text-lg mt-4">
						{savingClient ? "Guardando..." : "Guardar Cliente"}
					</LoadingButton>
				</form>
			</AdaptiveModal>

			<PhotoUploadModal
				isOpen={showPhotoUploadModal}
				onClose={() => {
					setShowPhotoUploadModal(false);
					setPhotoUploadSession(null);
				}}
				userId={user?.id}
				clientId={selectedClient?.id}
				sessions={history}
				initialSession={photoUploadSession}
				onSuccess={handlePhotoSuccess}
			/>

			<PhotoEditModal
				isOpen={showPhotoEditModal}
				onClose={() => {
					setShowPhotoEditModal(false);
					setPhotoToEdit(null);
				}}
				photo={photoToEdit}
				userId={user?.id}
				clientId={selectedClient?.id}
				sessions={history}
				onSuccess={handlePhotoEditSuccess}
			/>

			{viewerSession && (
				<AdaptiveModal
					isOpen={!!viewerSession}
					onClose={() => setViewerSession(null)}
					title={`${viewerSession.session?.description?.split("(")[0] || "Sesión"} — ${viewerSession.session?.date}`}
					maxWidth="max-w-2xl">
					<BeforeAfterViewer
						beforePhoto={viewerSession.before}
						afterPhoto={viewerSession.after}
						sessionLabel={null}
					/>
				</AdaptiveModal>
			)}

			<AdaptiveModal
				isOpen={showRefundModal}
				onClose={() => {
					setShowRefundModal(false);
					setSessionToRefund(null);
					setRefundAmount("");
				}}
				title="Rectificar / Devolución"
				maxWidth="max-w-sm">
				{sessionToRefund && (
					<div className="space-y-4">
						<p className="text-sm text-gray-600">
							Factura original:{" "}
							<strong>
								{sessionToRefund.description?.split("(")[0] || "Sesión"}
							</strong>{" "}
							— {formatCurrency(sessionToRefund.amount)}
						</p>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
								¿Cuánto quieres devolver? (máx.{" "}
								{formatCurrency(sessionToRefund.amount)})
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								max={Number(sessionToRefund.amount) || 0}
								placeholder="0.00 €"
								className="w-full p-4 bg-gray-50 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-rose-100"
								value={refundAmount}
								onChange={(e) => setRefundAmount(e.target.value)}
							/>
						</div>
						<LoadingButton
							type="button"
							loading={processingRefund}
							onClick={confirmRefund}
							disabled={
								!refundAmount ||
								Number(refundAmount) <= 0 ||
								Number(refundAmount) > Number(sessionToRefund.amount)
							}
							className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-xl">
							{processingRefund ? "Procesando..." : "Generar abono y PDF"}
						</LoadingButton>
					</div>
				)}
			</AdaptiveModal>
		</div>
	);
};
