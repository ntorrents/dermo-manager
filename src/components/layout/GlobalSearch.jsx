import React, { useEffect, useMemo, useState } from "react";
import { Search, Users, Syringe, Package, X } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export const GlobalSearch = ({
	clients = [],
	treatments = [],
	inventory = [],
	setActiveTab,
	variant = "sidebar",
}) => {
	const isToolbar = variant === "toolbar";
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const debouncedQuery = useDebouncedValue(query, 200);
	const [activeIdx, setActiveIdx] = useState(-1);

	const results = useMemo(() => {
		if (!debouncedQuery || debouncedQuery.length < 2)
			return { clients: [], treatments: [], inventory: [] };
		const q = debouncedQuery.toLowerCase().trim();
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
	}, [debouncedQuery, clients, treatments, inventory]);

	const flatResults = useMemo(() => {
		const rows = [];
		results.clients.slice(0, 3).forEach((c) =>
			rows.push({
				kind: "client",
				id: c.id,
				label: `${c.name || ""} ${c.surname || ""}`.trim(),
				action: () => setActiveTab("clients"),
			}),
		);
		results.treatments.slice(0, 3).forEach((t) =>
			rows.push({
				kind: "treatment",
				id: t.id,
				label: t.name,
				action: () => setActiveTab("treatments"),
			}),
		);
		results.inventory.slice(0, 3).forEach((i) =>
			rows.push({
				kind: "inventory",
				id: i.id,
				label: i.name,
				action: () => setActiveTab("inventory"),
			}),
		);
		return rows;
	}, [results.clients, results.inventory, results.treatments, setActiveTab]);

	useEffect(() => {
		setActiveIdx(-1);
	}, [debouncedQuery]);

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
					role="combobox"
					aria-expanded={isOpen && query.length >= 2}
					aria-controls="global-search-results"
					placeholder="Buscar cliente, tratamiento o material…"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setIsOpen(true);
					}}
					onFocus={() => setIsOpen(true)}
					onBlur={() => setTimeout(() => setIsOpen(false), 200)}
					onKeyDown={(e) => {
						if (!isOpen || query.length < 2) return;
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActiveIdx((i) =>
								Math.min(i + 1, Math.max(flatResults.length - 1, -1)),
							);
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActiveIdx((i) => Math.max(i - 1, -1));
						} else if (e.key === "Enter") {
							if (activeIdx >= 0 && flatResults[activeIdx]) {
								e.preventDefault();
								flatResults[activeIdx].action();
								setQuery("");
								setIsOpen(false);
							}
						} else if (e.key === "Escape") {
							setIsOpen(false);
							setActiveIdx(-1);
						}
					}}
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
					id="global-search-results"
					role="listbox"
					className={`absolute top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 py-2 ${
						isToolbar ? "left-0 right-0" : "left-2 right-2"
					}`}>
					{hasResults ? (
						<>
							{flatResults.map((row, idx) => {
								const showHeading =
									idx === 0 || flatResults[idx - 1].kind !== row.kind;
								const heading =
									row.kind === "client"
										? { Icon: Users, label: "Clientes" }
										: row.kind === "treatment"
											? { Icon: Syringe, label: "Tratamientos" }
											: { Icon: Package, label: "Stock" };
								const H = heading.Icon;
								const selected = idx === activeIdx;
								return (
									<div key={`${row.kind}-${row.id}`} className="px-3 py-1">
										{showHeading && (
											<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
												<H size={12} /> {heading.label}
											</p>
										)}
										<button
											type="button"
											role="option"
											aria-selected={selected}
											onMouseEnter={() => setActiveIdx(idx)}
											onClick={() => {
												row.action();
												setQuery("");
												setIsOpen(false);
											}}
											className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${
												selected
													? "bg-rose-50 text-gray-900"
													: "hover:bg-rose-50 text-gray-800"
											}`}>
											{row.label}
										</button>
									</div>
								);
							})}
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
