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
	TrendingDown,
	Clock,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";

const RECENT_KEY = "baseclinica.cmdk.recent.v1";

const NAV_ACTIONS = [
	{ id: "nav-home", label: "Ir a Inicio", path: "/", icon: LayoutDashboard, keywords: "dashboard home" },
	{ id: "nav-dash", label: "Ir a Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: "kpi" },
	{ id: "nav-clients", label: "Ir a Clientes", path: "/clientes", icon: Users, keywords: "pacientes" },
	{ id: "nav-cal", label: "Ir a Agenda", path: "/agenda", icon: CalendarPlus, keywords: "citas calendar" },
	{ id: "nav-inv", label: "Ir a Inventario", path: "/inventario", icon: Package, keywords: "stock" },
	{ id: "nav-trace", label: "Ir a Trazabilidad", path: "/inventario/trazabilidad", icon: Package, keywords: "lotes consumo" },
	{ id: "nav-fin", label: "Ir a Finanzas", path: "/finanzas/movimientos", icon: Receipt, keywords: "gastos ingresos" },
	{ id: "nav-catalog", label: "Ir a Catálogo", path: "/catalogo", icon: ShoppingBag, keywords: "productos tratamientos bonos" },
	{ id: "nav-docs", label: "Ir a Documentos", path: "/documentos", icon: Receipt, keywords: "presupuestos consentimientos" },
	{ id: "nav-set", label: "Ir a Configuración", path: "/configuracion", icon: Settings, keywords: "ajustes apariencia" },
];

const QUICK_ACTIONS = [
	{
		id: "act-cita",
		group: "Acciones rápidas",
		label: "Nueva cita rápida",
		icon: CalendarPlus,
		hint: "⌘K",
	},
	{
		id: "act-gasto",
		group: "Acciones rápidas",
		label: "Nuevo gasto",
		icon: TrendingDown,
		hint: "Finanzas",
	},
	{
		id: "act-appearance",
		group: "Acciones rápidas",
		label: "Ajustes → Apariencia",
		icon: Settings,
	},
];

const readRecent = () => {
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
	} catch {
		return [];
	}
};

const pushRecent = (entry) => {
	try {
		const prev = readRecent().filter((r) => r.id !== entry.id);
		localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev].slice(0, 5)));
	} catch {
		/* ignore */
	}
};

