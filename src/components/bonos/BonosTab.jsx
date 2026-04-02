import React, { useState } from "react";
import {
	Plus,
	Trash2,
	Edit2,
	Ticket,
	X,
	Loader2,
	User,
	Calendar,
	Euro,
	Search,
} from "lucide-react";
import { useBonusTemplates, useSellBono } from "../../hooks/useBonos";
import { formatCurrency } from "../../utils/format";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";

export const BonosTab = ({
	user,
	clients = [],
	treatments = [],
	showToast,
	onRefresh,
}) => {
	const {
		templates,
		loading: templatesLoading,
		create,
		update,
		delete: deleteTemplate,
		isCreating,
		isUpdating,
		isDeleting,
	} = useBonusTemplates(user);
	const sellBono = useSellBono(user);

	const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
	const [editingTemplate, setEditingTemplate] = useState(null);
	const [templateForm, setTemplateForm] = useState({
		name: "",
		treatment_id: "",
		total_sessions: "",
		default_price: "",
	});
	const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
	const [templateToDelete, setTemplateToDelete] = useState(null);

	const [isSellModalOpen, setIsSellModalOpen] = useState(false);
	const [sellForm, setSellForm] = useState({
		client_id: "",
		template_id: "",
		payment_date: new Date().toISOString().split("T")[0],
		price_paid: "",
	});
	const [sellClientSearch, setSellClientSearch] = useState("");
	const [sellClientDropdown, setSellClientDropdown] = useState(false);

	const openTemplateModal = (t = null) => {
		if (t) {
			setEditingTemplate(t);
			setTemplateForm({
				name: t.name,
				treatment_id: t.treatment_id,
				total_sessions: String(t.total_sessions),
				default_price: String(t.default_price ?? ""),
			});
		} else {
			setEditingTemplate(null);
			setTemplateForm({
				name: "",
				treatment_id: "",
				total_sessions: "",
				default_price: "",
			});
		}
		setIsTemplateModalOpen(true);
	};

	const handleSaveTemplate = async (e) => {
		e.preventDefault();
		const payload = {
			name: templateForm.name.trim(),
			treatment_id: templateForm.treatment_id,
			total_sessions: Number(templateForm.total_sessions) || 0,
			default_price: Number(templateForm.default_price) || 0,
		};
		if (payload.total_sessions < 1 || payload.default_price < 0) {
			showToast("Sesiones y precio deben ser válidos", "error");
			return;
		}
		try {
			if (editingTemplate) {
				await update({ id: editingTemplate.id, payload });
				showToast("Plantilla actualizada");
			} else {
				await create(payload);
				showToast("Plantilla creada");
			}
			setIsTemplateModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al guardar", "error");
		}
	};

	const confirmDeleteTemplate = async () => {
		if (!templateToDelete) return;
		try {
			await deleteTemplate(templateToDelete.id);
			showToast("Plantilla eliminada");
			setShowDeleteTemplateModal(false);
			setTemplateToDelete(null);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al eliminar", "error");
		}
	};

	const openSellModal = () => {
		setSellForm({
			client_id: "",
			template_id: "",
			payment_date: new Date().toISOString().split("T")[0],
			price_paid: "",
		});
		setSellClientSearch("");
		setIsSellModalOpen(true);
	};

	const selectedTemplate = templates.find((t) => t.id === sellForm.template_id);
	const selectedClient = clients.find((c) => c.id === sellForm.client_id);
	const filteredClientsForSell = (clients || []).filter((c) =>
		`${c.name || ""} ${c.surname || ""}`.toLowerCase().includes(sellClientSearch.toLowerCase())
	);

	const handleTemplateSelect = (templateId) => {
		const t = templates.find((x) => x.id === templateId);
		setSellForm((prev) => ({
			...prev,
			template_id: templateId,
			price_paid: t ? String(t.default_price ?? "") : prev.price_paid,
		}));
	};

	const handleSellBono = async (e) => {
		e.preventDefault();
		if (!sellForm.client_id || !sellForm.template_id) {
			showToast("Selecciona cliente y plantilla", "error");
			return;
		}
		const price = Number(sellForm.price_paid);
		if (price < 0 || Number.isNaN(price)) {
			showToast("Precio no válido", "error");
			return;
		}
		const template = templates.find((t) => t.id === sellForm.template_id);
		try {
			await sellBono.mutateAsync({
				clientId: sellForm.client_id,
				templateId: sellForm.template_id,
				templateName: template?.name,
				treatmentId: template?.treatment_id,
				totalSessions: template?.total_sessions,
				pricePaid: price,
				paymentDate: sellForm.payment_date,
			});
			showToast("Bono vendido correctamente");
			setIsSellModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al vender bono", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-24 md:pb-0">
			<ConfirmModal
				isOpen={showDeleteTemplateModal}
				title="Eliminar plantilla"
				message={`¿Eliminar la plantilla "${templateToDelete?.name}"?`}
				onConfirm={confirmDeleteTemplate}
				onCancel={() => setShowDeleteTemplateModal(false)}
				isDestructive
			/>

			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h2 className="text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
					<Ticket className="text-rose-500" size={28} /> Bonos de sesiones
				</h2>
				<div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
					<button
						type="button"
						onClick={() => openTemplateModal()}
						className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors order-2 sm:order-1">
						<Plus size={18} /> Nueva plantilla
					</button>
					<button
						type="button"
						onClick={openSellModal}
						className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors w-full sm:w-auto order-1 sm:order-2">
						<Plus size={20} /> Vender bono
					</button>
				</div>
			</div>

			{/* Plantillas de Bonos */}
			<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 border-b border-gray-100">
					<h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
						<Ticket size={20} className="text-rose-500" /> Plantillas de bonos
					</h3>
					<p className="text-sm text-gray-500 mt-1">
						Catálogo de bonos que puedes vender a los pacientes.
					</p>
				</div>
				<div className="p-4 sm:p-6">
					{templatesLoading ? (
						<div className="flex items-center justify-center py-12 gap-2 text-gray-400">
							<Loader2 size={24} className="animate-spin" />
							<span className="font-medium">Cargando plantillas...</span>
						</div>
					) : templates.length === 0 ? (
						<EmptyState
							icon={Ticket}
							title="No hay plantillas"
							description="Crea tu primera plantilla para poder vender bonos (ej. 5 sesiones de Bótox)."
							actionLabel="Nueva plantilla"
							onAction={() => openTemplateModal()}
						/>
					) : (
						<>
						<div className="grid gap-3">
							{templates.map((t) => (
								<div
									key={t.id}
									className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-rose-100 transition-colors">
									<div>
										<p className="font-bold text-gray-900">{t.name}</p>
										<p className="text-sm text-gray-500">
											{t.treatments?.name ?? "Tratamiento"} · {t.total_sessions} sesiones
										</p>
									</div>
									<div className="flex items-center gap-3">
										<span className="font-black text-rose-600 text-lg">
											{formatCurrency(t.default_price)}
										</span>
										<button
											type="button"
											onClick={() => openTemplateModal(t)}
											className="p-2 bg-white text-gray-400 rounded-lg hover:bg-gray-100 hover:text-gray-600"
											title="Editar">
											<Edit2 size={16} />
										</button>
										<button
											type="button"
											onClick={() => {
												setTemplateToDelete(t);
												setShowDeleteTemplateModal(true);
											}}
											className="p-2 bg-white text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500"
											title="Eliminar">
											<Trash2 size={16} />
										</button>
									</div>
								</div>
							))}
						</div>
						</>
					)}
				</div>
			</div>

			{/* Modal: Nueva/Editar plantilla */}
			<AdaptiveModal
				isOpen={isTemplateModalOpen}
				onClose={() => setIsTemplateModalOpen(false)}
				title={editingTemplate ? "Editar plantilla" : "Nueva plantilla"}
				maxWidth="max-w-lg">
				<form onSubmit={handleSaveTemplate} className="space-y-6">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Nombre del bono
						</label>
						<input
							required
							placeholder="Ej: 5 sesiones Bótox"
							className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl outline-none font-bold"
							value={templateForm.name}
							onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Tratamiento
						</label>
						<select
							required
							className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer border-2 border-transparent focus:border-rose-100"
							value={templateForm.treatment_id}
							onChange={(e) =>
								setTemplateForm({ ...templateForm, treatment_id: e.target.value })
							}>
							<option value="">Seleccionar...</option>
							{(treatments || []).map((tr) => (
								<option key={tr.id} value={tr.id}>
									{tr.name}
								</option>
							))}
						</select>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
								Nº sesiones
							</label>
							<input
								type="number"
								min="1"
								required
								placeholder="5"
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"
								value={templateForm.total_sessions}
								onChange={(e) =>
									setTemplateForm({ ...templateForm, total_sessions: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
								Precio por defecto (€)
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								required
								placeholder="0.00"
								className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-rose-600"
								value={templateForm.default_price}
								onChange={(e) =>
									setTemplateForm({ ...templateForm, default_price: e.target.value })
								}
							/>
						</div>
					</div>
					<LoadingButton
						loading={isCreating || isUpdating}
						type="submit"
						className="w-full bg-surface-dark text-white font-black py-4 rounded-xl">
						{editingTemplate ? "Guardar cambios" : "Crear plantilla"}
					</LoadingButton>
				</form>
			</AdaptiveModal>

			{/* Modal: Vender Bono */}
			<AdaptiveModal
				isOpen={isSellModalOpen}
				onClose={() => setIsSellModalOpen(false)}
				title="Vender Bono a Paciente"
				maxWidth="max-w-lg">
				<form onSubmit={handleSellBono} className="space-y-6">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
							<User size={14} /> Paciente
						</label>
						{!selectedClient ? (
							<div className="relative">
								<Search
									className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
									size={18}
								/>
								<input
									placeholder="Buscar por nombre..."
									className="w-full pl-11 p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-rose-100 focus:bg-white"
									value={sellClientSearch}
									onChange={(e) => setSellClientSearch(e.target.value)}
									onFocus={() => setSellClientDropdown(true)}
									onBlur={() => setTimeout(() => setSellClientDropdown(false), 150)}
								/>
								{sellClientDropdown && (
									<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-20">
										{filteredClientsForSell.length > 0 ? (
											filteredClientsForSell.map((c) => (
												<button
													key={c.id}
													type="button"
													onMouseDown={(e) => e.preventDefault()}
													onClick={() => {
														setSellForm((prev) => ({ ...prev, client_id: c.id }));
														setSellClientSearch("");
														setSellClientDropdown(false);
													}}
													className="w-full text-left p-4 hover:bg-rose-50 flex items-center gap-3 border-b border-gray-50 last:border-0">
													<div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xs">
														{(c.name || "?")[0]}
													</div>
													<span className="font-bold text-gray-800 text-sm">
														{c.name} {c.surname}
													</span>
												</button>
											))
										) : (
											<div className="p-4 text-center text-gray-400 text-sm">
												{sellClientSearch ? "Sin resultados" : "Escribe para buscar"}
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex justify-between items-center">
								<span className="font-bold text-gray-900">
									{selectedClient.name} {selectedClient.surname}
								</span>
								<button
									type="button"
									onClick={() => setSellForm((prev) => ({ ...prev, client_id: "" }))}
									className="text-xs font-bold text-rose-600 hover:underline">
									Cambiar
								</button>
							</div>
						)}
					</div>

					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
							Plantilla de bono
						</label>
						<select
							required
							className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold appearance-none cursor-pointer border-2 border-transparent focus:border-rose-100"
							value={sellForm.template_id}
							onChange={(e) => handleTemplateSelect(e.target.value)}>
							<option value="">Seleccionar...</option>
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name} ({t.total_sessions} ses. · {formatCurrency(t.default_price)})
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
								<Calendar size={14} /> Fecha de pago
							</label>
							<input
								type="date"
								required
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-rose-100"
								value={sellForm.payment_date}
								onChange={(e) =>
									setSellForm((prev) => ({ ...prev, payment_date: e.target.value }))
								}
							/>
						</div>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
								<Euro size={14} /> Precio final (€)
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								required
								placeholder="0.00"
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-rose-600 outline-none border-2 border-transparent focus:border-rose-100"
								value={sellForm.price_paid}
								onChange={(e) =>
									setSellForm((prev) => ({ ...prev, price_paid: e.target.value }))
								}
							/>
						</div>
					</div>

					<LoadingButton
						loading={sellBono.isPending}
						type="submit"
						disabled={!sellForm.client_id || !sellForm.template_id}
						className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
						Vender bono
					</LoadingButton>
				</form>
			</AdaptiveModal>
		</div>
	);
};
