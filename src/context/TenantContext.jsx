import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";

const TenantContext = createContext(null);

/** Planes que pueden usar presupuestos y bonos (alineado con RLS). */
const MID_TIER = new Set(["clinic", "integral"]);

export const useTenant = () => {
	const ctx = useContext(TenantContext);
	if (!ctx) {
		throw new Error("useTenant debe usarse dentro de TenantProvider");
	}
	return ctx;
};

export const TenantProvider = ({ children }) => {
	const { user } = useAuth();
	// Solo el id: al volver a la pestaña Supabase refresca el token y emite un nuevo objeto `user`;
	// si loadTenant depende de `user`, se recrea, el efecto vuelve a correr en modo inicial y vacía el tenant + loader.
	const userId = user?.id ?? null;
	const [clinicId, setClinicId] = useState(null);
	const [clinicName, setClinicName] = useState(null);
	const [clinicData, setClinicData] = useState(null);
	const [subscriptionTier, setSubscriptionTier] = useState(null);
	const [role, setRole] = useState("admin");
	const [loading, setLoading] = useState(true);

	const loadTenant = useCallback(async (options = {}) => {
		const silent = Boolean(options.silent);

		if (!userId) {
			setClinicId(null);
			setClinicName(null);
			setClinicData(null);
			setSubscriptionTier(null);
			setRole("admin");
			setLoading(false);
			return;
		}

		if (!silent) {
			setLoading(true);
			setClinicId(null);
			setClinicName(null);
			setClinicData(null);
			setSubscriptionTier(null);
			setRole("admin");
		}

		try {
			const { data: profile, error: pErr } = await supabase
				.from("profiles")
				.select("clinic_id")
				.eq("id", userId)
				.maybeSingle();

			if (pErr || !profile?.clinic_id) {
				if (silent) {
					setClinicId(null);
					setClinicName(null);
					setClinicData(null);
					setSubscriptionTier(null);
					setRole("admin");
				}
				return;
			}

			const [{ data: clinic, error: cErr }, { data: mem, error: mErr }] =
				await Promise.all([
					supabase
						.from("clinics")
						.select("name, subscription_tier, billing_nif, billing_address, billing_city, billing_phone, logo_url")
						.eq("id", profile.clinic_id)
						.maybeSingle(),
					supabase
						.from("user_clinic_memberships")
						.select("role")
						.eq("user_id", userId)
						.eq("clinic_id", profile.clinic_id)
						.maybeSingle(),
				]);

			if (cErr) console.error("TenantContext clinics:", cErr.message);
			if (mErr) console.error("TenantContext memberships:", mErr.message);

			setClinicId(profile.clinic_id);
			setClinicName(clinic?.name ?? null);
			setClinicData(clinic ?? null);
			// Sin fila o error: no asumir integral (fail-closed para presupuestos/bonos).
			setSubscriptionTier(clinic?.subscription_tier ?? null);
			setRole(mem?.role ?? "admin");
		} catch (e) {
			console.error("TenantContext:", e);
		} finally {
			if (!silent) setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		loadTenant({ silent: false });
	}, [loadTenant]);

	// Cambios en BD (plan, rol, clínica): al volver a la pestaña o ventana, refresco en segundo plano
	// sin vaciar el tenant ni mostrar el loader a pantalla completa.
	useEffect(() => {
		if (!userId) return;
		let debounceTimer;
		const scheduleSilentRefresh = () => {
			if (document.visibilityState !== "visible") return;
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				loadTenant({ silent: true });
			}, 120);
		};
		const onPageShow = (e) => {
			if (e.persisted) scheduleSilentRefresh();
		};
		document.addEventListener("visibilitychange", scheduleSilentRefresh);
		window.addEventListener("focus", scheduleSilentRefresh);
		window.addEventListener("pageshow", onPageShow);
		return () => {
			clearTimeout(debounceTimer);
			document.removeEventListener("visibilitychange", scheduleSilentRefresh);
			window.removeEventListener("focus", scheduleSilentRefresh);
			window.removeEventListener("pageshow", onPageShow);
		};
	}, [userId, loadTenant]);

	const allowsPresupuestosBonos = useMemo(
		() => Boolean(subscriptionTier && MID_TIER.has(subscriptionTier)),
		[subscriptionTier]
	);

	const canDeleteOperational = useMemo(
		() => role === "admin" || role === "staff_medico",
		[role]
	);

	const isAdmin = useMemo(() => role === "admin", [role]);

	const refreshTenant = useCallback(() => loadTenant({ silent: true }), [loadTenant]);

	const value = useMemo(
		() => ({
			clinicId,
			clinicName,
			subscriptionTier,
			role,
			clinic: clinicData ? { ...clinicData, id: clinicId } : null,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			loading,
			refreshTenant,
		}),
		[
			clinicId,
			clinicName,
			clinicData,
			subscriptionTier,
			role,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			loading,
			refreshTenant,
		]
	);

	return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
