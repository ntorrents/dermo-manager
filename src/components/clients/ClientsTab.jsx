import React, { useState, useEffect } from "react";
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
	FileCheck,
	Upload,
	BookOpen,
	CalendarCheck,
	ChevronDown,
	ChevronUp,
	Pen,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useClientHistory } from "../../hooks/useClientHistory";
import { useSessionPhotos } from "../../hooks/useSessionPhotos";
import { useClientBonos } from "../../hooks/useBonos";
import { useTreatments } from "../../hooks/useTreatments";
import { useConsentTemplates } from "../../hooks/useConsentTemplates";
import { useSignedConsents } from "../../hooks/useSignedConsents";
import { useClientSeguimientos } from "../../hooks/useClientSeguimientos";
import { formatCurrency } from "../../utils/format";
import { getAge } from "../../utils/dateUtils";
import { generateInvoice } from "../../utils/invoiceGenerator";
import { generateConsentPDF } from "../../utils/consentGenerator";
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
import {
	uploadSignedConsent,
	getSignedConsentDownloadUrl,
} from "../../services/signedConsentStorage";
import { useTenant } from "../../context/TenantContext";

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
	const { clinicId, clinic, canDeleteOperational } = useTenant();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState(null);
	const [clientDetailTab, setClientDetailTab] = useState("datos");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [clientFormStep, setClientFormStep] = useState(1);
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
		fecha_nacimiento: "",
		notas_privadas: "",
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
	const [showConsentModal, setShowConsentModal] = useState(false);
	const [consentTreatmentId, setConsentTreatmentId] = useState("");
	const [consentTemplateId, setConsentTemplateId] = useState("");

	const { treatments = [] } = useTreatments(user);
	const { consentTemplates = [] } = useConsentTemplates(user);
	const {
		history,
		loading: historyLoading,
		error: historyError,
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
	const {
		signedConsents,
		loading: signedConsentsLoading,
		refetch: refetchSignedConsents,
	} = useSignedConsents(selectedClient?.id);
	const {
		seguimientos,
		loading: seguimientosLoading,
		addSeguimiento,
		updateSeguimiento,
		deleteSeguimiento,
		adding: addingSeguimiento,
		updating: updatingSeguimiento,
		deleting: deletingSeguimiento,
	} = useClientSeguimientos(selectedClient?.id, user?.id);
	const [visitForm, setVisitForm] = useState({
		titulo: "",
		tratamientos_interes: "",
		fecha_proximo_contacto: "",
		notas: "",
		indicaciones_post: "",
	});
	const [visitFormOpen, setVisitFormOpen] = useState(false);
	const [editingVisitId, setEditingVisitId] = useState(null);

	useEffect(() => {
		if (!selectedClient?.id) return;
		setEditingVisitId(null);
		const today = new Date().toISOString().slice(0, 10);
		setVisitForm({
			titulo: "",
			tratamientos_interes: "",
			fecha_proximo_contacto: today,
			notas: "",
			indicaciones_post: "",
		});
		setVisitFormOpen(false);
	}, [selectedClient?.id]);

	const canSaveVisit =
		Boolean(visitForm.fecha_proximo_contacto) &&
		Boolean(
			visitForm.titulo?.trim() ||
				visitForm.tratamientos_interes?.trim() ||
				visitForm.notas?.trim() ||
				visitForm.indicaciones_post?.trim(),
		);

	const [signedConsentTreatmentId, setSignedConsentTreatmentId] = useState("");
	const [signedConsentFile, setSignedConsentFile] = useState(null);
	const [uploadingSignedConsent, setUploadingSignedConsent] = useState(false);

	const filteredClients = clients.filter(
		(c) =>
			c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.phone?.includes(searchTerm),
	);

	const handleOpenModal = (client = null) => {
		setClientFormStep(1);
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
				fecha_nacimiento: client.fecha_nacimiento || "",
				notas_privadas: client.notas_privadas || "",
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
				fecha_nacimiento: "",
				notas_privadas: "",
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
				fecha_nacimiento: formData.fecha_nacimiento?.trim() || null,
				notas_privadas: formData.notas_privadas?.trim() || null,
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
				if (!clinicId) {
					showToast("No hay clínica activa", "error");
					return;
				}
				const { error } = await supabase
					.from("clients")
					.insert([{ ...payload, activo: true, clinic_id: clinicId }]);
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
				.update({ activo: false })
				.eq("id", clientToDelete.id);
			if (error) throw error;
			showToast("Cliente archivado");
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
				invoiceNumber = await getNextRectifiedInvoiceNumber(clinicId, year);
			} catch {
				// Serie R no disponible
			}
			const { data: inserted, error } = await supabase
				.from("finance_entries")
				.insert([
					{
						user_id: user.id,
						clinic_id: clinicId,
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
						activo: true,
					},
				])
				.select()
				.single();
			if (error) throw error;
			await generateInvoice(inserted, selectedClient, clinic, profile, {
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
				title="Archivar cliente"
				message={`¿Archivar a ${clientToDelete?.name}? Dejará de aparecer en la lista; el historial se conserva en la base de datos.`}
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
					<div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
						<div className="relative flex-1 min-w-0">
							<Search
								className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
								size={18}
							/>
							<input
								placeholder="Buscar cliente…"
								className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-100 focus:bg-white focus:border-rose-200 rounded-xl outline-none font-bold text-gray-700"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
						<button
							type="button"
							onClick={() => handleOpenModal()}
							className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors shrink-0">
							<Plus size={20} />
							<span className="hidden sm:inline">Nuevo cliente</span>
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
																clinic?.name,
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
										{canDeleteOperational && (
											<button
												onClick={(e) => handleDeleteClick(e, client)}
												className="p-2 text-gray-300 hover:text-rose-500 shrink-0"
												title="Archivar cliente">
												<Trash2 size={16} />
											</button>
										)}
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
							<div className="flex items-center gap-2">
								<button
									onClick={() => {
										setConsentTreatmentId("");
										setConsentTemplateId("");
										setShowConsentModal(true);
									}}
									className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-rose-600 transition-all shadow-sm flex items-center gap-2"
									title="Generar consentimiento informado">
									<FileText size={18} />
									<span className="hidden sm:inline text-sm font-bold">Consentimiento</span>
								</button>
								<button
									onClick={() => handleOpenModal(selectedClient)}
									className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-rose-600 transition-all shadow-sm"
									title="Editar cliente">
									<Edit2 size={18} />
								</button>
							</div>
						</div>

						{/* Pestañas perfil 360º - Visitas primero */}
						<div className="flex border-b border-gray-100 bg-white px-4 gap-1 overflow-x-auto">
							{[
								{ id: "datos", label: "Datos paciente", icon: User },
								{ id: "visitas", label: "Visitas", icon: BookOpen },
								{ id: "bonos", label: "Bonos", icon: Ticket },
								{
									id: "consentimientos",
									label: "Consentimientos",
									icon: FileCheck,
								},
								{ id: "legal", label: "Legal", icon: Shield },
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
							{clientDetailTab === "visitas" && (
								<>
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
										<BookOpen size={14} /> Diario de visitas
									</h3>
									<p className="text-sm text-gray-500 mb-6 max-w-2xl">
										Registra cada cita o sesión: fecha, tratamientos realizados, notas de la sesión e
										indicaciones al paciente. Las entradas más recientes aparecen primero.
									</p>

									<div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
										<button
											type="button"
											onClick={() => setVisitFormOpen(!visitFormOpen)}
											className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50/80 transition-colors">
											<span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
												<Plus size={14} />
												{editingVisitId ? "Editar visita" : "Nueva entrada de visita"}
											</span>
											{visitFormOpen ? (
												<ChevronUp size={18} className="text-gray-400 shrink-0" />
											) : (
												<ChevronDown size={18} className="text-gray-400 shrink-0" />
											)}
										</button>
										{visitFormOpen && (
											<div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3">
												<div>
													<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
														Resumen / título (opcional)
													</label>
													<input
														type="text"
														className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium"
														placeholder="Ej: Revisión post peeling"
														value={visitForm.titulo}
														onChange={(e) =>
															setVisitForm({ ...visitForm, titulo: e.target.value })
														}
													/>
												</div>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													<div>
														<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
															Fecha de la visita
														</label>
														<input
															type="date"
															className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium"
															value={visitForm.fecha_proximo_contacto}
															onChange={(e) =>
																setVisitForm({
																	...visitForm,
																	fecha_proximo_contacto: e.target.value,
																})
															}
														/>
													</div>
													<div>
														<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
															Tratamientos realizados
														</label>
														<input
															type="text"
															className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium"
															placeholder="Ej: HIFU facial, mesoterapia…"
															value={visitForm.tratamientos_interes}
															onChange={(e) =>
																setVisitForm({
																	...visitForm,
																	tratamientos_interes: e.target.value,
																})
															}
														/>
													</div>
												</div>
												<div>
													<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
														Notas de la sesión
													</label>
													<textarea
														rows={3}
														className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium resize-y min-h-[72px]"
														placeholder="Evolución, observaciones, reacción del paciente…"
														value={visitForm.notas}
														onChange={(e) =>
															setVisitForm({ ...visitForm, notas: e.target.value })
														}
													/>
												</div>
												<div>
													<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
														Indicaciones / cuidados post (opcional)
													</label>
													<textarea
														rows={2}
														className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium resize-none"
														placeholder="Cremas, sol, próxima sesión sugerida…"
														value={visitForm.indicaciones_post}
														onChange={(e) =>
															setVisitForm({
																...visitForm,
																indicaciones_post: e.target.value,
															})
														}
													/>
												</div>
												<div className="flex flex-wrap gap-2">
													{editingVisitId && (
														<button
															type="button"
															onClick={() => {
																setEditingVisitId(null);
																const today = new Date().toISOString().slice(0, 10);
																setVisitForm({
																	titulo: "",
																	tratamientos_interes: "",
																	fecha_proximo_contacto: today,
																	notas: "",
																	indicaciones_post: "",
																});
															}}
															className="px-4 py-2 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 text-sm">
															Cancelar edición
														</button>
													)}
													<button
														type="button"
														disabled={
															addingSeguimiento || updatingSeguimiento || !canSaveVisit
														}
														onClick={async () => {
															const payload = {
																titulo: visitForm.titulo?.trim() || null,
																tratamientos_interes: visitForm.tratamientos_interes?.trim() || null,
																fecha_proximo_contacto: visitForm.fecha_proximo_contacto || null,
																notas: visitForm.notas?.trim() || null,
																indicaciones_post: visitForm.indicaciones_post?.trim() || null,
															};
															try {
																if (editingVisitId) {
																	await updateSeguimiento({
																		id: editingVisitId,
																		...payload,
																	});
																	showToast("Visita actualizada");
																} else {
																	await addSeguimiento(payload);
																	showToast("Visita registrada");
																}
																setEditingVisitId(null);
																const today = new Date().toISOString().slice(0, 10);
																setVisitForm({
																	titulo: "",
																	tratamientos_interes: "",
																	fecha_proximo_contacto: today,
																	notas: "",
																	indicaciones_post: "",
																});
																setVisitFormOpen(false);
															} catch (err) {
																showToast(err?.message || "Error al guardar", "error");
															}
														}}
														className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
														{editingVisitId ? (
															<>
																<Check size={16} /> Guardar cambios
															</>
														) : (
															<>
																<Plus size={16} /> Añadir visita
															</>
														)}
													</button>
												</div>
											</div>
										)}
									</div>

									{seguimientosLoading ? (
										<div className="space-y-3">
											{[1, 2, 3].map((i) => (
												<div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
											))}
										</div>
									) : seguimientos.length > 0 ? (
										<div className="space-y-3">
											{seguimientos.map((seg) => (
												<div
													key={seg.id}
													className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
													<div className="min-w-0 flex-1 space-y-1.5">
														<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
															{seg.fecha_proximo_contacto && (
																<p className="text-sm font-black text-rose-600 flex items-center gap-1.5">
																	<CalendarCheck size={14} className="shrink-0" />
																	{new Date(
																		seg.fecha_proximo_contacto + "T12:00:00",
																	).toLocaleDateString("es-ES", {
																		weekday: "long",
																		day: "numeric",
																		month: "long",
																		year: "numeric",
																	})}
																</p>
															)}
															{seg.titulo && (
																<p className="text-sm font-bold text-gray-800">{seg.titulo}</p>
															)}
														</div>
														{seg.tratamientos_interes && (
															<p className="text-sm text-gray-800">
																<span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">
																	Tratamientos:{" "}
																</span>
																{seg.tratamientos_interes}
															</p>
														)}
														{seg.notas && (
															<p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
																<span className="text-[10px] font-black text-gray-400 uppercase tracking-wide block mb-0.5">
																	Notas de sesión
																</span>
																{seg.notas}
															</p>
														)}
														{seg.indicaciones_post && (
															<p className="text-xs text-amber-900/90 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 whitespace-pre-wrap">
																<span className="text-[10px] font-black text-amber-800/80 uppercase tracking-wide block mb-0.5">
																	Indicaciones post
																</span>
																{seg.indicaciones_post}
															</p>
														)}
														{!seg.titulo &&
															!seg.fecha_proximo_contacto &&
															!seg.tratamientos_interes &&
															!seg.notas &&
															!seg.indicaciones_post && (
																<p className="text-xs text-gray-400">Sin detalles</p>
															)}
													</div>
													<div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
														<button
															type="button"
															onClick={() => {
																setEditingVisitId(seg.id);
																setVisitForm({
																	titulo: seg.titulo || "",
																	tratamientos_interes: seg.tratamientos_interes || "",
																	fecha_proximo_contacto:
																		seg.fecha_proximo_contacto ||
																		new Date().toISOString().slice(0, 10),
																	notas: seg.notas || "",
																	indicaciones_post: seg.indicaciones_post || "",
																});
																setVisitFormOpen(true);
															}}
															className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
															title="Editar">
															<Pen size={16} />
														</button>
														<button
															type="button"
															onClick={async () => {
																if (deletingSeguimiento) return;
																try {
																	await deleteSeguimiento(seg.id);
																	if (editingVisitId === seg.id) {
																		setEditingVisitId(null);
																		const today = new Date().toISOString().slice(0, 10);
																		setVisitForm({
																			titulo: "",
																			tratamientos_interes: "",
																			fecha_proximo_contacto: today,
																			notas: "",
																			indicaciones_post: "",
																		});
																	}
																	showToast("Entrada eliminada");
																} catch (err) {
																	showToast(err?.message || "Error al eliminar", "error");
																}
															}}
															disabled={deletingSeguimiento}
															className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
															title="Eliminar">
															<Trash2 size={16} />
														</button>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center h-32 text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl">
											<BookOpen size={28} className="mb-2 opacity-50" />
											<p className="font-bold text-sm">Aún no hay visitas registradas</p>
											<p className="text-xs text-gray-400 mt-1 text-center px-4">
												Usa «Nueva entrada de visita» para añadir fecha, tratamientos y notas de cada
												sesión.
											</p>
										</div>
									)}

									<div className="mt-8 pt-6 border-t border-gray-100">
										<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
											<Clock size={14} /> Historial de sesiones
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
										) : historyError ? (
											<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
												<p className="text-sm font-bold text-amber-900">
													No se pudo cargar el historial.
												</p>
												<p className="text-xs text-amber-800 mt-1">{historyError}</p>
												<button
													type="button"
													onClick={refetchHistory}
													className="mt-3 px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 font-bold text-xs">
													Reintentar
												</button>
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
													const extraPhotos = sessionPhotos
														.filter(
															(p) =>
																p.finance_entry_id === session.id &&
																p.type === "extra",
														)
														.sort(
															(a, b) =>
																new Date(a.created_at) - new Date(b.created_at),
														);

													const openPhotoViewer = () =>
														setViewerSession({
															session,
															before: beforePhoto,
															after: afterPhoto,
															extras: extraPhotos,
														});

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
																		<div className="flex items-center gap-2 mt-3 flex-wrap">
																			{beforePhoto && (
																				<SessionPhotoThumbnail
																					photo={beforePhoto}
																					label="Antes"
																					onView={openPhotoViewer}
																					onEdit={handlePhotoEdit}
																					onDelete={handlePhotoDelete}
																				/>
																			)}
																			{afterPhoto && (
																				<SessionPhotoThumbnail
																					photo={afterPhoto}
																					label="Después"
																					onView={openPhotoViewer}
																					onEdit={handlePhotoEdit}
																					onDelete={handlePhotoDelete}
																				/>
																			)}
																			{extraPhotos.map((ph) => (
																				<SessionPhotoThumbnail
																					key={ph.id}
																					photo={ph}
																					compact
																					onView={openPhotoViewer}
																					onEdit={handlePhotoEdit}
																					onDelete={handlePhotoDelete}
																				/>
																			))}
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
																					await generateInvoice(session, selectedClient, clinic, profile);
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
									</div>
								</>
							)}

							{clientDetailTab === "datos" && (
								<div className="space-y-6">
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<User size={14} /> Datos paciente
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
										{selectedClient.fecha_nacimiento && (
											<div>
												<dt className="text-[10px] font-black text-gray-400 uppercase">
													Fecha nacimiento
												</dt>
												<dd className="font-bold text-gray-800">
													{selectedClient.fecha_nacimiento}
													{getAge(selectedClient.fecha_nacimiento) != null && (
														<span className="text-gray-500 font-medium ml-2">
															({getAge(selectedClient.fecha_nacimiento)} años)
														</span>
													)}
												</dd>
											</div>
										)}
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
										{selectedClient.notas_privadas && (
											<div className="pt-3 mt-3 border-t border-gray-100">
												<dt className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1">
													<Shield size={12} /> Notas privadas (HC)
												</dt>
												<dd className="font-medium text-gray-700 mt-1 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
													{selectedClient.notas_privadas}
												</dd>
											</div>
										)}
									</dl>
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

							{clientDetailTab === "medico-deprecated" && (
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


							{clientDetailTab === "consentimientos" && (
								<>
									<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
										<FileCheck size={14} /> Consentimientos firmados
									</h3>

									{/* Subir nuevo */}
									<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
										<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
											Subir consentimiento firmado (PDF)
										</p>
										<div className="flex flex-wrap items-end gap-3">
											<div className="min-w-[200px] flex-1">
												<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
													Tratamiento
												</label>
												<select
													value={signedConsentTreatmentId}
													onChange={(e) =>
														setSignedConsentTreatmentId(e.target.value)
													}
													className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium">
													<option value="">— Seleccionar —</option>
													{treatments.map((t) => (
														<option key={t.id} value={t.id}>
															{t.name}
														</option>
													))}
												</select>
											</div>
											<div className="min-w-[180px] flex-1">
												<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
													Archivo PDF
												</label>
												<input
													type="file"
													accept=".pdf,application/pdf"
													onChange={(e) =>
														setSignedConsentFile(e.target.files?.[0] || null)
													}
													className="w-full p-2 text-sm border border-gray-200 rounded-xl bg-gray-50 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-600"
												/>
											</div>
											<LoadingButton
												loading={uploadingSignedConsent}
												disabled={
													!signedConsentTreatmentId ||
													!signedConsentFile ||
													!user?.id
												}
												onClick={async () => {
													if (
														!signedConsentTreatmentId ||
														!signedConsentFile ||
														!selectedClient?.id ||
														!user?.id
													)
														return;
													const treatment = treatments.find(
														(t) => t.id === signedConsentTreatmentId,
													);
													setUploadingSignedConsent(true);
													try {
														if (!clinicId) {
															showToast("No hay clínica activa", "error");
															return;
														}
														await uploadSignedConsent({
															userId: user.id,
															clinicId,
															clientId: selectedClient.id,
															treatmentId: signedConsentTreatmentId,
															treatmentName: treatment?.name || "Tratamiento",
															file: signedConsentFile,
														});
														refetchSignedConsents();
														setSignedConsentTreatmentId("");
														setSignedConsentFile(null);
														showToast("Consentimiento subido correctamente");
													} catch (err) {
														showToast(
															err?.message || "Error al subir",
															"error",
														);
													} finally {
														setUploadingSignedConsent(false);
													}
												}}>
												<Upload size={16} className="mr-1.5" />
												Subir
											</LoadingButton>
										</div>
									</div>

									{signedConsentsLoading ? (
										<div className="space-y-4">
											{[1, 2].map((i) => (
												<div
													key={i}
													className="h-20 bg-gray-100 rounded-2xl animate-pulse"
												/>
											))}
										</div>
									) : signedConsents.length > 0 ? (
										<div className="space-y-3">
											{signedConsents.map((consent) => (
												<div
													key={consent.id}
													className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
													<div>
														<p className="font-bold text-gray-800">
															{consent.treatment_name}
														</p>
														<p className="text-xs text-gray-500">
															Subido{" "}
															{new Date(consent.uploaded_at).toLocaleDateString(
																"es-ES",
																{
																	day: "numeric",
																	month: "short",
																	year: "numeric",
																},
															)}
														</p>
													</div>
													<button
														type="button"
														onClick={async () => {
															try {
																const url = await getSignedConsentDownloadUrl(
																	consent.storage_path,
																);
																if (url) window.open(url, "_blank");
																else showToast("No se pudo generar el enlace", "error");
															} catch {
																showToast("Error al descargar", "error");
															}
														}}
														className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-sm flex items-center gap-2">
														<FileDown size={16} />
														Descargar
													</button>
												</div>
											))}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center h-32 text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl">
											<FileCheck size={28} className="mb-2 opacity-50" />
											<p className="font-bold text-sm">
												Ningún consentimiento firmado aún
											</p>
											<p className="text-xs text-gray-400 mt-1">
												Sube un PDF firmado arriba
											</p>
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
					<div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
						<span className={`px-2 py-1 rounded-lg ${clientFormStep === 1 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"}`}>
							Paso 1 · Alta rápida
						</span>
						<span className={`px-2 py-1 rounded-lg ${clientFormStep === 2 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"}`}>
							Paso 2 · Ficha ampliada
						</span>
					</div>
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
					{clientFormStep === 1 ? (
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => setClientFormStep(2)}
								disabled={!formData.name?.trim() || !formData.phone?.trim()}
								className="px-4 py-2 rounded-xl bg-surface-dark text-white font-bold disabled:opacity-50">
								Siguiente
							</button>
						</div>
					) : (
						<>
					<input
						type="text"
						className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
						placeholder="NIF/CIF (obligatorio para facturación)"
						value={formData.nif}
						onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
					/>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Fecha de nacimiento
						</label>
						<input
							type="date"
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold"
							value={formData.fecha_nacimiento || ""}
							onChange={(e) =>
								setFormData({ ...formData, fecha_nacimiento: e.target.value })
							}
						/>
					</div>
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
						placeholder="Notas (visibles en perfil)"
						value={formData.notes}
						onChange={(e) =>
							setFormData({ ...formData, notes: e.target.value })
						}
					/>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Notas privadas (historia clínica)
						</label>
						<textarea
							rows="2"
							className="w-full p-4 bg-amber-50/50 border-2 border-amber-100 focus:bg-white focus:border-amber-200 rounded-2xl outline-none font-bold resize-none placeholder:text-gray-400"
							placeholder="Solo visibles en el perfil del cliente..."
							value={formData.notas_privadas || ""}
							onChange={(e) =>
								setFormData({ ...formData, notas_privadas: e.target.value })
							}
						/>
					</div>
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
						<div className="flex justify-start">
							<button
								type="button"
								onClick={() => setClientFormStep(1)}
								className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold">
								Volver al paso rápido
							</button>
						</div>
						</>
					)}
				</form>
			</AdaptiveModal>

			<PhotoUploadModal
				isOpen={showPhotoUploadModal}
				onClose={() => {
					setShowPhotoUploadModal(false);
					setPhotoUploadSession(null);
				}}
				userId={user?.id}
				clinicId={clinicId}
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
						extraPhotos={viewerSession.extras || []}
						sessionLabel={null}
					/>
				</AdaptiveModal>
			)}

			<AdaptiveModal
				isOpen={showConsentModal}
				onClose={() => {
					setShowConsentModal(false);
					setConsentTreatmentId("");
					setConsentTemplateId("");
				}}
				title="Generar consentimiento informado"
				maxWidth="max-w-lg">
				{selectedClient && (
					<div className="space-y-4">
						{consentTemplates.length === 0 ? (
							<div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
								<p className="font-bold mb-1">No hay plantillas de consentimiento</p>
								<p className="text-amber-700">
									Añade plantillas en <strong>Ajustes → Plantillas de consentimiento</strong> y asígnale un tratamiento. Usa variables: {"{{NOMBRE}}"}, {"{{APELLIDOS}}"}, {"{{DNI}}"}, {"{{TRATAMIENTO}}"}, {"{{FECHA}}"}.
								</p>
							</div>
						) : (
							<>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Tratamiento</label>
									<select
										className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
										value={consentTreatmentId}
										onChange={(e) => {
											setConsentTreatmentId(e.target.value);
											setConsentTemplateId("");
										}}>
										<option value="">— Cualquiera / Genérico —</option>
										{treatments.map((t) => (
											<option key={t.id} value={t.id}>{t.name}</option>
										))}
									</select>
								</div>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Plantilla</label>
									<select
										className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
										value={consentTemplateId}
										onChange={(e) => setConsentTemplateId(e.target.value)}>
										<option value="">— Seleccionar plantilla —</option>
										{consentTemplates
											.filter(
												(tpl) =>
													!consentTreatmentId ||
													tpl.treatment_id === consentTreatmentId ||
													tpl.treatment_id == null
											)
											.map((tpl) => (
												<option key={tpl.id} value={tpl.id}>
													{tpl.nombre}
													{tpl.treatments?.name ? ` (${tpl.treatments.name})` : " (genérica)"}
												</option>
											))}
									</select>
								</div>
								<p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
									Logo y firma profesional se configuran en <strong>Ajustes → Datos de Facturación</strong> y se aplican a todos los PDF.
								</p>
								<button
									type="button"
									disabled={!consentTemplateId}
									onClick={async () => {
										const tpl = consentTemplates.find((c) => c.id === consentTemplateId);
										if (!tpl) return;
										const treatmentName = tpl.treatments?.name ?? treatments.find((t) => t.id === tpl.treatment_id)?.name ?? "";
										await generateConsentPDF(selectedClient, treatmentName, tpl.contenido, tpl.nombre, {
											clinic: clinic ?? undefined,
											profile: profile ?? undefined,
										});
										showToast("PDF generado");
										setShowConsentModal(false);
										setConsentTreatmentId("");
										setConsentTemplateId("");
									}}
									className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2">
									<FileDown size={20} />
									Generar PDF
								</button>
							</>
						)}
					</div>
				)}
			</AdaptiveModal>

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
