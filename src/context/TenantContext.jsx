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
	const [clinicId, setClinicId] = useState(null);
	const [clinicName, setClinicName] = useState(null);
	const [subscriptionTier, setSubscriptionTier] = useState(null);
	const [role, setRole] = useState("admin");
	const [loading, setLoading] = useState(true);

	const loadTenant = useCallback(async () => {
		if (!user) {
			setClinicId(null);
			setClinicName(null);
			setSubscriptionTier(null);
			setRole("admin");
			setLoading(false);
			return;
		}

		setLoading(true);
		setClinicId(null);
		setClinicName(null);
		setSubscriptionTier(null);
		setRole("admin");

		try {
			const { data: profile, error: pErr } = await supabase
				.from("profiles")
				.select("clinic_id")
				.eq("id", user.id)
				.maybeSingle();

			if (pErr || !profile?.clinic_id) {
				return;
			}

			const [{ data: clinic, error: cErr }, { data: mem, error: mErr }] =
				await Promise.all([
					supabase
						.from("clinics")
						.select("name, subscription_tier")
						.eq("id", profile.clinic_id)
						.maybeSingle(),
					supabase
						.from("user_clinic_memberships")
						.select("role")
						.eq("user_id", user.id)
						.eq("clinic_id", profile.clinic_id)
						.maybeSingle(),
				]);

			if (cErr) console.error("TenantContext clinics:", cErr.message);
			if (mErr) console.error("TenantContext memberships:", mErr.message);

			setClinicId(profile.clinic_id);
			setClinicName(clinic?.name ?? null);
			// Sin fila o error: no asumir integral (fail-closed para presupuestos/bonos).
			setSubscriptionTier(clinic?.subscription_tier ?? null);
			setRole(mem?.role ?? "admin");
		} catch (e) {
			console.error("TenantContext:", e);
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		loadTenant();
	}, [loadTenant]);

	// Tras cambios en BD (p. ej. subscription_tier), al volver a la pestaña se recarga.
	useEffect(() => {
		if (!user) return;
		const onVis = () => {
			if (document.visibilityState === "visible") loadTenant();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, [user, loadTenant]);

	const allowsPresupuestosBonos = useMemo(
		() => Boolean(subscriptionTier && MID_TIER.has(subscriptionTier)),
		[subscriptionTier]
	);

	const canDeleteOperational = useMemo(
		() => role === "admin" || role === "staff_medico",
		[role]
	);

	const isAdmin = useMemo(() => role === "admin", [role]);

	const value = useMemo(
		() => ({
			clinicId,
			clinicName,
			subscriptionTier,
			role,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			loading,
		}),
		[
			clinicId,
			clinicName,
			subscriptionTier,
			role,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			loading,
		]
	);

	return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
