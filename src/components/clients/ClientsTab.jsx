/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import {
	Search,
	Plus,
	Users,
	Phone,
	Calendar,
	Trash2,
	Edit2,
	FileText,
	UserPlus,
	X,
	Save,
	Clock,
	Check,
	ExternalLink,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useClientHistory } from "../../hooks/useClientHistory";
import { formatCurrency } from "../../utils/format";
import { ConfirmModal } from "../ui/ConfirmModal";

export const ClientsTab = ({
	user,
	clients = [],
	profile,
	showToast,
	onRefresh,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		phone: "",
		email: "",
		notes: "",
		has_consent: false,
		has_image_rights: false,
		drive_url: "",
	});

	// ESTADOS PARA EL MODAL DE BORRADO
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [clientToDelete, setClientToDelete] = useState(null);

	// CORRECCIÓN: Pasamos solo el ID al hook corregido
	const { history, loading: historyLoading } = useClientHistory(
		selectedClient?.id
	);

	const filteredClients = clients.filter(
		(c) =>
			c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.phone?.includes(searchTerm)
	);

	const handleOpenModal = (client = null) => {
		if (client) {
			setFormData({
				name: client.name || "",
				surname: client.surname || "",
				phone: client.phone || "",
				email: client.email || "",
				notes: client.notes || "",
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
				notes: "",
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
		try {
			const payload = {
				...formData,
				user_id: user.id,
				has_consent: formData.has_consent,
				has_image_rights: formData.has_image_rights,
				drive_url: formData.drive_url || null,
			};
			if (selectedClient && isModalOpen) {
				const { error } = await supabase
					.from("clients")
					.update(payload)
					.eq("id", selectedClient.id);
				if (error) throw error;
				showToast("Cliente actualizado");
			} else {
				const { error } = await supabase.from("clients").insert([payload]);
				if (error) throw error;
				showToast("Cliente creado");
			}
			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (error) {
			showToast("Error al guardar cliente", "error");
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
		} catch (error) {
			showToast("Error al eliminar", "error");
		} finally {
			setShowDeleteModal(false);
			setClientToDelete(null);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 xl:pb-0 h-[calc(100vh-120px)] flex flex-col xl:flex-row gap-6">
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Eliminar Cliente"
				message={`¿Seguro que quieres eliminar a ${clientToDelete?.name}? Se perderá todo su historial.`}
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			{/* LISTA DE CLIENTES: Se oculta en móvil si hay uno seleccionado */}
			<div
				className={`flex-1 bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col ${
					selectedClient ? "hidden xl:flex" : "flex"
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

				<div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
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
										<p className="text-xs text-gray-400">
											{client.phone || "Sin tlf"}
										</p>
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
													className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700">
													<ExternalLink size={12} />
													Ver Drive
												</a>
											)}
										</div>
									</div>
								</div>
								<button
									onClick={(e) => handleDeleteClick(e, client)}
									className="p-2 text-gray-300 hover:text-rose-500 shrink-0">
									<Trash2 size={16} />
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* DETALLE CLIENTE (Panel derecho) */}
			<div
				className={`flex-[2] bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex-col ${
					selectedClient ? "flex" : "hidden xl:flex"
				}`}>
				{selectedClient ? (
					<>
						<div className="p-6 xl:p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-start">
							<div className="flex items-center gap-4">
								<button
									onClick={() => setSelectedClient(null)}
									className="xl:hidden p-2 -ml-2 text-gray-400">
									<X size={24} />
								</button>
								<div className="w-12 h-12 xl:w-16 xl:h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-2xl flex items-center justify-center text-white text-xl xl:text-2xl font-black shadow-lg shadow-rose-100">
									{selectedClient.name.charAt(0)}
								</div>
								<div>
									<h2 className="text-xl xl:text-3xl font-black text-gray-800 tracking-tight">
										{selectedClient.name} {selectedClient.surname}
									</h2>
									<p className="text-sm font-bold text-gray-500">
										{selectedClient.phone}
									</p>
								</div>
							</div>
							<button
								onClick={() => handleOpenModal(selectedClient)}
								className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-rose-600 transition-all shadow-sm">
								<Edit2 size={18} />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-6 xl:p-8 custom-scrollbar bg-gray-50/30">
							<h3 className="font-black text-gray-400 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
								<Clock size={14} /> Historial
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
									{history.map((session) => (
										<div
											key={session.id}
											className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-rose-100 transition-all">
											<div className="flex items-start gap-4">
												<div className="flex flex-col items-center justify-center w-12 h-12 bg-rose-50 rounded-xl text-rose-500 font-bold border border-rose-100">
													<span className="text-sm leading-none">
														{new Date(session.date).getDate()}
													</span>
													<span className="text-[9px] uppercase">
														{new Date(session.date).toLocaleString("es-ES", {
															month: "short",
														})}
													</span>
												</div>
												<div>
													<h4 className="font-bold text-gray-800 text-sm xl:text-lg">
														{session.description.split("(")[0]}
													</h4>
													<p className="text-[10px] text-gray-400 font-medium uppercase">
														{session.date}
													</p>
												</div>
											</div>
											<div className="text-right">
												<span className="block font-black text-gray-800 text-lg xl:text-xl">
													{formatCurrency(session.amount)}
												</span>
												<span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
													Pagado
												</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center h-40 text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl">
									<FileText size={32} className="mb-2 opacity-50" />
									<p className="font-bold text-sm">Sin historial previo</p>
								</div>
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

			{/* MODAL CREAR/EDITAR CLIENTE */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-center p-4">
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>
					<div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
						<div className="p-6 xl:p-8 border-b bg-gray-50 flex justify-between items-center">
							<h3 className="text-xl xl:text-2xl font-black text-gray-800 tracking-tight">
								{selectedClient ? "Editar Cliente" : "Nuevo Cliente"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="p-2 hover:bg-white rounded-full transition-colors text-gray-400">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleSaveClient} className="p-6 xl:p-8 space-y-5">
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
							<textarea
								rows="3"
								className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-rose-100 rounded-2xl outline-none font-bold resize-none"
								placeholder="Notas privadas..."
								value={formData.notes}
								onChange={(e) =>
									setFormData({ ...formData, notes: e.target.value })
								}
							/>
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
									<span className="font-bold text-gray-700">¿Ha firmado Consentimiento?</span>
								</label>
								<label className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.has_image_rights}
										onChange={(e) =>
											setFormData({ ...formData, has_image_rights: e.target.checked })
										}
										className="w-5 h-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
									/>
									<span className="font-bold text-gray-700">¿Derechos de Imagen?</span>
								</label>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
									URL Carpeta Drive
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
							<button className="w-full bg-[#1e293b] text-white font-black py-4 rounded-[1.5rem] shadow-xl text-lg mt-4">
								Guardar Cliente
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
