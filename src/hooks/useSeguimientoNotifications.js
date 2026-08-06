import { useEffect } from "react";
import { getOverdueSeguimientos } from "./useClinicSeguimientos";

const NOTIFIED_PREFIX = "seguimiento-notified.";

export function useSeguimientoNotifications(seguimientos = [], { enabled = true } = {}) {
	useEffect(() => {
		if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
		if (Notification.permission !== "granted") return;

		const today = new Date().toISOString().slice(0, 10);
		const due = getOverdueSeguimientos(seguimientos, today);
		due.forEach((s) => {
			const key = `${NOTIFIED_PREFIX}${s.id}.${today}`;
			try {
				if (sessionStorage.getItem(key)) return;
			} catch {
				return;
			}
			const title = s.titulo || "Seguimiento pendiente";
			try {
				// eslint-disable-next-line no-new
				new Notification(title, {
					body: `Contacto previsto: ${s.fecha_proximo_contacto}`,
					tag: key,
				});
				sessionStorage.setItem(key, "1");
			} catch {
				/* ignore */
			}
		});
	}, [seguimientos, enabled]);
}

/** Solicita permiso una vez si aún no está decidido. */
export function requestSeguimientoNotificationPermission() {
	if (typeof window === "undefined" || !("Notification" in window)) return;
	if (Notification.permission === "default") {
		Notification.requestPermission().catch(() => {});
	}
}