/**
 * Buscador universal ⌘K / Ctrl+K.
 * Reciprocidad: con query vacía muestra acciones rápidas + recientes.
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
	const [recent, setRecent] = useState([]);
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
		setRecent(readRecent());
		const t = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(t);
	}, [open]);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = [];

		const runQuick = {
			"act-cita": () => onQuickAction?.("new-appointment"),
			"act-gasto": () => {
				onQuickAction?.("new-expense");
				navigate("/finanzas/movimientos?new=expense");
			},
			"act-appearance": () => navigate("/configuracion?section=appearance"),
		};

		if (!q) {
			for (const a of QUICK_ACTIONS) {
				items.push({
					...a,
					run: runQuick[a.id] || (() => {}),
				});
			}
			for (const r of recent) {
				items.push({
					id: `recent-${r.id}`,
					group: "Búsquedas recientes",
					label: r.label,
					icon: Clock,
					hint: r.hint || "",
					run: () => {
						if (r.path) navigate(r.path);
						else if (r.action) onQuickAction?.(r.action);
					},
				});
			}
			for (const a of NAV_ACTIONS.slice(0, 4)) {
				items.push({
					id: a.id,
					group: "Navegación",
					label: a.label,
					icon: a.icon,
					run: () => navigate(a.path),
				});
			}
			return items;
		}

		items.push({
			id: "act-cita",
			group: "Acciones",
			label: "Nueva cita rápida",
			icon: CalendarPlus,
			run: () => onQuickAction?.("new-appointment"),
		});
		items.push({
			id: "act-gasto",
			group: "Acciones",
			label: "Nuevo gasto",
			icon: TrendingDown,
			run: () => navigate("/finanzas/movimientos?new=expense"),
		});

		for (const a of NAV_ACTIONS) {
			if (
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
					const label = [c.name, c.surname].filter(Boolean).join(" ");
					items.push({
						id: `client-${c.id}`,
						group: "Clientes",
						label,
						hint: c.mobile || c.email || "",
						icon: Users,
						preview: {
							title: label,
							lines: [
								c.mobile && `Tel. ${c.mobile}`,
								c.email,
								c.estado && `Estado: ${c.estado}`,
							].filter(Boolean),
						},
						run: () => navigate("/clientes"),
						_recent: { id: `client-${c.id}`, label, path: "/clientes", hint: "Cliente" },
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
						run: () => navigate("/catalogo/tratamientos"),
						_recent: {
							id: `tr-${t.id}`,
							label: t.name,
							path: "/catalogo/tratamientos",
							hint: "Tratamiento",
						},
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
						_recent: {
							id: `inv-${i.id}`,
							label: i.name,
							path: "/inventario",
							hint: "Inventario",
						},
					});
				});
		}

		return items;
	}, [query, clients, treatments, inventory, navigate, onQuickAction, hasModule, recent]);

	useEffect(() => {
		setActive(0);
	}, [query]);

	if (!open) return null;

	const current = results[active];

	const runItem = (item) => {
		if (item?._recent) pushRecent(item._recent);
		else if (item?.group === "Navegación" || item?.group === "Acciones rápidas") {
			pushRecent({
				id: item.id,
				label: item.label,
				path: item.id.startsWith("nav-")
					? NAV_ACTIONS.find((n) => n.id === item.id)?.path
					: undefined,
				action: item.id === "act-cita" ? "new-appointment" : undefined,
				hint: item.group,
			});
		}
		onOpenChange?.(false);
		item?.run?.();
	};

	const groups = [];
	for (const item of results) {
		const last = groups[groups.length - 1];
		if (!last || last.name !== item.group) {
			groups.push({ name: item.group, items: [item] });
		} else {
			last.items.push(item);
		}
	}

	let flatIndex = -1;

	return createPortal(
		<div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4">
			<button
				type="button"
				className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
				aria-label="Cerrar"
				onClick={() => onOpenChange?.(false)}
			/>
			<div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95">
				<div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
					<Search size={18} className="text-slate-400 shrink-0" />
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
						placeholder="Buscar o ejecutar…"
						className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
					/>
					<kbd className="hidden sm:inline text-[10px] font-medium text-slate-400 border border-slate-200 rounded-md px-1.5 py-0.5">
						ESC
					</kbd>
				</div>
				<div className="grid sm:grid-cols-[1fr_0.85fr] max-h-[min(52vh,420px)]">
					<div className="overflow-y-auto custom-scrollbar py-2">
						{results.length === 0 && (
							<p className="px-4 py-6 text-sm text-slate-400">Sin resultados</p>
						)}
						{groups.map((g) => (
							<div key={g.name} className="mb-1">
								<p className="px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
									{g.name}
								</p>
								<ul>
									{g.items.map((item) => {
										flatIndex += 1;
										const idx = flatIndex;
										const Icon = item.icon || Search;
										const isActive = idx === active;
										return (
											<li key={item.id}>
												<button
													type="button"
													onMouseEnter={() => setActive(idx)}
													onClick={() => runItem(item)}
													className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
														isActive
															? "bg-slate-50 text-slate-900"
															: "text-slate-700 hover:bg-slate-50"
													}`}>
													<Icon size={16} className="text-slate-400 shrink-0" />
													<span className="flex-1 min-w-0 truncate font-medium">
														{item.label}
													</span>
													{item.hint ? (
														<span className="text-[11px] text-slate-400 shrink-0">
															{item.hint}
														</span>
													) : null}
												</button>
											</li>
										);
									})}
								</ul>
							</div>
						))}
					</div>
					<aside className="hidden sm:block border-l border-slate-100 bg-slate-50/50 p-4">
						{current?.preview ? (
							<div className="space-y-2">
								<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
									Vista previa
								</p>
								<p className="font-semibold text-slate-900">{current.preview.title}</p>
								{current.preview.lines.map((line) => (
									<p key={line} className="text-xs text-slate-500">
										{line}
									</p>
								))}
							</div>
						) : (
							<div className="text-xs text-slate-500 leading-relaxed space-y-2">
								<p className="font-semibold text-slate-800">Reciprocidad</p>
								<p>
									Acciones rápidas y recientes antes de escribir. ↑↓ navegar · Enter
									ejecutar.
								</p>
								<p className="text-slate-400">{current?.group || "—"}</p>
							</div>
						)}
					</aside>
				</div>
			</div>
		</div>,
		document.body,
	);
};
