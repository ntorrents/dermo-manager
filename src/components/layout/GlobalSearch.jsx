import React, { useState, useMemo } from "react";
import { Search, Users, Syringe, Package, X } from "lucide-react";

export const GlobalSearch = ({
	clients = [],
	treatments = [],
	inventory = [],
	activeTab,
	setActiveTab,
	variant = "sidebar",
}) => {
	const isToolbar = variant === "toolbar";
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);

	const results = useMemo(() => {
		if (!query || query.length < 2) return { clients: [], treatments: [], inventory: [] };
		const q = query.toLowerCase().trim();
		return {
			clients: clients.filter(
				(c) =>
					c.name?.toLowerCase().includes(q) ||
					c.surname?.toLowerCase().includes(q) ||
					c.phone?.includes(q)
			),
			treatments: treatments.filter((t) =>
				t.name?.toLowerCase().includes(q)
			),
			inventory: inventory.filter((i) =>
				i.name?.toLowerCase().includes(q)
			),
		};
	}, [query, clients, treatments, inventory]);

	const hasResults =
		results.clients.length > 0 ||
		results.treatments.length > 0 ||
		results.inventory.length > 0;

	return (
		<div className={`relative ${isToolbar ? "" : "px-4 pb-4"}`}>
			<div className="relative">
				<Search
					className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
					size={16}
				/>
				<input
					type="text"
					placeholder="Buscar cliente, tratamiento o material…"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setIsOpen(true);
					}}
					onFocus={() => setIsOpen(true)}
					onBlur={() => setTimeout(() => setIsOpen(false), 200)}
					className={`w-full pl-9 pr-8 outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-200 ${
						isToolbar
							? "py-2 text-sm font-medium bg-white border border-gray-200 rounded-xl shadow-sm"
							: "py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium"
					}`}
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery("")}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
						<X size={14} />
					</button>
				)}
			</div>
			{isOpen && query.length >= 2 && (
				<div
					className={`absolute top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 py-2 ${
						isToolbar ? "left-0 right-0" : "left-2 right-2"
					}`}>
					{hasResults ? (
						<>
							{results.clients.length > 0 && (
								<div className="px-3 py-1">
									<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
										<Users size={12} /> Clientes
									</p>
									{results.clients.slice(0, 3).map((c) => (
										<button
											key={c.id}
											onClick={() => {
												setActiveTab("clients");
												setQuery("");
												setIsOpen(false);
											}}
											className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-sm font-bold text-gray-800">
											{c.name} {c.surname || ""}
										</button>
									))}
								</div>
							)}
							{results.treatments.length > 0 && (
								<div className="px-3 py-1">
									<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
										<Syringe size={12} /> Tratamientos
									</p>
									{results.treatments.slice(0, 3).map((t) => (
										<button
											key={t.id}
											onClick={() => {
												setActiveTab("treatments");
												setQuery("");
												setIsOpen(false);
											}}
											className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-sm font-bold text-gray-800">
											{t.name}
										</button>
									))}
								</div>
							)}
							{results.inventory.length > 0 && (
								<div className="px-3 py-1">
									<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
										<Package size={12} /> Stock
									</p>
									{results.inventory.slice(0, 3).map((i) => (
										<button
											key={i.id}
											onClick={() => {
												setActiveTab("inventory");
												setQuery("");
												setIsOpen(false);
											}}
											className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-sm font-bold text-gray-800">
											{i.name}
										</button>
									))}
								</div>
							)}
						</>
					) : (
						<p className="px-4 py-4 text-gray-400 text-sm text-center">
							Sin resultados
						</p>
					)}
				</div>
			)}
		</div>
	);
};
