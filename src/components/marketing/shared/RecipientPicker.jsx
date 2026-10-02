import React, { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { parseExtraEmails } from "./emailQueue";

/**
 * Selector de destinatarios: clientes de la clínica + emails sueltos.
 * Nunca asume «todos» — hay que marcar o pegar correos.
 */
export const RecipientPicker = ({
	clients = [],
	selectedIds = [],
	onChangeIds,
	extraEmails = "",
	onChangeExtra,
}) => {
	const [q, setQ] = useState("");

	const withEmail = useMemo(
		() =>
			(clients || []).filter(
				(c) => c.email && String(c.email).trim() && c.activo !== false,
			),
		[clients],
	);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return withEmail;
		return withEmail.filter((c) => {
			const name = `${c.name || ""} ${c.surname || ""} ${c.email || ""}`.toLowerCase();
			return name.includes(term);
		});
	}, [withEmail, q]);

	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const parsedExtra = useMemo(() => parseExtraEmails(extraEmails), [extraEmails]);
	const total = selectedIds.length + parsedExtra.length;

	const toggle = (id) => {
		if (selectedSet.has(id)) {
			onChangeIds(selectedIds.filter((x) => x !== id));
		} else {
			onChangeIds([...selectedIds, id]);
		}
	};

	const selectVisible = () => {
		const ids = new Set(selectedIds);
		filtered.forEach((c) => ids.add(c.id));
		onChangeIds([...ids]);
	};

	const clearAll = () => onChangeIds([]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm font-black text-gray-900 inline-flex items-center gap-2">
					<Users size={16} /> Destinatarios
				</p>
				<span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
					{total} seleccionados
				</span>
			</div>
			<p className="text-xs text-gray-500">
				Elige clientes o pega emails externos. No se envía a nadie hasta que confirmes.
			</p>

			<div className="relative">
				<Search
					size={14}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
				/>
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Buscar cliente…"
					className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm font-semibold"
				/>
			</div>

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={selectVisible}
					className="text-xs font-bold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
					Marcar visibles ({filtered.length})
				</button>
				<button
					type="button"
					onClick={clearAll}
					className="text-xs font-bold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
					Limpiar clientes
				</button>
			</div>

			<ul className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
				{filtered.map((c) => (
					<li key={c.id}>
						<label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
							<input
								type="checkbox"
								checked={selectedSet.has(c.id)}
								onChange={() => toggle(c.id)}
								className="rounded border-gray-300 text-rose-700 focus:ring-rose-600"
							/>
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-semibold text-gray-900 truncate">
									{[c.name, c.surname].filter(Boolean).join(" ")}
								</span>
								<span className="block text-[11px] text-gray-400 truncate">
									{c.email}
								</span>
							</span>
						</label>
					</li>
				))}
				{filtered.length === 0 && (
					<li className="px-3 py-6 text-center text-sm text-gray-400">
						Ningún cliente con email
						{q ? " coincide con la búsqueda" : ""}.
					</li>
				)}
			</ul>

			<label className="block space-y-1">
				<span className="text-xs font-bold text-gray-500">
					Emails adicionales (separados por coma o salto de línea)
				</span>
				<textarea
					value={extraEmails}
					onChange={(e) => onChangeExtra(e.target.value)}
					rows={3}
					placeholder="ejemplo@correo.com, otro@dominio.es"
					className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
				/>
				{parsedExtra.length > 0 && (
					<span className="text-[11px] text-gray-400">
						{parsedExtra.length} email(s) válidos detectados
					</span>
				)}
			</label>
		</div>
	);
};
