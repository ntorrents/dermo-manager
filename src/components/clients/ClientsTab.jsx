// src/components/clients/ClientsTab.jsx
import React, { useState } from "react";
import {
	Search,
	Plus,
	User,
	Phone,
	Pencil,
	Trash2,
	X,
	Loader2,
	Calendar,
	Activity,
	Download,
} from "lucide-react";

// Sustituimos Firestore por Supabase
import { supabase } from "../../services/supabase";
import { useClients } from "../../hooks/useClients";
import { useClientHistory } from "../../hooks/useClientHistory";
import { generateInvoice } from "../../utils/invoiceGenerator";

// --- Subcomponente: Lista de Historial dentro del Modal ---
const ClientHistoryList = ({ user, client, profile }) => {
	// Nota: Asegúrate de migrar también useClientHistory a Supabase más adelante
	const { history, loading } = useClientHistory(user, client.id);

	if (loading)
		return (
			<div className="py-8 text-center">
				<Loader2 className="animate-spin inline text-rose-500 mr-2" />
				Cargando historial...
			</div>
		);

	if (history.length === 0)
		return (
			<div className="py-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
				<Activity className="mx-auto mb-2 opacity-20" size={48} />
				<p>No hay sesiones registradas para este paciente.</p>
			</div>
		);

	return (
		<div className="space-y-4">
			{history.map((entry) => (
				<div
					key={entry.id}
					className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span className="font-bold text-gray-800 text-sm">
								{entry.description?.split("(")[0]}
							</span>
							<span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
								{entry.amount}€
							</span>
						</div>
						<div className="flex items-center gap-4 text-xs text-gray-500">
							<span className="flex items-center gap-1">
								<Calendar size={12} /> {entry.date}
							</span>
						</div>
					</div>

					<button
						onClick={() => generateInvoice(entry, client, profile)}
						className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-2 rounded-lg hover:bg-rose-100 flex items-center gap-2 transition-colors"
						title="Descargar Factura PDF">
						<Download size={14} /> Factura
					</button>
				</div>
			))}
		</div>
	);
};

