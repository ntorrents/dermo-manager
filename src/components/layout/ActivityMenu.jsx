import React, { useEffect, useRef, useState } from "react";
import { Bell, History, Loader2 } from "lucide-react";
import { useAuditLog } from "../../hooks/useAuditLog";
import { auditActionLabel, auditEntityLabel } from "../../utils/auditLabels";

function formatWhen(iso) {
	if (!iso) return "";
	try {
		return new Date(iso).toLocaleString("es-ES", {
			day: "numeric",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

export const ActivityMenu = ({ clinicId, isAdmin, onOpenFullAudit }) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const panelRef = useRef(null);
	const { rows, loading, error, refresh } = useAuditLog(clinicId, {
		limit: 20,
		enabled: isAdmin && open,
	});

	useEffect(() => {
		function onDoc(e) {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	useEffect(() => {
		if (open && isAdmin) refresh();
	}, [open, isAdmin, refresh]);

	useEffect(() => {
		if (!open) return undefined;
		const items = () =>
			Array.from(panelRef.current?.querySelectorAll("button") || []).filter(
				(el) => !el.disabled && el.offsetParent !== null,
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
				const cur = list.indexOf(document.activeElement);
				focusAt(cur >= 0 ? cur + 1 : 0);
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				const list = items();
				const cur = list.indexOf(document.activeElement);
				focusAt(cur >= 0 ? cur - 1 : list.length - 1);
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [open]);

	if (!isAdmin) return null;

	return (
		<div className="relative shrink-0" ref={rootRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
				title="Actividad reciente"
				aria-label="Actividad reciente">
				<Bell size={20} />
			</button>
			{open && (
				<div
					ref={panelRef}
					className="absolute right-0 top-full z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 bg-white shadow-xl">
					<div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
						<span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
							<History size={14} /> Reciente
						</span>
					</div>
					<div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
						{loading ? (
							<div className="flex justify-center py-8 text-rose-500">
								<Loader2 className="animate-spin" size={22} />
							</div>
						) : error?.message ? (
							<p className="px-4 py-6 text-center text-sm text-amber-800">{error.message}</p>
						) : rows.length === 0 ? (
							<p className="px-4 py-6 text-center text-sm text-gray-400">
								Sin eventos nuevos aún. La auditoría no es retroactiva: haz un cambio en la app y
								vuelve a abrir este panel.
							</p>
						) : (
							rows.map((r) => (
								<div key={r.id} className="px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
									<p className="text-xs font-semibold text-gray-800 line-clamp-2">
										<span className="text-rose-600">{auditActionLabel(r.action)}</span>
										{" · "}
										{auditEntityLabel(r.entity_type)}
									</p>
									<p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{r.summary}</p>
									<p className="text-[10px] text-gray-400 mt-1">{formatWhen(r.created_at)}</p>
								</div>
							))
						)}
					</div>
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							onOpenFullAudit?.();
						}}
						className="w-full border-t border-gray-100 px-4 py-2.5 text-center text-xs font-bold text-rose-600 hover:bg-rose-50">
						Ver auditoría completa
					</button>
				</div>
			)}
		</div>
	);
};
