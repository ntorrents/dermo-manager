import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isVisible = (el) => {
	if (!el) return false;
	const style = window.getComputedStyle(el);
	if (style.visibility === "hidden" || style.display === "none") return false;
	return el.offsetParent !== null || style.position === "fixed";
};

const getFocusable = (root) => {
	if (!root) return [];
	return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
		(el) => isVisible(el) && !el.hasAttribute("disabled") && el.tabIndex !== -1,
	);
};

/**
 * Mantiene el foco dentro de `containerRef` mientras `active` es true.
 * - Tab/Shift+Tab rotan entre elementos focuseables
 * - Escape llama a `onEscape` (si existe)
 * - Al activar, enfoca el primer focuseable; al desactivar, restaura el foco previo
 */
export const useFocusTrap = (active, containerRef, { onEscape } = {}) => {
	const previousActiveElementRef = useRef(null);
	const onEscapeRef = useRef(onEscape);

	useEffect(() => {
		onEscapeRef.current = onEscape;
	}, [onEscape]);

	useEffect(() => {
		if (!active) return undefined;
		previousActiveElementRef.current = document.activeElement;

		const focusFirst = () => {
			// Si el foco ya está dentro (por ejemplo, input con autoFocus), no lo pisamos.
			if (containerRef.current?.contains(document.activeElement)) return;
			const list = getFocusable(containerRef.current);
			(list[0] || containerRef.current)?.focus?.();
		};

		// Defer 1 frame: el portal/modal a veces aún no ha pintado hijos
		const id = window.requestAnimationFrame(focusFirst);

		const onKeyDown = (event) => {
			if (event.key === "Escape" && onEscapeRef.current) {
				event.preventDefault();
				onEscapeRef.current();
				return;
			}
			if (event.key !== "Tab") return;

			const list = getFocusable(containerRef.current);
			if (list.length === 0) return;

			const first = list[0];
			const last = list[list.length - 1];
			const current = document.activeElement;

			if (event.shiftKey) {
				if (current === first || !containerRef.current?.contains(current)) {
					event.preventDefault();
					last.focus();
				}
			} else if (current === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			window.cancelAnimationFrame(id);
			document.removeEventListener("keydown", onKeyDown, true);
			const prev = previousActiveElementRef.current;
			if (prev && typeof prev.focus === "function") {
				try {
					prev.focus();
				} catch {
					/* ignore */
				}
			}
		};
	}, [active, containerRef]);
};
