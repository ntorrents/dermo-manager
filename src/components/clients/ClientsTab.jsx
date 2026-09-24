import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Search, Eye,
	Plus,
	Users,
	Trash2,
	Edit2,
	FileText,
	UserPlus,
	X,
	ArrowLeft,
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
	FolderOpen,
	Upload,
	BookOpen,
	CalendarCheck,
	ChevronDown,
	ChevronUp,
	Pen,
	Filter,
	ArrowUpDown,
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
import { inferIsCompanyFromNif } from "../../utils/incomeTax";
import { IRPF_OPTIONS } from "../../utils/format";

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
	const { clientId: urlClientId } = useParams();
	const navigate = useNavigate();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState(null);

	// Sync selectedClient from URL param
	useEffect(() => {
		if (urlClientId && clients.length > 0) {
			const found = clients.find((c) => c.id === urlClientId);
			if (found) {
				setSelectedClient(found);
			}
		} else if (!urlClientId) {
			setSelectedClient(null);
		}
	}, [urlClientId, clients]);

	// Helper to select/deselect clients via URL navigation
	const selectClient = (client) => {
		if (client) {
			navigate(`/clientes/${client.id}`);
		} else {
			navigate("/clientes");
		}
	};
	const [clientDetailTab, setClientDetailTab] = useState("datos");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [clientFormStep, setClientFormStep] = useState(1);
	const [filterEstado, setFilterEstado] = useState("todos");
	const [sortBy, setSortBy] = useState("name_asc");
	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		phone: "",
		email: "",
		nif: "",
		origin: "",
		estado: "activo",
		notes: "",
		allergies: "",
		medical_history: "",
		has_consent: false,
		has_image_rights: false,
		drive_url: "",
		fecha_nacimiento: "",
		notas_privadas: "",
		address: "",
		is_company: false,
		irpf_withholding_rate: 7,
	});
	useEffect(() => {
		if (selectedClient) {
			setFormData({
				name: selectedClient.name || "",
				surname: selectedClient.surname || "",
				phone: selectedClient.phone || "",
				nif: selectedClient.nif || "",
				origin: selectedClient.origin || "",
				estado: selectedClient.estado || "activo",
				allergies: selectedClient.allergies || "",
				medical_history: selectedClient.medical_history || "",
				has_consent: selectedClient.has_consent || false,
				has_image_rights: selectedClient.has_image_rights || false,
				drive_url: selectedClient.drive_url || "",
				fecha_nacimiento: selectedClient.fecha_nacimiento || "",
				notas_privadas: selectedClient.notas_privadas || "",
				address: selectedClient.address || "",
				is_company: selectedClient.is_company || false,
				irpf_withholding_rate:
					selectedClient.irpf_withholding_rate != null
						? Number(selectedClient.irpf_withholding_rate)
						: 7,
			});
		}
	}, [selectedClient]);


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

	const timelineItems = useMemo(() => {
		const map = new Map();
		(history || []).forEach(session => {
			const date = session.date;
			if (!date) return;
			if (!map.has(date)) map.set(date, { date, sessions: [], notes: [] });
			map.get(date).sessions.push(session);
		});
		(seguimientos || []).forEach(seg => {
			const date = seg.fecha_proximo_contacto?.split('T')[0] || seg.created_at?.split('T')[0];
			if (!date) return;
			if (!map.has(date)) map.set(date, { date, sessions: [], notes: [] });
			map.get(date).notes.push(seg);
		});
		return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [history, seguimientos]);
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

	const filteredClients = clients
		.filter((c) => {
			const matchesSearch =
				c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				c.phone?.includes(searchTerm);
			const matchesEstado =
				filterEstado === "todos" ||
				(filterEstado === "activo" && (!c.estado || c.estado === "activo")) ||
				c.estado === filterEstado;
			return matchesSearch && matchesEstado;
		})
		.sort((a, b) => {
			switch (sortBy) {
				case "name_desc":
					return (b.name || "").localeCompare(a.name || "", "es");
				case "recent":
					return new Date(b.created_at || 0) - new Date(a.created_at || 0);
				case "oldest":
					return new Date(a.created_at || 0) - new Date(b.created_at || 0);
				case "name_asc":
				default:
					return (a.name || "").localeCompare(b.name || "", "es");
			}
		});

	const ensureCompanyFiscalAddress = (client) => {
		if (client?.is_company && !client?.address?.trim()) {
			showToast(
				"Añade la dirección fiscal del cliente (ficha → editar) antes de emitir factura",
				"error",
			);
			return false;
		}
		return true;
	};

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
				address: client.address || "",
				is_company: client.is_company ?? false,
				irpf_withholding_rate:
					client.irpf_withholding_rate != null
						? Number(client.irpf_withholding_rate)
						: 7,
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
				estado: "activo",
				notes: "",
				allergies: "",
				medical_history: "",
				has_consent: false,
				has_image_rights: false,
				drive_url: "",
				fecha_nacimiento: "",
				notas_privadas: "",
				address: "",
				is_company: false,
				irpf_withholding_rate: 7,
			});
			setSelectedClient(null);
		}
		setIsModalOpen(true);
	};

	const handleSaveClient = async (e) => {
		e.preventDefault();
		if (formData.is_company && !formData.address?.trim()) {
			showToast("Las empresas deben tener dirección fiscal (obligatoria en factura)", "error");
			return;
		}
		setSavingClient(true);
		try {
			const payload = {
				...formData,
				user_id: user.id,
				nif: formData.nif?.trim() || null,
				origin: formData.origin || null,
				estado: formData.estado || "activo",
				allergies: formData.allergies?.trim() || null,
				medical_history: formData.medical_history?.trim() || null,
				has_consent: formData.has_consent,
				has_image_rights: formData.has_image_rights,
				drive_url: formData.drive_url?.trim() || null,
				fecha_nacimiento: formData.fecha_nacimiento?.trim() || null,
				notas_privadas: formData.notas_privadas?.trim() || null,
				address: formData.address?.trim() || null,
				is_company: !!formData.is_company,
				irpf_withholding_rate: formData.is_company
					? Number(formData.irpf_withholding_rate) || 7
					: null,
			};
			if (selectedClient) {
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
			if (selectedClient?.id === clientToDelete.id) selectClient(null);
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
			if (!ensureCompanyFiscalAddress(selectedClient)) {
				setProcessingRefund(false);
				return;
			}
			const taxRate = Number(sessionToRefund.tax_rate) ?? 21;
			const irpfRate = Number(sessionToRefund.irpf_rate) ?? 0;
			const sessionTotal = Number(sessionToRefund.amount) || 0;
			const ratio = sessionTotal > 0 ? amount / sessionTotal : 0;
			const baseAmount =
				Math.round((Number(sessionToRefund.tax_base) || 0) * ratio * 100) / 100;
			const taxAmount =
				Math.round((Number(sessionToRefund.tax_amount) || 0) * ratio * 100) / 100;
			const irpfAmount =
				Math.round((Number(sessionToRefund.irpf_amount) || 0) * ratio * 100) / 100;
			const totalAmount = amount;
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
						amount: -totalAmount,
						total_amount: -totalAmount,
						tax_rate: taxRate,
						tax_base: -baseAmount,
						tax_amount: -taxAmount,
						irpf_rate: irpfRate,
						irpf_amount: irpfRate ? -irpfAmount : 0,
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


	if (isModalOpen) {
		const title = selectedClient ? 'Editar Cliente' : 'Nuevo Cliente';
		return (
			<div className="animate-in fade-in pb-24 md:pb-0">
				{/* Sticky toolbar */}
				<div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 -mt-5 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4 min-w-0">
						<button
							type="button"
							onClick={() => { setIsModalOpen(false) }}
							className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors shrink-0 shadow-sm"
							title="Volver">
							<ArrowLeft size={20} />
						</button>
						<h2 className="text-xl font-semibold text-gray-900 truncate">{title}</h2>
					</div>
					<LoadingButton
						loading={savingClient}
						type="submit"
						form="client-form"
						className="px-5 py-2 bg-rose-700 text-white font-semibold rounded-lg text-sm hover:bg-rose-800 transition-colors shrink-0">
						{savingClient ? "Guardando..." : "Guardar"}
					</LoadingButton>
				</div>

				<form id="client-form" onSubmit={handleSaveClient} className="mt-6">
					{/* Sección: Datos Generales */}
					<section className="pb-6 mb-6 border-b border-gray-200">
						<h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Datos Generales</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Nombre <span className="text-rose-600">*</span></label>
								<input
									required
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
									placeholder="Nombre"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Apellidos</label>
								<input
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
									placeholder="Apellidos"
									value={formData.surname}
									onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Teléfono</label>
								<input
									type="tel"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
									placeholder="Teléfono"
									value={formData.phone}
									onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
								<input
									type="email"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
									placeholder="Email"
									value={formData.email}
									onChange={(e) => setFormData({ ...formData, email: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Fecha de nacimiento</label>
								<input
									type="date"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 transition-colors"
									value={formData.fecha_nacimiento || ""}
									onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Origen</label>
								<select
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 transition-colors"
									value={formData.origin}
									onChange={(e) => setFormData({ ...formData, origin: e.target.value })}>
									<option value="">— Seleccionar —</option>
									<option value="instagram">Instagram</option>
									<option value="google">Google</option>
									<option value="recommendation">Recomendación</option>
									<option value="other">Otro</option>
								</select>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Estado</label>
								<select
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 transition-colors"
									value={formData.estado || "activo"}
									onChange={(e) => setFormData({ ...formData, estado: e.target.value })}>
									<option value="activo">Activo</option>
									<option value="inactivo">Inactivo</option>
									<option value="bloqueado">Bloqueado</option>
									<option value="borrador">Borrador / Lead</option>
								</select>
							</div>
						</div>
					</section>

					{/* Sección: Facturación */}
					<section className="pb-6 mb-6 border-b border-gray-200">
						<h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Facturación</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">NIF/CIF</label>
								<input
									type="text"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
									placeholder="NIF/CIF"
									value={formData.nif}
									onChange={(e) => {
										const nif = e.target.value;
										const isCompany = inferIsCompanyFromNif(nif);
										setFormData((prev) => ({
											...prev,
											nif,
											is_company: isCompany ? true : prev.is_company,
										}));
									}}
								/>
							</div>
							<div className="flex items-end pb-1">
								<label className="flex items-center gap-2.5 cursor-pointer select-none">
									<input
										type="checkbox"
										checked={!!formData.is_company}
										onChange={(e) =>
											setFormData({
												...formData,
												is_company: e.target.checked,
												irpf_withholding_rate: e.target.checked ? (formData.irpf_withholding_rate || 7) : 7,
											})
										}
										className="w-4 h-4 rounded border-gray-300 text-rose-700 focus:ring-rose-200"
									/>
									<span className="text-sm font-medium text-gray-700">Es empresa (retención IRPF)</span>
								</label>
							</div>
							{formData.is_company && (
								<div>
									<label className="text-xs font-medium text-gray-500 block mb-1.5">Retención IRPF (%)</label>
									<select
										className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 transition-colors"
										value={formData.irpf_withholding_rate ?? 7}
										onChange={(e) => setFormData({ ...formData, irpf_withholding_rate: Number(e.target.value) })}>
										{IRPF_OPTIONS.filter((v) => v > 0).map((v) => (
											<option key={v} value={v}>{v} % {v === 7 ? "(habitual 1.er año)" : ""}</option>
										))}
									</select>
								</div>
							)}
						</div>
						{formData.is_company && (
							<div className="mt-4 max-w-lg">
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Dirección fiscal</label>
								<textarea
									rows={2}
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 resize-y min-h-[3rem] transition-colors"
									placeholder="Calle, número, CP, ciudad"
									value={formData.address}
									onChange={(e) => setFormData({ ...formData, address: e.target.value })}
								/>
							</div>
						)}
					</section>

					{/* Sección: Clínica e Historial */}
					<section className="pb-6">
						<h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Clínica e Historial</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Notas públicas</label>
								<textarea
									rows="3"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 resize-none transition-colors"
									placeholder="Notas visibles en perfil..."
									value={formData.notes}
									onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-amber-600 block mb-1.5">Notas privadas (Historia clínica)</label>
								<textarea
									rows="3"
									className="w-full px-3 py-2.5 bg-amber-50/30 border border-amber-200 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 placeholder:text-gray-400 resize-none transition-colors"
									placeholder="Solo visibles en el perfil..."
									value={formData.notas_privadas || ""}
									onChange={(e) => setFormData({ ...formData, notas_privadas: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-rose-600 block mb-1.5">Alergias</label>
								<textarea
									rows="3"
									className={`w-full px-3 py-2.5 rounded-lg outline-none font-medium resize-none border text-sm transition-colors placeholder:text-gray-400 ${formData.allergies ? "bg-red-50/50 border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100 text-red-900" : "bg-white border-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 text-gray-900"}`}
									placeholder="Indicar alergias..."
									value={formData.allergies}
									onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-gray-500 block mb-1.5">Antecedentes médicos</label>
								<textarea
									rows="3"
									className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 resize-none transition-colors"
									placeholder="Antecedentes..."
									value={formData.medical_history}
									onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
								/>
							</div>
						</div>
						<div className="mt-4 max-w-lg">
							<label className="text-xs font-medium text-gray-500 block mb-1.5">Link carpeta Drive</label>
							<input
								type="url"
								placeholder="https://drive.google.com/..."
								className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-200 placeholder:text-gray-400 transition-colors"
								value={formData.drive_url}
								onChange={(e) => setFormData({ ...formData, drive_url: e.target.value })}
							/>
						</div>
					</section>
				</form>
			</div>
		);
	}

	return (
		<div className="space-y-4 animate-in fade-in pb-20 md:pb-0 min-h-[calc(100vh-120px)] flex flex-col">
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

						{!selectedClient ? (
				<div className="flex-1 min-w-0 overflow-hidden flex flex-col">
					<div className="pb-4 mb-1 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
						<div className="flex items-center gap-2">
							<Users className="text-gray-400" size={18} />
							<h2 className="text-lg font-semibold text-gray-900 tracking-tight">Clientes</h2>
							<span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">
								{clients.length}
							</span>
						</div>
						<div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
							<div className="relative min-w-[200px]">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
								<input
									placeholder="Buscar cliente..."
									className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 rounded-lg outline-none text-sm font-medium text-gray-700"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>
							<select
								value={filterEstado}
								onChange={(e) => setFilterEstado(e.target.value)}
								className="px-3 py-2 bg-white border border-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 rounded-lg outline-none text-sm font-medium text-gray-700">
								<option value="todos">Todos los estados</option>
								<option value="activo">Activo</option>
								<option value="inactivo">Inactivo</option>
								<option value="bloqueado">Bloqueado</option>
								<option value="borrador">Borrador / Lead</option>
							</select>
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="px-3 py-2 bg-white border border-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 rounded-lg outline-none text-sm font-medium text-gray-700">
								<option value="name_asc">A → Z</option>
								<option value="name_desc">Z → A</option>
								<option value="recent">Más recientes</option>
								<option value="oldest">Más antiguos</option>
							</select>
							<button
								type="button"
								onClick={() => handleOpenModal()}
								className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-rose-700 text-white hover:bg-rose-800 transition-colors shrink-0">
								<Plus size={16} />
								<span>Nuevo Cliente</span>
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-sm">
						{filteredClients.length === 0 ? (
							<div className="p-8">
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
							</div>
						) : (
							<table className="w-full text-left border-collapse min-w-[800px]">
								<thead className="sticky top-0 z-10">
									<tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
										<th className="p-3.5 pl-5 font-semibold">Paciente</th>
										<th className="p-3.5 font-semibold">Estado</th>
										<th className="p-3.5 font-semibold">Contacto</th>
										<th className="p-3.5 font-semibold">Identificación</th>
										<th className="p-3.5 text-center font-semibold">Legal</th>
										<th className="p-3.5 text-right pr-5 font-semibold">Acciones</th>
										<th className="p-3.5 text-right pr-5 font-semibold">Acciones</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 bg-white">
									{filteredClients.map((client) => (
										<tr
											key={client.id}
											onClick={() => selectClient(client)}
											className="hover:bg-gray-50/70 transition-colors cursor-pointer group">
											<td className="p-3.5 pl-5">
												<div className="flex items-center gap-3">
													<div className="w-9 h-9 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center text-sm font-bold shrink-0 border border-rose-100">
														{client.name.charAt(0)}
													</div>
													<div className="flex items-center gap-2">
														<p className="font-semibold text-gray-900 text-sm">{client.name} {client.surname}</p>
														{client.is_company && (
															<span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 font-bold rounded border border-slate-200">Empresa</span>
														)}
													</div>
												</div>
											</td>
											<td className="p-3.5">
												{client.estado === "inactivo" && (
													<span className="px-2 py-1 text-[11px] bg-gray-100 text-gray-600 font-semibold rounded-md">Inactivo</span>
												)}
												{client.estado === "bloqueado" && (
													<span className="px-2 py-1 text-[11px] bg-red-50 text-red-700 font-semibold rounded-md">Bloqueado</span>
												)}
												{client.estado === "borrador" && (
													<span className="px-2 py-1 text-[11px] bg-amber-50 text-amber-700 font-semibold rounded-md">Borrador</span>
												)}
												{(!client.estado || client.estado === "activo") && (
													<span className="px-2 py-1 text-[11px] bg-emerald-50 text-emerald-700 font-semibold rounded-md">Activo</span>
												)}
											</td>
											<td className="p-3.5">
												<div className="flex items-center gap-2">
													<span className="text-sm text-gray-600">{client.phone || "Sin tlf"}</span>
													{client.phone && (
														<a
															href={buildWhatsAppUrl(client.phone, client.name, clinic?.name)}
															target="_blank"
															rel="noopener noreferrer"
															onClick={(e) => e.stopPropagation()}
															className="p-1 rounded bg-green-50 text-emerald-700 hover:bg-green-100 opacity-0 group-hover:opacity-100 transition-all"
															title="WhatsApp">
															<MessageCircle size={14} />
														</a>
													)}
												</div>
											</td>
											<td className="p-3.5">
												<span className="text-sm font-medium text-gray-500">{client.nif || "-"}</span>
											</td>
											<td className="p-3.5 text-center">
												<div className="flex items-center justify-center gap-2">
													<span className="flex items-center gap-1 text-[11px] font-bold text-slate-500" title="Consentimiento">
														{client.has_consent ? <Check size={12} className="text-emerald-500"/> : <X size={12} className="text-slate-300"/>} C
													</span>
													<span className="flex items-center gap-1 text-[11px] font-bold text-slate-500" title="Derechos de imagen">
														{client.has_image_rights ? <Check size={12} className="text-emerald-500"/> : <X size={12} className="text-slate-300"/>} I
													</span>
												</div>
											</td>
											<td className="p-3 pr-4 text-right">
												<div className="flex justify-end gap-2">
													<button
														onClick={(e) => {
															e.stopPropagation();
															setSelectedClient(client);
														}}
														className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
														title="Ver ficha">
														<Eye size={16} />
													</button>
													{canDeleteOperational && (
														<button
															onClick={(e) => handleDeleteClick(e, client)}
															className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors"
															title="Archivar">
															<Trash2 size={16} />
														</button>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			) : (
			<div
				className="flex-1 min-w-0 overflow-hidden flex flex-col w-full">
				{selectedClient ? (
					<>
						<div className="pb-4 mb-1 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
							<div className="flex items-center gap-4">
								<button
									onClick={() => selectClient(null)}
									className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors shrink-0 shadow-sm"
									title="Volver">
									<ArrowLeft size={20} />
								</button>
								<div>
									<h2 className="text-xl xl:text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
										{selectedClient.name} {selectedClient.surname}
										{selectedClient.is_company && (
											<span className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 font-medium rounded border border-gray-200">
												Empresa
											</span>
										)}
									</h2>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{clientDetailTab === "datos" && (
									<button
										onClick={(e) => handleSaveClient({ preventDefault: () => {} })}
										disabled={savingClient}
										className="px-4 py-2 bg-rose-700 text-white rounded-lg text-sm font-semibold hover:bg-rose-800 transition-colors flex items-center gap-2 disabled:opacity-50">
										{savingClient ? "Guardando..." : "Guardar Cambios"}
									</button>
								)}
							</div>
						</div>

						{/* Pestañas perfil 360º - Visitas primero */}
						<div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
							{[
								{ id: "datos", label: "Datos Cliente", icon: User },
								{ id: "visitas", label: "Historial/Sesiones", icon: BookOpen },
								{ id: "documentacion", label: "Documentación", icon: FolderOpen },
							].map(({ id, label, icon: Icon }) => (
								<button
									key={id}
									type="button"
									onClick={() => setClientDetailTab(id)}
									className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
										clientDetailTab === id
											? "border-rose-700 text-rose-700"
											: "border-transparent text-gray-400 hover:text-gray-600"
									}`}>
									<Icon size={16} />
									{label}
								</button>
							))}
						</div>

						<div className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
							{clientDetailTab === "visitas" && (
								<div className="space-y-8 pb-10">
									<div className="flex justify-between items-end mb-6">
										<div>
											<h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
												<BookOpen size={20} className="text-rose-700" /> Línea de tiempo
											</h3>
											<p className="text-sm text-slate-500 mt-1">
												Historial unificado de sesiones, facturación y notas de evolución.
											</p>
										</div>
										<button
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
												setVisitFormOpen(true);
											}}
											className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 font-bold rounded-xl hover:bg-rose-100 transition-colors text-sm shadow-sm">
											<Plus size={16} /> Nueva nota manual
										</button>
									</div>

									{visitFormOpen && (
										<div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm mb-6">
											<div className="flex justify-between items-center mb-4">
												<h4 className="font-bold text-slate-800 flex items-center gap-2">
													{editingVisitId ? (
														<><Edit2 size={16} className="text-rose-700"/> Editar nota</>
													) : (
														<><Plus size={16} className="text-rose-700"/> Nueva nota</>
													)}
												</h4>
												<button
													onClick={() => setVisitFormOpen(false)}
													className="text-slate-400 hover:text-slate-600">
													<X size={18} />
												</button>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
												<div>
													<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
														Título / Resumen
													</label>
													<input
														type="text"
														className="w-full p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl text-sm font-bold text-slate-800 outline-none"
														placeholder="Ej: Revisión post peeling"
														value={visitForm.titulo}
														onChange={(e) =>
															setVisitForm({ ...visitForm, titulo: e.target.value })
														}
													/>
												</div>
												<div>
													<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
														Fecha de la nota
													</label>
													<input
														type="date"
														className="w-full p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl text-sm font-bold text-slate-800 outline-none"
														value={visitForm.fecha_proximo_contacto}
														onChange={(e) =>
															setVisitForm({
																...visitForm,
																fecha_proximo_contacto: e.target.value,
															})
														}
													/>
												</div>
											</div>
											<div className="mb-4">
												<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
													Tratamientos implicados
												</label>
												<input
													type="text"
													className="w-full p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl text-sm font-bold text-slate-800 outline-none"
													placeholder="Ej: HIFU facial..."
													value={visitForm.tratamientos_interes}
													onChange={(e) =>
														setVisitForm({
															...visitForm,
															tratamientos_interes: e.target.value,
														})
													}
												/>
											</div>
											<div className="mb-4">
												<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
													Notas detalladas
												</label>
												<textarea
													rows="3"
													className="w-full p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl text-sm font-medium text-slate-700 outline-none resize-none"
													placeholder="Observaciones de la sesión, pautas dadas, evolución..."
													value={visitForm.notas}
													onChange={(e) =>
														setVisitForm({ ...visitForm, notas: e.target.value })
													}
												/>
											</div>
											<div className="flex justify-end">
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
																showToast("Nota actualizada");
															} else {
																await addSeguimiento(payload);
																showToast("Nota registrada");
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
													className="px-6 py-3 bg-rose-700 text-white font-bold rounded-xl hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm">
													{editingVisitId ? "Guardar cambios" : "Añadir nota"}
												</button>
											</div>
										</div>
									)}

									{(seguimientosLoading || historyLoading) ? (
										<div className="space-y-6">
											{[1, 2].map((i) => (
												<div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
											))}
										</div>
									) : timelineItems.length === 0 ? (
										<div className="flex flex-col items-center justify-center h-48 bg-white border border-gray-100 shadow-sm rounded-3xl">
											<BookOpen size={32} className="mb-3 text-slate-300" />
											<p className="font-bold text-slate-700">Sin historial registrado</p>
											<p className="text-sm text-slate-500 mt-1">Las facturas y notas aparecerán aquí.</p>
										</div>
									) : (
										<div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
											{timelineItems.map((group) => (
												<div key={group.date} className="relative">
													<div className="sticky top-4 flex items-center justify-center z-10 pointer-events-none mb-6">
														<div className="inline-block px-4 py-1.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-sm pointer-events-auto">
															{new Date(group.date).toLocaleDateString("es-ES", {
																weekday: "long",
																day: "numeric",
																month: "long",
																year: "numeric",
															})}
														</div>
													</div>
													
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-4">
														{/* Izquierda: Facturas */}
														<div className="space-y-4 pl-12 md:pl-0 md:pr-8">
															{group.sessions.length > 0 ? group.sessions.map(session => {
																const sessionPhotos = photos.filter(p => p.finance_entry_id === session.id);
																const beforePhoto = sessionPhotos.find(p => p.type === "before");
																const afterPhoto = sessionPhotos.find(p => p.type === "after");
																const extraPhotos = sessionPhotos.filter(p => p.type === "extra").sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
																const openPhotoViewer = () => setViewerSession({ session, before: beforePhoto, after: afterPhoto, extras: extraPhotos });
																
																return (
																	<div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-rose-200 transition-colors relative group">
																		<div className="absolute top-1/2 -right-4 md:-right-12 w-8 h-px bg-slate-200 hidden md:block" />
																		<div className="absolute top-1/2 -left-12 w-8 h-px bg-slate-200 md:hidden" />
																		<div className="flex justify-between items-start gap-4 mb-3">
																			<div>
																				<h4 className="font-bold text-slate-800">
																					{session.description?.split("(")[0] || "Sesión Facturada"}
																				</h4>
																				{session.plan_amigo && <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded uppercase">Plan Amigo</span>}
																			</div>
																			<div className="text-right shrink-0">
																				<span className="block font-black text-slate-800 text-lg">
																					{formatCurrency(session.amount)}
																				</span>
																				<span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">Pagado</span>
																			</div>
																		</div>
																		<div className="flex items-center gap-2 mt-4 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-100">
																			{beforePhoto && <SessionPhotoThumbnail photo={beforePhoto} label="Antes" onView={openPhotoViewer} onEdit={handlePhotoEdit} onDelete={handlePhotoDelete} />}
																			{afterPhoto && <SessionPhotoThumbnail photo={afterPhoto} label="Después" onView={openPhotoViewer} onEdit={handlePhotoEdit} onDelete={handlePhotoDelete} />}
																			{extraPhotos.map((ph) => <SessionPhotoThumbnail key={ph.id} photo={ph} compact onView={openPhotoViewer} onEdit={handlePhotoEdit} onDelete={handlePhotoDelete} />)}
																			<button onClick={() => { setPhotoUploadSession(session); setShowPhotoUploadModal(true); }} className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 hover:border-rose-300 hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-700 transition-colors shrink-0" title="Añadir foto">
																				<Camera size={16} />
																			</button>
																		</div>
																		<div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
																			{!session.plan_amigo && (
																				<button onClick={async () => {
																					try {
																						if (!ensureCompanyFiscalAddress(selectedClient)) return;
																						await generateInvoice(session, selectedClient, clinic, profile);
																						showToast("Factura generada");
																					} catch {
																						showToast("Error al generar factura", "error");
																					}
																				}} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors">
																					<FileDown size={14} /> Factura PDF
																				</button>
																			)}
																			{Number(session.amount) > 0 && (
																				<button onClick={() => openRefundModal(session)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
																					<RotateCcw size={14} /> Reembolso
																				</button>
																			)}
																		</div>
																	</div>
																);
															}) : (
																<div className="hidden md:flex flex-col items-center justify-center h-full text-slate-300 min-h-[100px]">
																	<span className="text-[10px] font-bold uppercase tracking-widest">Sin Facturación</span>
																</div>
															)}
														</div>

														{/* Derecha: Notas */}
														<div className="space-y-4 pl-12 md:pl-8 md:pr-0">
															{group.notes.length > 0 ? group.notes.map(seg => (
																<div key={seg.id} className="bg-slate-50 p-5 rounded-2xl shadow-sm border border-slate-200 relative group/note">
																	<div className="absolute top-1/2 -left-4 md:-left-12 w-8 h-px bg-slate-200 hidden md:block" />
																	<div className="absolute top-1/2 -left-12 w-8 h-px bg-slate-200 md:hidden" />
																	<div className="flex justify-between items-start gap-2 mb-2">
																		<h4 className="font-bold text-slate-800 text-sm">
																			{seg.titulo || "Nota Clínica"}
																		</h4>
																		<div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
																			<button onClick={() => {
																				setEditingVisitId(seg.id);
																				setVisitForm({
																					titulo: seg.titulo || "",
																					tratamientos_interes: seg.tratamientos_interes || "",
																					fecha_proximo_contacto: seg.fecha_proximo_contacto || "",
																					notas: seg.notas || "",
																					indicaciones_post: seg.indicaciones_post || "",
																				});
																				setVisitFormOpen(true);
																			}} className="p-1.5 text-slate-400 hover:text-rose-700 rounded bg-white shadow-sm">
																				<Edit2 size={14} />
																			</button>
																			{canDeleteOperational && (
																				<button onClick={async () => {
																					if (!confirm("¿Eliminar nota?")) return;
																					try {
																						await deleteSeguimiento(seg.id);
																						showToast("Nota eliminada");
																					} catch {
																						showToast("Error al eliminar", "error");
																					}
																				}} className="p-1.5 text-slate-400 hover:text-rose-700 rounded bg-white shadow-sm">
																					<Trash2 size={14} />
																				</button>
																			)}
																		</div>
																	</div>
																	{seg.tratamientos_interes && (
																		<div className="mb-3">
																			<span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">Tratamientos</span>
																			<p className="text-sm text-slate-700 font-medium break-words overflow-hidden">{seg.tratamientos_interes}</p>
																		</div>
																	)}
																	{seg.notas && (
																		<div>
																			<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Observaciones</span>
																			<p className="text-sm text-slate-600 break-words whitespace-pre-wrap leading-relaxed overflow-hidden">{seg.notas}</p>
																		</div>
																	)}
																</div>
															)) : (
																<div className="hidden md:flex flex-col items-center justify-center h-full text-slate-300 min-h-[100px]">
																	<span className="text-[10px] font-bold uppercase tracking-widest">Sin Notas</span>
																</div>
															)}
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							)}
							{clientDetailTab === "datos" && (
								<div className="space-y-6">
									<h3 className="font-black text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<User size={14} /> Información General & Fiscal
									</h3>
									
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Nombre
											</label>
											<input
												required
												placeholder="Ej: Laura"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.name}
												onChange={(e) =>
													setFormData({ ...formData, name: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Apellidos
											</label>
											<input
												required
												placeholder="Ej: Gómez Pérez"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.surname}
												onChange={(e) =>
													setFormData({ ...formData, surname: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												NIF / CIF
											</label>
											<input
												placeholder="Ej: 12345678A"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.nif}
												onChange={(e) =>
													setFormData({ ...formData, nif: e.target.value.toUpperCase() })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Teléfono / WhatsApp
											</label>
											<input
												required
												type="tel"
												placeholder="Ej: +34 600 000 000"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.phone}
												onChange={(e) =>
													setFormData({ ...formData, phone: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Fecha Nacimiento
											</label>
											<input
												type="date"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.fecha_nacimiento}
												onChange={(e) =>
													setFormData({
														...formData,
														fecha_nacimiento: e.target.value,
													})
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Origen
											</label>
											<select
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.origin}
												onChange={(e) =>
													setFormData({ ...formData, origin: e.target.value })
												}>
												<option value="">(No especificado)</option>
												<option value="Instagram">Instagram</option>
												<option value="Google">Google / Búsqueda</option>
												<option value="Recomendacion">Recomendado por un amigo</option>
												<option value="Fisico">Pase por la clínica</option>
												<option value="Doctoralia">Doctoralia</option>
												<option value="Otro">Otro</option>
											</select>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Estado
											</label>
											<select
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold shadow-sm text-slate-800"
												value={formData.estado || "activo"}
												onChange={(e) =>
													setFormData({ ...formData, estado: e.target.value })
												}>
												<option value="activo">Activo</option>
												<option value="inactivo">Inactivo</option>
												<option value="bloqueado">Bloqueado</option>
												<option value="borrador">Borrador / Lead</option>
											</select>
										</div>
									</div>

									<div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
										<label className="flex items-start gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={formData.is_company}
												onChange={(e) =>
													setFormData({
														...formData,
														is_company: e.target.checked,
													})
												}
												className="mt-1 w-5 h-5 rounded border-gray-300 text-rose-700 focus:ring-rose-700"
											/>
											<div>
												<span className="font-bold text-slate-800 block text-sm">Es una Empresa / B2B (Requiere Factura Completa)</span>
												<span className="text-xs text-slate-500 font-medium">Obligatorio rellenar NIF y Dirección Fiscal si se marca.</span>
											</div>
										</label>
										{formData.is_company && (
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-50">
												<div>
													<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
														Retención IRPF (%)
													</label>
													<select
														className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-bold text-slate-800"
														value={formData.irpf_withholding_rate}
														onChange={(e) =>
															setFormData({
																...formData,
																irpf_withholding_rate: e.target.value,
															})
														}>
														<option value="7">7% (Nuevos autónomos)</option>
														<option value="15">15% (General)</option>
														<option value="0">0% (Sin retención)</option>
													</select>
												</div>
												<div>
													<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
														Dirección Fiscal Completa
													</label>
													<textarea
														rows="2"
														placeholder="Calle, Número, Piso, Ciudad, CP, Provincia"
														className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-medium resize-none text-slate-800"
														value={formData.address}
														onChange={(e) =>
															setFormData({ ...formData, address: e.target.value })
														}
													/>
												</div>
											</div>
										)}
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-1 block ml-1">
												Alergias / Contraindicaciones
											</label>
											<textarea
												rows="3"
												placeholder="Importante destacar si tiene alergias a algún producto"
												className="w-full p-4 bg-rose-50 border-2 border-transparent focus:bg-white focus:border-rose-200 rounded-2xl outline-none font-medium resize-none text-slate-800"
												value={formData.allergies}
												onChange={(e) =>
													setFormData({ ...formData, allergies: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">
												Notas Internas Privadas
											</label>
											<textarea
												rows="3"
												placeholder="Notas o preferencias del paciente"
												className="w-full p-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl outline-none font-medium resize-none shadow-sm text-slate-800"
												value={formData.notas_privadas}
												onChange={(e) =>
													setFormData({ ...formData, notas_privadas: e.target.value })
												}
											/>
										</div>
									</div>
									<div className="pt-6 mt-6 border-t border-gray-100 space-y-4">
											<h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Legal y Privacidad</h3>
											<div className="flex flex-col gap-3">
												<label className="flex items-start gap-3 cursor-pointer">
													<input
														type="checkbox"
														checked={formData.has_consent}
														onChange={async (e) => {
															const val = e.target.checked;
															setFormData({ ...formData, has_consent: val });
															await supabase.from("clients").update({ has_consent: val }).eq("id", selectedClient.id);
															showToast("Estado legal actualizado");
														}}
														className="mt-0.5 w-5 h-5 rounded border-gray-300 text-rose-700 focus:ring-rose-700"
													/>
													<div>
														<span className="font-bold text-slate-800 block text-sm">Protección de Datos (LOPD) Firmada</span>
													</div>
												</label>
												
												<label className="flex items-start gap-3 cursor-pointer">
													<input
														type="checkbox"
														checked={formData.has_image_rights}
														onChange={async (e) => {
															const val = e.target.checked;
															setFormData({ ...formData, has_image_rights: val });
															await supabase.from("clients").update({ has_image_rights: val }).eq("id", selectedClient.id);
															showToast("Estado de imagen actualizado");
														}}
														className="mt-0.5 w-5 h-5 rounded border-gray-300 text-rose-700 focus:ring-rose-700"
													/>
													<div>
														<span className="font-bold text-slate-800 block text-sm">Derechos de Imagen</span>
													</div>
												</label>
											</div>
										</div>
								</div>
							)}

							{clientDetailTab === "medico-deprecated" && (
								<div className="space-y-6">
									<h3 className="font-black text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
										<Stethoscope size={14} /> Datos médicos
									</h3>
									<div>
										<dt className="text-[10px] font-black text-slate-400 uppercase mb-1">
											Alergias
										</dt>
										<dd
											className={`p-4 rounded-2xl text-sm font-medium ${
												selectedClient.allergies
													? "bg-red-50 border-2 border-red-200 text-red-900"
													: "bg-gray-50 text-slate-500 border border-gray-100"
											}`}>
											{selectedClient.allergies || "Ninguna indicada"}
										</dd>
									</div>
									<div>
										<dt className="text-[10px] font-black text-slate-400 uppercase mb-1">
											Antecedentes
										</dt>
										<dd className="p-4 bg-gray-50 rounded-2xl text-sm font-medium text-gray-700 border border-gray-100 min-h-[80px]">
											{selectedClient.medical_history || "—"}
										</dd>
									</div>
								</div>
							)}

							{clientDetailTab === "documentacion" && (
								<div className="space-y-8">
									<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
										
										{/* Columna Izquierda: Bonos */}
										<div className="space-y-4">
											<div className="flex justify-between items-center pb-2 border-b border-gray-100">
												<h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
													<Ticket size={16} className="text-rose-700" /> Bonos Activos
												</h3>
											</div>
											
											{bonosLoading ? (
												<div className="space-y-3">
													{[1, 2].map((i) => (
														<div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
													))}
												</div>
											) : clientBonos.length > 0 ? (
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
																className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden group ${
																	"border-slate-200"
																}`}>
																
																<div className="flex justify-between items-start mb-2 pr-2">
																	<div>
																		<h4 className="font-bold text-slate-800">{name}</h4>
																		{treatmentName && (
																			<p className="text-xs text-slate-500 font-medium">{treatmentName}</p>
																		)}
																	</div>
																	<div className="text-right">
																		<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
																			isExhausted ? "bg-gray-100 text-slate-500" : "bg-rose-50 text-rose-700"
																		}`}>
																			{isExhausted ? "Agotado" : "Activo"}
																		</span>
																	</div>
																</div>
																<p className="text-xs text-slate-600 font-medium mt-3">
																	Consumidas: {used} de {total} sesiones
																</p>
																<div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
																	<div 
																		className={`h-full rounded-full transition-all ${isExhausted ? "bg-slate-400" : "bg-rose-700"}`}
																		style={{ width: `${Math.min(pct, 100)}%` }}
																	/>
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
													<Ticket size={32} className="mb-2 opacity-50" />
													<p className="text-sm font-bold text-slate-600">Sin bonos activos</p>
													<p className="text-xs mt-1 text-center px-4">Vende un bono para generar sesiones prepagadas.</p>
												</div>
											)}
										</div>

										{/* Columna Derecha: Consentimientos y Legal */}
										<div className="space-y-8">
											<div className="space-y-4">
												<div className="flex justify-between items-center pb-2 border-b border-gray-100">
													<h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
														<FileCheck size={16} className="text-rose-700" /> Consentimientos
													</h3>
													<button
														onClick={() => {
															setConsentTreatmentId("");
															setConsentTemplateId("");
															setShowConsentModal(true);
														}}
														className="text-xs font-bold px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5">
														<Plus size={14} /> Generar PDF
													</button>
												</div>
												
												{/* Subir firmado */}
												<div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
													<p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
														Subir firmado (PDF)
													</p>
													<div className="flex flex-col sm:flex-row gap-3 items-end">
														<div className="flex-1 w-full">
															<select
																value={signedConsentTreatmentId}
																onChange={(e) => setSignedConsentTreatmentId(e.target.value)}
																className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-slate-800">
																<option value="">— Seleccionar Tratamiento —</option>
																{treatments.map((t) => (
																	<option key={t.id} value={t.id}>{t.name}</option>
																))}
															</select>
														</div>
														<div className="flex-1 w-full">
															<input
																type="file"
																accept=".pdf,application/pdf"
																onChange={(e) => setSignedConsentFile(e.target.files?.[0] || null)}
																className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-slate-200 file:text-slate-700"
															/>
														</div>
														<LoadingButton
															loading={uploadingSignedConsent}
															disabled={!signedConsentTreatmentId || !signedConsentFile || !user?.id}
															onClick={async () => {
																if (!signedConsentTreatmentId || !signedConsentFile || !selectedClient?.id || !user?.id) return;
																const treatment = treatments.find((t) => t.id === signedConsentTreatmentId);
																setUploadingSignedConsent(true);
																try {
																	if (!clinicId) { showToast("No hay clínica activa", "error"); return; }
																	await uploadSignedConsent({
																		userId: user.id, clinicId, clientId: selectedClient.id,
																		treatmentId: signedConsentTreatmentId, treatmentName: treatment?.name || "Tratamiento", file: signedConsentFile,
																	});
																	refetchSignedConsents();
																	setSignedConsentTreatmentId(""); setSignedConsentFile(null);
																	showToast("Consentimiento subido correctamente");
																} catch (err) {
																	showToast(err?.message || "Error al subir", "error");
																} finally {
																	setUploadingSignedConsent(false);
																}
															}}
															className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg disabled:opacity-50 transition-colors">
															Subir
														</LoadingButton>
													</div>
												</div>

												{signedConsentsLoading ? (
													<div className="space-y-3">
														{[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
													</div>
												) : signedConsents.length > 0 ? (
													<div className="space-y-3">
														{signedConsents.map((consent) => (
															<div key={consent.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-3 group">
																<div>
																	<p className="font-bold text-slate-800 text-sm">{consent.treatment_name}</p>
																	<p className="text-[11px] text-slate-500 font-medium">Subido {new Date(consent.uploaded_at).toLocaleDateString("es-ES")}</p>
																</div>
																<button onClick={async () => {
																		try {
																			const url = await getSignedConsentDownloadUrl(consent.storage_path);
																			if (url) window.open(url, "_blank");
																			else showToast("No se pudo generar el enlace", "error");
																		} catch { showToast("Error al descargar", "error"); }
																	}} className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors">
																	<FileDown size={16} />
																</button>
															</div>
														))}
													</div>
												) : (
													<div className="flex flex-col items-center justify-center h-32 bg-white rounded-xl border border-slate-100 text-slate-300">
														<FileCheck size={24} className="mb-2 opacity-50 text-slate-300" />
														<p className="font-bold text-xs text-slate-500">Ningún consentimiento firmado</p>
													</div>
												)}
											</div>

											<div className="space-y-4"><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
											<div className="pt-4 border-t border-slate-100">
														<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
															Carpeta Compartida (Drive/Dropbox)
														</label>
														<div className="flex gap-2">
															<input
																type="url"
																placeholder="Enlace a la nube..."
																className="flex-1 p-3 bg-gray-50 border border-transparent focus:bg-white focus:border-rose-100 rounded-xl text-sm font-medium text-slate-800 outline-none"
																value={formData.drive_url}
																onBlur={async (e) => {
																	await supabase.from("clients").update({ drive_url: e.target.value }).eq("id", selectedClient.id);
																}}
																onChange={(e) => setFormData({ ...formData, drive_url: e.target.value })}
															/>
															{formData.drive_url && (
																<a href={formData.drive_url} target="_blank" rel="noopener noreferrer" className="px-4 bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-colors" title="Abrir enlace">
																	<ExternalLink size={16} />
																</a>
															)}
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</>
				) : (
					<div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
						<UserPlus size={40} className="opacity-20 mb-4" />
						<h3 className="text-xl font-black text-slate-400">
							Selecciona un cliente
						</h3>
					</div>
				)}
			</div>
			)}

			

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
									<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tratamiento</label>
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
									<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Plantilla</label>
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
								<p className="text-[10px] text-slate-500 bg-gray-50 rounded-lg px-3 py-2">
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
									className="w-full py-4 bg-rose-700 hover:bg-rose-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2">
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
						<p className="text-sm text-slate-600">
							Factura original:{" "}
							<strong>
								{sessionToRefund.description?.split("(")[0] || "Sesión"}
							</strong>{" "}
							— {formatCurrency(sessionToRefund.amount)}
						</p>
						<div>
							<label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
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
