import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
	Search,
	Users,
	CalendarPlus,
	Package,
	Receipt,
	LayoutDashboard,
	Settings,
	ShoppingBag,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";

const NAV_ACTIONS = [
	{ id: "nav-home", label: "Ir a Inicio", path: "/", icon: LayoutDashboard, keywords: "dashboard home" },
	{ id: "nav-dash", label: "Ir a Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: "kpi" },
	{ id: "nav-clients", label: "Ir a Clientes", path: "/clientes", icon: Users, keywords: "pacientes" },
	{ id: "nav-cal", label: "Ir a Agenda", path: "/agenda", icon: CalendarPlus, keywords: "citas calendar" },
	{ id: "nav-inv", label: "Ir a Inventario", path: "/inventario", icon: Package, keywords: "stock" },
	{ id: "nav-fin", label: "Ir a Finanzas", path: "/finanzas/movimientos", icon: Receipt, keywords: "gastos ingresos" },
	{ id: "nav-prod", label: "Ir a Productos", path: "/productos", icon: ShoppingBag, keywords: "catalogo venta" },
	{ id: "nav-set", label: "Ir a Ajustes", path: "/ajustes", icon: Settings, keywords: "config apariencia" },
];

/**
 * Buscador universal ⌘K / Ctrl+K.
 * onQuickAction: callback opcional para acciones (nueva cita, etc.)
 */
export const CommandPalette = ({
	open,
	onOpenChange,
	clients = [],
	treatments = [],
	inventory = [],
	onQuickAction,
}) => {
	const navigate = useNavigate();
	const { hasModule } = useTenant();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const inputRef = useRef(null);

	useEffect(() => {
		const onKey = (e) => {
			const isMac = navigator.platform.toUpperCase().includes("MAC");
			if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				onOpenChange?.(!open);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onOpenChange]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setActive(0);
			return;
		}
		const t = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(t);
	}, [open]);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = [];

		items.push({
			id: "act-cita",
			group: "Acciones",
			label: "Nueva cita rápida",
			icon: CalendarPlus,
			run: () => onQuickAction?.("new-appointment"),
		});
		items.push({
			id: "act-appearance",
			group: "Acciones",
			label: "Ajustes → Apariencia",
			icon: Settings,
			run: () => navigate("/ajustes?section=appearance"),
		});

		for (const a of NAV_ACTIONS) {
			if (
				!q ||
				a.label.toLowerCase().includes(q) ||
				a.keywords.includes(q)
			) {
				items.push({
					id: a.id,
					group: "Navegación",
					label: a.label,
					icon: a.icon,
					run: () => navigate(a.path),
				});
			}
		}

		if (q.length >= 2) {
			(clients || [])
				.filter((c) =>
					`${c.name || ""} ${c.surname || ""} ${c.mobile || ""}`
						.toLowerCase()
						.includes(q),
				)
				.slice(0, 5)
				.forEach((c) => {
					items.push({
						id: `client-${c.id}`,
						group: "Clientes",
						label: [c.name, c.surname].filter(Boolean).join(" "),
						hint: c.mobile || c.email || "",
						icon: Users,
						preview: {
							title: [c.name, c.surname].filter(Boolean).join(" "),
							lines: [
								c.mobile && `Tel. ${c.mobile}`,
								c.email,
								c.estado && `Estado: ${c.estado}`,
							].filter(Boolean),
						},
						run: () => navigate("/clientes"),
					});
				});

			(treatments || [])
				.filter((t) => (t.name || "").toLowerCase().includes(q))
				.slice(0, 4)
				.forEach((t) => {
					items.push({
						id: `tr-${t.id}`,
						group: "Tratamientos",
						label: t.name,
						hint: t.price != null ? `${Number(t.price).toFixed(2)} €` : "",
						icon: Receipt,
						run: () => navigate("/tratamientos"),
					});
				});

			(inventory || [])
				.filter((i) => (i.name || "").toLowerCase().includes(q))
				.slice(0, 4)
				.forEach((i) => {
					items.push({
						id: `inv-${i.id}`,
						group: "Inventario",
						label: i.name,
						hint: `Stock ${i.stock ?? 0}`,
						icon: Package,
						run: () => navigate("/inventario"),
					});
				});
		}

		return items;
	}, [query, clients, treatments, inventory, navigate, onQuickAction, hasModule]);

	useEffect(() => {
		setActive(0);
	}, [query]);

	if (!open) return null;

	const current = results[active];

	const runItem = (item) => {
		onOpenChange?.(false);
		item?.run?.();
	};

	return createPortal(
		<div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4">
			<button
				type="button"
				className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
				aria-label="Cerrar"
				onClick={() => onOpenChange?.(false)}
			/>
			<div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-edge bg-surface shadow-2xl animate-in zoom-in-95">
				<div className="flex items-center gap-3 border-b border-edge px-4 py-3">
					<Search size={18} className="text-muted shrink-0" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setActive((i) => Math.min(i + 1, results.length - 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setActive((i) => Math.max(i - 1, 0));
							} else if (e.key === "Enter") {
								e.preventDefault();
								runItem(results[active]);
							} else if (e.key === "Escape") {
								onOpenChange?.(false);
							}
						}}
						placeholder="Buscar o ejecutar… (clientes, módulos, acciones)"
						className="flex-1 bg-transparent text-sm font-medium text-fg outline-none placeholder:text-muted"
					/>
					<kbd className="hidden sm:inline text-[10px] font-bold text-muted border border-edge rounded-md px-1.5 py-0.5">
						ESC
					</kbd>
				</div>
				<div className="grid sm:grid-cols-[1fr_0.9fr] max-h-[min(52vh,420px)]">
					<ul className="overflow-y-auto custom-scrollbar py-2">
						{results.length === 0 && (
							<li className="px-4 py-6 text-sm text-muted">Sin resultados</li>
						)}
						{results.map((item, idx) => {
							const Icon = item.icon || Search;
							const isActive = idx === active;
							return (
								<li key={item.id}>
									<button
										type="button"
										onMouseEnter={() => setActive(idx)}
										onClick={() => runItem(item)}
										className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
											isActive ? "bg-primary-soft text-fg" : "text-fg hover:bg-surface-2"
										}`}>
										<Icon size={16} className="text-muted shrink-0" />
										<span className="flex-1 min-w-0 truncate font-medium">{item.label}</span>
										{item.hint ? (
											<span className="text-[11px] text-muted shrink-0">{item.hint}</span>
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
					<aside className="hidden sm:block border-l border-edge bg-surface-2/50 p-4">
						{current?.preview ? (
							<div className="space-y-2">
								<p className="text-[11px] font-bold uppercase tracking-wider text-muted">
									Vista previa
								</p>
								<p className="font-bold text-fg">{current.preview.title}</p>
								{current.preview.lines.map((line) => (
									<p key={line} className="text-xs text-muted">
										{line}
									</p>
								))}
							</div>
						) : (
							<div className="text-xs text-muted leading-relaxed">
								<p className="font-bold text-fg mb-1">Atajos</p>
								<p>↑↓ navegar · Enter ejecutar · Esc cerrar</p>
								<p className="mt-3">{current?.group || "—"}</p>
							</div>
						)}
					</aside>
				</div>
			</div>
		</div>,
		document.body,
	);
};
