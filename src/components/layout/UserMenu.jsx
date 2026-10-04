import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, LogOut, Settings, User } from "lucide-react";

export const UserMenu = ({
	user,
	profile,
	clinic,
	onLogout,
	onOpenSettings,
	compact = false,
	placement = "bottom",
	variant = "default",
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const menuRef = useRef(null);
	const dropUp = placement === "top";
	const sidebar = variant === "sidebar";

	useEffect(() => {
		function onDoc(e) {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	useEffect(() => {
		if (!open) return undefined;
		const items = () =>
			Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []).filter(
				(el) => !el.hasAttribute("disabled"),
			);
		const focusAt = (idx) => {
			const list = items();
			if (!list.length) return;
			const i = ((idx % list.length) + list.length) % list.length;
			list[i]?.focus?.();
		};

		requestAnimationFrame(() => focusAt(0));

		const onKeyDown = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				setOpen(false);
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				const list = items();
				const active = document.activeElement;
				const cur = list.indexOf(active);
				focusAt(cur >= 0 ? cur + 1 : 0);
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				const list = items();
				const active = document.activeElement;
				const cur = list.indexOf(active);
				focusAt(cur >= 0 ? cur - 1 : list.length - 1);
			}
			if (e.key === "Home") {
				e.preventDefault();
				focusAt(0);
			}
			if (e.key === "End") {
				e.preventDefault();
				const list = items();
				focusAt(list.length - 1);
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [open]);

	const displayName =
		[profile?.name, profile?.surname].filter(Boolean).join(" ").trim() ||
		user?.email?.split("@")[0] ||
		"Usuario";
	const initials = [profile?.name?.[0], profile?.surname?.[0]]
		.filter(Boolean)
		.join("")
		.toUpperCase() || (user?.email?.[0] || "U").toUpperCase();
	const logoUrl =
		clinic?.logo_url && /^https?:\/\//i.test(clinic.logo_url) ? clinic.logo_url : null;
	const Chevron = dropUp ? ChevronUp : ChevronDown;

	return (
		<div className={`relative shrink-0 ${sidebar ? "w-full" : ""}`} ref={rootRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={`flex items-center gap-2.5 rounded-xl border border-edge bg-surface hover:bg-surface-2 transition-colors ${
					sidebar
						? compact
							? "w-full justify-center p-2"
							: "w-full p-2 pr-2.5"
						: compact
							? "p-1.5 pr-2"
							: "p-1.5 pr-3"
				}`}
				aria-expanded={open}
				aria-haspopup="menu">
				<span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary text-xs font-bold ring-1 ring-edge">
					{logoUrl ? (
						<img src={logoUrl} alt="" className="h-full w-full object-cover" />
					) : (
						initials
					)}
				</span>
				{!compact && (
					<span className="min-w-0 flex-1 text-left">
						<span className="block truncate text-sm font-semibold text-fg">
							{displayName}
						</span>
						{sidebar && user?.email ? (
							<span className="block truncate text-[11px] text-muted">
								{user.email}
							</span>
						) : null}
					</span>
				)}
				{!compact && (
					<Chevron
						size={16}
						className={`text-muted shrink-0 transition-transform ${open ? "opacity-100" : "opacity-70"}`}
					/>
				)}
			</button>
			{open && (
				<div
					ref={menuRef}
					className={`absolute z-[60] w-56 rounded-xl border border-edge bg-surface py-1 shadow-xl ${
						dropUp ? "bottom-full mb-2 left-0 right-0 w-full min-w-[14rem]" : "right-0 top-full mt-2"
					}`}
					role="menu">
					<div className="border-b border-edge px-4 py-3">
						<p className="truncate text-sm font-bold text-fg">{displayName}</p>
						<p className="truncate text-xs text-muted">{user?.email}</p>
						{clinic?.name && (
							<p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-primary">
								{clinic.name}
							</p>
						)}
					</div>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							onOpenSettings?.();
						}}
						className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-fg hover:bg-primary-soft">
						<Settings size={18} className="text-muted" /> Configuración
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							onLogout?.();
						}}
						className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-danger hover:bg-danger/10">
						<LogOut size={18} /> Cerrar sesión
					</button>
					<div className="flex items-center gap-2 border-t border-edge px-4 py-2 text-[10px] text-muted">
						<User size={12} /> Sesión activa
					</div>
				</div>
			)}
		</div>
	);
};
