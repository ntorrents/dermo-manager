import React, { useState } from "react";
import {
	Search,
	Plus,
	User,
	Phone,
	X,
	Loader2,
	Calendar,
	Activity,
	Download,
	Trash2,
} from "lucide-react";

// Servicios e Hooks
import { supabase } from "../../services/supabase";
import { useClients } from "../../hooks/useClients";
import { useClientHistory } from "../../hooks/useClientHistory";
import { generateInvoice } from "../../utils/invoiceGenerator";

const ClientHistoryList = ({ user, client, profile }) => {
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
				<p>No hay sesiones registradas.</p>
			</div>
		);

	return (
		<div className="space-y-4">
			{history.map((entry) => (
				<div
					key={entry.id}
					className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span className="font-bold text-gray-800 text-sm">
								{entry.description?.split("(")[0]}
							</span>
							<span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
								{entry.amount}€
							</span>
						</div>
						<div className="text-xs text-gray-500 flex items-center gap-1">
							<Calendar size={12} /> {entry.date}
						</div>
					</div>
					<button
						onClick={() => generateInvoice(entry, client, profile)}
						className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-2 rounded-lg hover:bg-rose-100 transition-colors">
						<Download size={14} /> Factura
					</button>
				</div>
			))}
		</div>
	);
};

export const ClientsTab = ({ user, showToast, profile }) => {
	const { clients, loading } = useClients(user);
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingClient, setEditingClient] = useState(null);
	const [modalTab, setModalTab] = useState("details");

	const [formData, setFormData] = useState({
		name: "",
		surname: "",
		phone: "",
		email: "",
		address: "",
		notes: "",
		dni: "", // Aseguramos que existe el campo dni
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
				dni: client.dni || "",
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
				dni: "",
			});
			setModalTab("details");
		}
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		try {
			if (!formData.name) return showToast("El nombre es obligatorio", "error");

			// CORRECCIÓN CLAVE: user.id en lugar de user.uid
			const payload = {
				...formData,
				user_id: user.id,
			};

			if (editingClient) {
				// Al editar no es estrictamente necesario reenviar user_id, pero no daña
				const { error } = await supabase
					.from("clients")
					.update(formData) // Actualizamos solo los datos del form
					.eq("id", editingClient.id);
				if (error) throw error;
				showToast("Cliente actualizado");
			} else {
				const { error } = await supabase.from("clients").insert([payload]); // Aquí usamos el payload con user.id correcto
				if (error) throw error;
				showToast("Cliente creado");
			}
			setIsModalOpen(false);
		} catch (error) {
			console.error(error); // Para ver el error real en consola si ocurre
			showToast("Error al guardar", "error");
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
			<div className="flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative flex-1 w-full md:max-w-md">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar cliente..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 ring-rose-100"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					onClick={() => openModal()}
					className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm w-full md:w-auto justify-center">
					<Plus size={20} /> Nuevo Cliente
				</button>
			</div>

			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wider">
							<th className="p-4">Cliente</th>
							<th className="p-4 hidden md:table-cell">Contacto</th>
							<th className="p-4 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{filteredClients.map((client) => (
							<tr
								key={client.id}
								className="hover:bg-gray-50/50 cursor-pointer"
								onClick={() => openModal(client)}>
								<td className="p-4">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold uppercase">
											{client.name?.[0]}
											{client.surname?.[0]}
										</div>
										<p className="font-bold text-gray-900">
											{client.name} {client.surname}
										</p>
									</div>
								</td>
								<td className="p-4 hidden md:table-cell text-sm text-gray-600">
									{client.phone}
								</td>
								<td className="p-4 text-right">
									<button
										onClick={(e) => {
											e.stopPropagation();
											// Lógica de borrado pendiente, se puede añadir aquí
										}}
										className="p-2 text-gray-300 hover:text-red-500">
										<Trash2 size={16} />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* --- MODAL --- */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex justify-center items-start p-4">
					<div
						className="fixed inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setIsModalOpen(false)}
					/>

					<div className="relative bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col h-[calc(100vh-120px)] mt-[0px] animate-in slide-in-from-top-4 duration-300 overflow-hidden">
						{/* Cabecera */}
						<div className="border-b bg-gray-50 shrink-0 p-4 flex justify-between items-center">
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

						{/* Tabs */}
						{editingClient && (
							<div className="flex px-4 gap-4 bg-gray-50 border-b shrink-0">
								<button
									onClick={() => setModalTab("history")}
									className={`pb-3 text-sm font-bold border-b-2 pt-2 ${
										modalTab === "history"
											? "border-rose-500 text-rose-600"
											: "border-transparent text-gray-400"
									}`}>
									Historial
								</button>
								<button
									onClick={() => setModalTab("details")}
									className={`pb-3 text-sm font-bold border-b-2 pt-2 ${
										modalTab === "details"
											? "border-rose-500 text-rose-600"
											: "border-transparent text-gray-400"
									}`}>
									Datos Personales
								</button>
							</div>
						)}

						{/* Cuerpo */}
						<div className="overflow-y-auto p-6 flex-1 bg-white custom-scrollbar">
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
									className="space-y-4 h-full flex flex-col">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Nombre *
											</label>
											<input
												required
												className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
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
												className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
												value={formData.surname}
												onChange={(e) =>
													setFormData({ ...formData, surname: e.target.value })
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												Teléfono
											</label>
											<input
												className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
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
												className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
												value={formData.email}
												onChange={(e) =>
													setFormData({ ...formData, email: e.target.value })
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
												DNI
											</label>
											<input
												className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
												value={formData.dni}
												onChange={(e) =>
													setFormData({ ...formData, dni: e.target.value })
												}
											/>
										</div>
									</div>
									<div>
										<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
											Dirección
										</label>
										<input
											className="w-full p-2.5 border rounded-xl outline-none focus:border-rose-500"
											value={formData.address}
											onChange={(e) =>
												setFormData({ ...formData, address: e.target.value })
											}
										/>
									</div>
									<div>
										<label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
											Notas
										</label>
										<textarea
											className="w-full p-3 border rounded-xl h-32 resize-none outline-none focus:border-rose-500"
											value={formData.notes}
											onChange={(e) =>
												setFormData({ ...formData, notes: e.target.value })
											}
										/>
									</div>

									<div className="mt-auto pt-6">
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
