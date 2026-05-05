import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";

export const UserMenu = ({
	user,
	profile,
	clinic,
	onLogout,
	onOpenSettings,
	compact = false,
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const menuRef = useRef(null);

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

		// foco inicial en primer ítem
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
	const logoUrl = clinic?.logo_url && /^https?:\/\//i.test(clinic.logo_url) ? clinic.logo_url : null;

	return (
		<div className="relative shrink-0" ref={rootRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={`flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${
					compact ? "p-1.5 pr-2" : "p-1.5 pr-3"
				}`}
				aria-expanded={open}
				aria-haspopup="menu">
				<span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-rose-50 text-rose-600 text-xs font-bold ring-1 ring-rose-100">
					{logoUrl ? (
						<img src={logoUrl} alt="" className="h-full w-full object-cover" />
					) : (
						initials
					)}
				</span>
				{!compact && (
					<span className="hidden sm:block max-w-[140px] truncate text-left text-sm font-semibold text-gray-800">
						{displayName}
					</span>
				)}
				<ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{open && (
				<div
					ref={menuRef}
					className="absolute right-0 top-full z-[60] mt-2 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
					role="menu">
					<div className="border-b border-gray-100 px-4 py-3">
						<p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
						<p className="truncate text-xs text-gray-500">{user?.email}</p>
						{clinic?.name && (
							<p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-rose-500">
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
						className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-rose-50">
						<Settings size={18} className="text-gray-400" /> Configuración
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							onLogout?.();
						}}
						className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50">
						<LogOut size={18} /> Cerrar sesión
					</button>
					<div className="flex items-center gap-2 border-t border-gray-50 px-4 py-2 text-[10px] text-gray-400">
						<User size={12} /> Sesión activa
					</div>
				</div>
			)}
		</div>
	);
};
