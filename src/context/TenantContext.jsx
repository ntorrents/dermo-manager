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
import {
	ALL_MODULES,
	planAllowsPresupuestosBonos,
	hasModule as checkModule,
} from "./tenantModulesShared";

const TenantContext = createContext(null);

export const useTenant = () => {
	const ctx = useContext(TenantContext);
	if (!ctx) {
		throw new Error("useTenant debe usarse dentro de TenantProvider");
	}
	return ctx;
};

export const TenantProvider = ({ children }) => {
	const { user } = useAuth();
	const userId = user?.id ?? null;
	const isPlatformSuperadmin = user?.app_metadata?.role === "superadmin";

	const [clinicId, setClinicId] = useState(null);
	const [clinicName, setClinicName] = useState(null);
	const [clinicData, setClinicData] = useState(null);
	const [subscriptionTier, setSubscriptionTier] = useState(null);
	const [activeModules, setActiveModules] = useState(() => [...ALL_MODULES]);
	const [roleModules, setRoleModules] = useState(null);
	const [clinicActive, setClinicActive] = useState(true);
	const [role, setRole] = useState("recepcion");
	const [impersonating, setImpersonating] = useState(false);
	const [loading, setLoading] = useState(true);

	const resetTenant = useCallback(() => {
		setClinicId(null);
		setClinicName(null);
		setClinicData(null);
		setSubscriptionTier(null);
		setActiveModules([...ALL_MODULES]);
		setRoleModules(null);
		setClinicActive(true);
		setRole("recepcion");
		setImpersonating(false);
	}, []);

	const loadClinicBundle = useCallback(async (targetClinicId, { asImpersonation = false } = {}) => {
		const [{ data: clinic, error: cErr }, { data: roleRow }] = await Promise.all([
			supabase
				.from("clinics")
				.select(
					"name, subscription_tier, billing_nif, billing_address, billing_city, billing_phone, logo_url, active, active_modules, custom_fee_eur, custom_email_domain, resend_domain_id, email_domain_status, email_dns_records, sender_email_name, sender_reply_to, leads_webhook_secret, outbound_webhook_url, outbound_webhook_secret",
				)
				.eq("id", targetClinicId)
				.maybeSingle(),
			supabase
				.from("clinic_role_modules")
				.select("allowed_modules, role")
				.eq("clinic_id", targetClinicId),
		]);

		if (cErr) console.error("TenantContext clinics:", cErr.message);

		const memRole = asImpersonation ? "admin" : "recepcion";
		let resolvedRole = memRole;

		if (!asImpersonation && userId) {
			const { data: mem } = await supabase
				.from("user_clinic_memberships")
				.select("role")
				.eq("user_id", userId)
				.eq("clinic_id", targetClinicId)
				.maybeSingle();
			resolvedRole = mem?.role ?? "recepcion";
		}

		setClinicId(targetClinicId);
		setClinicName(clinic?.name ?? null);
		setClinicData(clinic ?? null);
		setSubscriptionTier(clinic?.subscription_tier ?? null);
		setClinicActive(clinic?.active !== false);
		const mods =
			Array.isArray(clinic?.active_modules) && clinic.active_modules.length
				? clinic.active_modules
				: [...ALL_MODULES];
		setActiveModules(mods);
		setRole(resolvedRole);
		setImpersonating(asImpersonation);

		const match = (roleRow || []).find((r) => r.role === resolvedRole);
		setRoleModules(
			asImpersonation
				? null
				: Array.isArray(match?.allowed_modules)
					? match.allowed_modules
					: null,
		);
	}, [userId]);

	const loadTenant = useCallback(
		async (options = {}) => {
			const silent = Boolean(options.silent);

			if (!userId) {
				resetTenant();
				setLoading(false);
				return;
			}

			if (!silent) setLoading(true);

			try {
				if (user?.app_metadata?.role === "superadmin") {
					const { data: imp } = await supabase.rpc("platform_get_impersonation");
					const row = Array.isArray(imp) ? imp[0] : imp;
					if (row?.clinic_id) {
						await loadClinicBundle(row.clinic_id, { asImpersonation: true });
						return;
					}
					resetTenant();
					return;
				}

				if (!silent) resetTenant();

				const { data: profile, error: pErr } = await supabase
					.from("profiles")
					.select("clinic_id")
					.eq("id", userId)
					.maybeSingle();

				if (pErr || !profile?.clinic_id) {
					if (silent) resetTenant();
					return;
				}

				await loadClinicBundle(profile.clinic_id, { asImpersonation: false });
			} catch (e) {
				console.error("TenantContext:", e);
			} finally {
				if (!silent) setLoading(false);
			}
		},
		[userId, user?.app_metadata?.role, resetTenant, loadClinicBundle],
	);

	useEffect(() => {
		loadTenant({ silent: false });
	}, [loadTenant]);

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

	const startImpersonation = useCallback(
		async (targetClinicId) => {
			const { error } = await supabase.rpc("platform_start_impersonation", {
				p_clinic_id: targetClinicId,
			});
			if (error) throw error;
			await loadTenant({ silent: false });
		},
		[loadTenant],
	);

	const stopImpersonation = useCallback(async () => {
		const { error } = await supabase.rpc("platform_stop_impersonation");
		if (error) throw error;
		await loadTenant({ silent: false });
	}, [loadTenant]);

	const allowsPresupuestosBonos = useMemo(
		() =>
			planAllowsPresupuestosBonos(subscriptionTier) &&
			checkModule(activeModules, "bonos_manager") &&
			(roleModules == null || checkModule(roleModules, "bonos_manager") || role === "admin"),
		[subscriptionTier, activeModules, roleModules, role],
	);

	const canDeleteOperational = useMemo(
		() => role === "admin" || role === "staff_medico",
		[role],
	);

	const isAdmin = useMemo(() => role === "admin", [role]);

	const hasModule = useCallback(
		(moduleId) => {
			if (!moduleId) return true;
			if (isPlatformSuperadmin && !impersonating) return false;
			if (!clinicActive) return false;
			if (!checkModule(activeModules, moduleId)) return false;
			if (role === "admin" || impersonating) return true;
			if (roleModules == null) return true;
			return checkModule(roleModules, moduleId);
		},
		[activeModules, roleModules, role, clinicActive, isPlatformSuperadmin, impersonating],
	);

	const refreshTenant = useCallback(() => loadTenant({ silent: true }), [loadTenant]);

	const value = useMemo(
		() => ({
			clinicId,
			clinicName,
			subscriptionTier,
			role,
			clinic: clinicData ? { ...clinicData, id: clinicId } : null,
			activeModules,
			roleModules,
			clinicActive,
			hasModule,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			isPlatformSuperadmin,
			isImpersonating: impersonating,
			startImpersonation,
			stopImpersonation,
			loading,
			refreshTenant,
		}),
		[
			clinicId,
			clinicName,
			clinicData,
			subscriptionTier,
			role,
			activeModules,
			roleModules,
			clinicActive,
			hasModule,
			allowsPresupuestosBonos,
			canDeleteOperational,
			isAdmin,
			isPlatformSuperadmin,
			impersonating,
			startImpersonation,
			stopImpersonation,
			loading,
			refreshTenant,
		],
	);

	return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