// --- Componente Principal ---
export const ClientsTab = ({ user, showToast, profile }) => {
	const { clients, loading } = useClients(user);
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingClient, setEditingClient] = useState(null);
	const [modalTab, setModalTab] = useState("details"); // 'details' | 'history'

	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		phone: "",
		email: "",
		address: "",
		notes: "",
	});

	const filteredClients = clients.filter(
		(c) =>
			c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.phone?.includes(searchTerm)
	);

	const openModal = (client = null) => {
		if (client) {
			setEditingClient(client);
			setFormData({
				name: client.name || "",
				surname: client.surname || "",
				phone: client.phone || "",
				email: client.email || "",
				address: client.address || "",
				notes: client.notes || "",
			});
			setModalTab("history");
		} else {
			setEditingClient(null);
			setFormData({
				name: "",
				surname: "",
				phone: "",
				email: "",
				address: "",
				notes: "",
			});
			setModalTab("details");
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		try {
			if (!formData.name) return showToast("El nombre es obligatorio", "error");

			if (editingClient) {
				// Lógica UPDATE en Supabase
				const { error } = await supabase
					.from("clients")
					.update({
						name: formData.name,
						surname: formData.surname,
						phone: formData.phone,
						email: formData.email,
						address: formData.address,
						notes: formData.notes,
					})
					.eq("id", editingClient.id);

				if (error) throw error;
				showToast("Cliente actualizado");
			} else {
				// Lógica INSERT en Supabase
				const { error } = await supabase.from("clients").insert([
					{
						...formData,
						user_id: user.uid || user.id, // Usamos el ID del usuario actual
					},
				]);

				if (error) throw error;
				showToast("Cliente creado correctamente");
			}
			setIsModalOpen(false);
		} catch (error) {
			console.error("Error saving client:", error.message);
			showToast("Error al guardar", "error");
		}
	};

	const handleDelete = async (id) => {
		if (confirm("¿Seguro que quieres eliminar este cliente?")) {
			try {
				const { error } = await supabase.from("clients").delete().eq("id", id);

				if (error) throw error;
				showToast("Cliente eliminado");
			} catch (error) {
				console.error("Error deleting client:", error.message);
				showToast("No se pudo eliminar el cliente", "error");
			}
		}
	};

	if (loading)
		return (
			<div className="p-8 flex justify-center">
				<Loader2 className="animate-spin text-rose-500" />
			</div>
		);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* Header y Buscador */}
			<div className="flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full md:max-w-md">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar por nombre, teléfono..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 ring-rose-100 outline-none shadow-sm"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => openModal()}
					className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors w-full md:w-auto justify-center">
					<Plus size={20} /> Nuevo Cliente
				</button>
			</div>

			{/* Tabla de Clientes */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
							<th className="p-4">Cliente</th>
							<th className="p-4 hidden md:table-cell">Contacto</th>
							<th className="p-4 hidden lg:table-cell">Notas</th>
							<th className="p-4 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{filteredClients.map((client) => (
							<tr
								key={client.id}
								className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
								onClick={() => openModal(client)}>
								<td className="p-4">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold uppercase">
											{client.name?.[0]}
											{client.surname?.[0]}
										</div>
										<div>
											<p className="font-bold text-gray-900">
												{client.name} {client.surname}
											</p>
										</div>
									</div>
								</td>
								<td className="p-4 hidden md:table-cell">
									<div className="text-sm text-gray-600 space-y-1">
										{client.phone && (
											<div className="flex items-center gap-2">
												<Phone size={14} /> {client.phone}
											</div>
										)}
									</div>
								</td>
								<td className="p-4 hidden lg:table-cell">
									<p className="text-sm text-gray-500 truncate max-w-xs">
										{client.notes || "-"}
									</p>
								</td>
								<td className="p-4 text-right">
									<div
										className="flex justify-end gap-2"
										onClick={(e) => e.stopPropagation()}>
										<button
											onClick={() => handleDelete(client.id)}
											className="p-2 text-gray-300 hover:text-red-500 transition-colors">
											<Trash2 size={16} />
										</button>
									</div>
								</td>
							</tr>
						))}
						{filteredClients.length === 0 && (
							<tr>
								<td colSpan="4" className="p-8 text-center text-gray-400">
									No se encontraron clientes.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Modal de Edición/Creación */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
						onClick={() => setIsModalOpen(false)}
					/>

					<div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
						{/* Cabecera */}
						<div className="border-b bg-gray-50 rounded-t-2xl shrink-0">
							<div className="p-4 flex justify-between items-center">
								<h3 className="font-bold text-lg text-gray-800">
									{editingClient
										? `${editingClient.name} ${editingClient.surname || ""}`
										: "Nuevo Cliente"}
								</h3>
								<button
									onClick={() => setIsModalOpen(false)}
									className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
									<X size={20} />
								</button>
							</div>

							{editingClient && (
								<div className="flex px-4 gap-4">
									<button
										onClick={() => setModalTab("history")}
										className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
											modalTab === "history"
												? "border-rose-500 text-rose-600"
												: "border-transparent text-gray-400 hover:text-gray-600"
										}`}>
										<div className="flex items-center gap-2">
											<Activity size={16} /> Historial
										</div>
									</button>
									<button
										onClick={() => setModalTab("details")}
										className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
											modalTab === "details"
												? "border-rose-500 text-rose-600"
												: "border-transparent text-gray-400 hover:text-gray-600"
										}`}>
										<div className="flex items-center gap-2">
											<User size={16} /> Datos Personales
										</div>
									</button>
								</div>
							)}
						</div>

						{/* Cuerpo con Scroll */}
						<div className="overflow-y-auto p-6 custom-scrollbar">
							{modalTab === "history" && editingClient && (
								<ClientHistoryList
									user={user}
									client={editingClient}
									profile={profile}
								/>
							)}

							{modalTab === "details" && (
								<form
									onSubmit={handleSave}
									className="space-y-4 animate-in fade-in">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Nombre *
											</label>
											<input
												required
												className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-rose-500 outline-none transition-all"
												value={formData.name}
												onChange={(e) =>
													setFormData({ ...formData, name: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Apellidos
											</label>
											<input
												className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-rose-500 outline-none transition-all"
												value={formData.surname}
												onChange={(e) =>
													setFormData({ ...formData, surname: e.target.value })
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Teléfono
											</label>
											<input
												type="tel"
												className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-rose-500 outline-none transition-all"
												value={formData.phone}
												onChange={(e) =>
													setFormData({ ...formData, phone: e.target.value })
												}
											/>
										</div>
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Email
											</label>
											<input
												type="email"
												className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-rose-500 outline-none transition-all"
												value={formData.email}
												onChange={(e) =>
													setFormData({ ...formData, email: e.target.value })
												}
											/>
										</div>
									</div>
									<div>
										<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
											Dirección
										</label>
										<input
											className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-rose-500 outline-none transition-all"
											placeholder="Para facturas..."
											value={formData.address}
											onChange={(e) =>
												setFormData({ ...formData, address: e.target.value })
											}
										/>
									</div>
									<div>
										<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
											Notas Médicas
										</label>
										<textarea
											className="w-full p-3 border border-gray-200 rounded-xl h-24 resize-none focus:border-rose-500 outline-none transition-all"
											placeholder="Alergias..."
											value={formData.notes}
											onChange={(e) =>
												setFormData({ ...formData, notes: e.target.value })
											}></textarea>
									</div>
									<div className="pt-2">
										<button className="w-full bg-rose-500 text-white font-bold py-3 rounded-xl hover:bg-rose-600 shadow-md transition-all">
											Guardar Ficha
										</button>
									</div>
								</form>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
