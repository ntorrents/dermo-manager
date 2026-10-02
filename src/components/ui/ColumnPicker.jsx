import React, { useEffect, useRef, useState } from "react";
import { Columns3, Settings2 } from "lucide-react";

/**
 * Dropdown para mostrar/ocultar columnas de tabla (preferencia en localStorage vía hook).
 */
export const ColumnPicker = ({
	columns = [],
	isVisible,
	onToggle,
	label = "Ver columnas",
}) => {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);

	useEffect(() => {
		if (!open) return undefined;
		const onDoc = (e) => {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div className="relative" ref={rootRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-haspopup="menu"
				title={label}
				className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors">
				<Settings2 size={14} className="shrink-0" />
				<span className="hidden sm:inline">{label}</span>
				<Columns3 size={14} className="sm:hidden shrink-0" />
			</button>
			{open && (
				<div
					role="menu"
					className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-100 bg-white shadow-lg p-2 animate-in fade-in zoom-in-95 duration-150">
					<p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
						Columnas visibles
					</p>
					<ul className="max-h-64 overflow-y-auto">
						{columns.map((col) => {
							const checked = isVisible(col.id);
							const locked = Boolean(col.required);
							return (
								<li key={col.id}>
									<label
										className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm cursor-pointer ${
											locked
												? "opacity-60 cursor-not-allowed"
												: "hover:bg-slate-50"
										}`}>
										<input
											type="checkbox"
											className="rounded border-slate-300 text-rose-700 focus:ring-rose-200"
											checked={checked}
											disabled={locked}
											onChange={() => onToggle(col.id)}
										/>
										<span className="font-medium text-slate-800">{col.label}</span>
										{locked && (
											<span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400">
												Fija
											</span>
										)}
									</label>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
};
