import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Preferencias de columnas por tabla (IKEA Effect), persistidas en localStorage.
 * @param {string} storageKey ej. c3linic_clients_columns
 * @param {{ id: string, label: string, defaultVisible?: boolean, required?: boolean }[]} columns
 */
export function useColumnPreferences(storageKey, columns) {
	const defaults = useMemo(() => {
		const map = {};
		(columns || []).forEach((col) => {
			map[col.id] = col.required ? true : col.defaultVisible !== false;
		});
		return map;
	}, [columns]);

	const [visible, setVisible] = useState(() => {
		if (typeof localStorage === "undefined") return defaults;
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return defaults;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object") return defaults;
			const next = { ...defaults };
			Object.keys(defaults).forEach((id) => {
				const col = columns.find((c) => c.id === id);
				if (col?.required) {
					next[id] = true;
				} else if (typeof parsed[id] === "boolean") {
					next[id] = parsed[id];
				}
			});
			return next;
		} catch {
			return defaults;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(visible));
		} catch {
			/* ignore quota / private mode */
		}
	}, [storageKey, visible]);

	const isVisible = useCallback((id) => visible[id] !== false, [visible]);

	const toggle = useCallback(
		(id) => {
			const col = columns.find((c) => c.id === id);
			if (col?.required) return;
			setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
		},
		[columns]
	);

	return { visible, isVisible, toggle, setVisible };
}
