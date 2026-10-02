import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
	ArrowLeft,
	Building2,
	Eye,
	Loader2,
	Plus,
	Save,
	Shield,
	Trash2,
	UserPlus,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useTenant } from "../../context/TenantContext";
import { PlatformAuditView } from "./PlatformAuditView";
import { PlatformTemplatesView } from "./PlatformTemplatesView";
import {
	ALL_MODULES,
	PLAN_DEFAULT_FEE_EUR,
	PLAN_DEFAULT_MODULES,
	PLAN_LABELS,
	CLINIC_ROLES,
	ROLE_LABELS,
	DEFAULT_ROLE_MODULES,
	effectiveClinicFeeEur,
	normalizeSubscriptionTier,
	withModuleDependencies,
} from "../../constants/saasModules";
import { ClinicModulesEditor } from "./ClinicModulesEditor";

const CLINIC_SELECT =
	"id, name, subscription_tier, active, active_modules, custom_fee_eur, created_at, billing_nif";

const formatBytes = (n) => {
	const v = Number(n) || 0;
	if (v < 1024) return `${v} B`;
	if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
	if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
	return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const SuperadminShell = ({ view = "dashboard" }) => {
	const { clinicId } = useParams();
	if (view === "clinic" || clinicId) return <ClinicManageView clinicId={clinicId} />;
	if (view === "users") return <UsersDirectoryView />;
	if (view === "tools") return <PlatformToolsView />;
	if (view === "logs") return <PlatformAuditView />;
	if (view === "templates") return <PlatformTemplatesView />;
	return <SuperadminDashboard />;
};

const SuperadminDashboard = () => {
	const navigate = useNavigate();
	const { startImpersonation } = useTenant();
	const [clinics, setClinics] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [growth, setGrowth] = useState(null);
	const [storage, setStorage] = useState(null);
	const [impBusy, setImpBusy] = useState(null);

	const load = async () => {
		setLoading(true);
		setError(null);
		const [{ data, error: err }, growthRes, storageRes] = await Promise.all([
			supabase.from("clinics").select(CLINIC_SELECT).order("name"),
			supabase.rpc("platform_growth_metrics"),
			supabase.rpc("platform_storage_metrics"),
		]);
		if (err) setError(err.message);
		else setClinics(data || []);
		if (!growthRes.error) setGrowth(growthRes.data);
		if (!storageRes.error) setStorage(storageRes.data);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, []);

	const activeClinics = useMemo(
		() => clinics.filter((c) => c.active !== false),
		[clinics],
	);

	const mrr = useMemo(
		() => activeClinics.reduce((acc, c) => acc + effectiveClinicFeeEur(c), 0),
		[activeClinics],
	);

	const createClinic = async () => {
		const name = newName.trim();
		if (!name) return;
		setCreating(true);
		const { data, error: err } = await supabase
			.from("clinics")
			.insert([
				{
					name,
					subscription_tier: "basic",
					active: true,
					active_modules: PLAN_DEFAULT_MODULES.basic,
				},
			])
			.select(CLINIC_SELECT)
			.single();
		if (!err && data?.id) {
			await supabase.rpc("seed_clinic_role_modules", { p_clinic_id: data.id });
		}
		setCreating(false);
		if (err) {
			setError(err.message);
			return;
		}
		setNewName("");
		setClinics((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "es")));
		navigate(`/superadmin/clinics/${data.id}`);
	};

	const impersonate = async (clinicId) => {
		setImpBusy(clinicId);
		try {
			await startImpersonation(clinicId);
			navigate("/", { replace: true });
		} catch (e) {
			setError(e.message || "No se pudo impersonar");
		} finally {
			setImpBusy(null);
		}
	};

	const months = growth?.months || [];
	const byClinic = storage?.by_clinic || [];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Shield className="text-violet-400" size={28} />
				<div>
					<h2 className="text-xl sm:text-2xl font-black text-white">Clínicas</h2>
					<p className="text-sm text-slate-400">MRR, telemetría y feature flags</p>
				</div>
			</div>

			<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-violet-300">
						MRR estimado
					</p>
					<p className="text-3xl font-black text-white tabular-nums mt-1">
						{mrr.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
					</p>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
						Clínicas activas
					</p>
					<p className="text-3xl font-black text-white tabular-nums mt-1">
						{activeClinics.length}
						<span className="text-lg text-slate-500 font-bold"> / {clinics.length}</span>
					</p>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
						Usuarios totales
					</p>
					<p className="text-3xl font-black text-white tabular-nums mt-1">
						{growth?.totals?.users ?? "—"}
					</p>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
					<p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
						BD (estimación)
					</p>
					<p className="text-3xl font-black text-white tabular-nums mt-1">
						{storage?.database_pretty || formatBytes(storage?.database_bytes)}
					</p>
				</div>
			</div>

			<div className="grid lg:grid-cols-2 gap-4">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
					<p className="text-sm font-black text-white mb-3">Crecimiento (6 meses)</p>
					<div className="space-y-2">
						{months.length === 0 ? (
							<p className="text-sm text-slate-500">Sin datos</p>
						) : (
							months.map((m) => (
								<div key={m.month} className="flex items-center gap-3 text-sm">
									<span className="w-16 font-mono text-slate-400">{m.month?.slice(2)}</span>
									<div className="flex-1 space-y-1">
										<div className="flex items-center gap-2">
											<div
												className="h-2 rounded bg-violet-500/80"
												style={{
													width: `${Math.min(100, (Number(m.new_clinics) || 0) * 20)}%`,
													minWidth: Number(m.new_clinics) ? 8 : 0,
												}}
											/>
											<span className="text-xs text-slate-300">
												+{m.new_clinics} clínicas
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div
												className="h-2 rounded bg-sky-500/70"
												style={{
													width: `${Math.min(100, (Number(m.new_users) || 0) * 12)}%`,
													minWidth: Number(m.new_users) ? 8 : 0,
												}}
											/>
											<span className="text-xs text-slate-300">+{m.new_users} users</span>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
					<p className="text-sm font-black text-white mb-3">
						Almacenamiento aprox. (fotos + consentimientos)
					</p>
					<div className="space-y-2 max-h-48 overflow-y-auto">
						{byClinic.length === 0 ? (
							<p className="text-sm text-slate-500">Sin desglose</p>
						) : (
							byClinic.slice(0, 8).map((c) => (
								<div
									key={c.clinic_id}
									className="flex items-center justify-between gap-2 text-sm border-b border-white/5 pb-2">
									<span className="font-semibold text-slate-200 truncate">
										{c.clinic_name}
									</span>
									<span className="text-xs text-slate-400 tabular-nums shrink-0">
										{formatBytes(c.approx_bytes)} · {c.photos_count} fotos ·{" "}
										{c.consents_count} PDF
									</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
				<label className="flex-1 block space-y-1">
					<span className="text-xs font-bold text-slate-300">Nueva clínica</span>
					<input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						placeholder="Nombre comercial"
						className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
					/>
				</label>
				<button
					type="button"
					disabled={creating || !newName.trim()}
					onClick={createClinic}
					className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-violet-500 disabled:opacity-50">
					{creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
					Crear
				</button>
			</div>

			{error && (
				<p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
					{error}
				</p>
			)}

			<div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
				{loading ? (
					<div className="p-10 flex justify-center">
						<Loader2 className="animate-spin text-violet-400" size={28} />
					</div>
				) : (
					<table className="w-full text-sm min-w-[640px]">
						<thead>
							<tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 text-left">
								<th className="px-4 py-3">Nombre</th>
								<th className="px-4 py-3">Plan</th>
								<th className="px-4 py-3">Cuota final</th>
								<th className="px-4 py-3">Estado</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{clinics.map((c) => {
								const fee = effectiveClinicFeeEur(c);
								const overridden = c.custom_fee_eur != null;
								return (
									<tr key={c.id} className="border-t border-white/5">
										<td className="px-4 py-3 font-bold text-white">
											<span className="inline-flex items-center gap-2">
												<Building2 size={16} className="text-slate-500" />
												{c.name}
											</span>
										</td>
										<td className="px-4 py-3 text-slate-300">
											{PLAN_LABELS[normalizeSubscriptionTier(c.subscription_tier)]}
										</td>
										<td className="px-4 py-3 tabular-nums font-semibold text-slate-200">
											{fee.toLocaleString("es-ES", {
												style: "currency",
												currency: "EUR",
											})}
											{overridden && (
												<span className="ml-1 text-[10px] font-bold text-amber-400">
													override
												</span>
											)}
										</td>
										<td className="px-4 py-3">
											{c.active !== false ? (
												<span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300">
													Activa
												</span>
											) : (
												<span className="px-2 py-1 rounded-md text-[11px] font-bold bg-white/10 text-slate-400">
													Inactiva
												</span>
											)}
										</td>
										<td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
											<button
												type="button"
												disabled={impBusy === c.id}
												onClick={() => impersonate(c.id)}
												className="text-xs font-bold text-amber-300 hover:underline inline-flex items-center gap-1">
												{impBusy === c.id ? (
													<Loader2 size={12} className="animate-spin" />
												) : (
													<Eye size={12} />
												)}
												Acceder como clínica
											</button>
											<Link
												to={`/superadmin/clinics/${c.id}`}
												className="text-xs font-bold text-violet-300 hover:underline">
												Gestionar
											</Link>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
};

const ClinicManageView = ({ clinicId }) => {
	const navigate = useNavigate();
	const [clinic, setClinic] = useState(null);
	const [modules, setModules] = useState([]);
	const [tier, setTier] = useState("basic");
	const [customFee, setCustomFee] = useState("");
	const [active, setActive] = useState(true);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState(null);
	const [members, setMembers] = useState([]);
	const [roleMatrix, setRoleMatrix] = useState(() => ({
		admin: [...DEFAULT_ROLE_MODULES.admin],
		staff_medico: [...DEFAULT_ROLE_MODULES.staff_medico],
		recepcion: [...DEFAULT_ROLE_MODULES.recepcion],
	}));
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("recepcion");

	const loadMembers = async () => {
		const { data: mems } = await supabase
			.from("user_clinic_memberships")
			.select("id, role, user_id")
			.eq("clinic_id", clinicId);
		const ids = (mems || []).map((m) => m.user_id).filter(Boolean);
		let profileById = {};
		if (ids.length) {
			const { data: profiles } = await supabase
				.from("profiles")
				.select("id, email, name, surname")
				.in("id", ids);
			profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
		}
		setMembers(
			(mems || []).map((m) => ({
				...m,
				profiles: profileById[m.user_id] || null,
			})),
		);
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { data, error } = await supabase
				.from("clinics")
				.select(CLINIC_SELECT)
				.eq("id", clinicId)
				.maybeSingle();
			if (cancelled) return;
			if (error || !data) {
				setMsg(error?.message || "Clínica no encontrada");
				return;
			}
			setClinic(data);
			setName(data.name || "");
			setTier(normalizeSubscriptionTier(data.subscription_tier));
			setActive(data.active !== false);
			setCustomFee(
				data.custom_fee_eur != null && data.custom_fee_eur !== ""
					? String(data.custom_fee_eur)
					: "",
			);
			setModules(
				Array.isArray(data.active_modules) && data.active_modules.length
					? [...data.active_modules]
					: [...ALL_MODULES],
			);

			await supabase.rpc("seed_clinic_role_modules", { p_clinic_id: clinicId });
			const { data: roles } = await supabase
				.from("clinic_role_modules")
				.select("role, allowed_modules")
				.eq("clinic_id", clinicId);
			if (!cancelled && roles?.length) {
				const next = {
					admin: [...DEFAULT_ROLE_MODULES.admin],
					staff_medico: [...DEFAULT_ROLE_MODULES.staff_medico],
					recepcion: [...DEFAULT_ROLE_MODULES.recepcion],
				};
				for (const r of roles) {
					if (next[r.role]) next[r.role] = [...(r.allowed_modules || [])];
				}
				setRoleMatrix(next);
			}

			await loadMembers();
		})();
		return () => {
			cancelled = true;
		};
	}, [clinicId]);

	const toggleRoleModule = (role, moduleId) => {
		setRoleMatrix((prev) => {
			const list = prev[role] || [];
			const next = list.includes(moduleId)
				? list.filter((m) => m !== moduleId)
				: [...list, moduleId];
			return { ...prev, [role]: next };
		});
	};

	const planFee = PLAN_DEFAULT_FEE_EUR[tier] ?? PLAN_DEFAULT_FEE_EUR.basic;
	const previewFee =
		customFee.trim() === "" ? planFee : Number(customFee.replace(",", ".")) || 0;

	const save = async () => {
		setBusy(true);
		setMsg(null);
		const payload = {
			name: name.trim() || clinic?.name,
			subscription_tier: tier,
			active,
			active_modules: withModuleDependencies(modules),
			custom_fee_eur: customFee.trim() === "" ? null : Number(customFee.replace(",", ".")),
		};
		const { error } = await supabase.from("clinics").update(payload).eq("id", clinicId);
		if (error) {
			setBusy(false);
			setMsg(error.message);
			return;
		}
		for (const role of CLINIC_ROLES) {
			const { error: rErr } = await supabase.from("clinic_role_modules").upsert({
				clinic_id: clinicId,
				role,
				allowed_modules: roleMatrix[role] || [],
				updated_at: new Date().toISOString(),
			});
			if (rErr) {
				setBusy(false);
				setMsg(rErr.message);
				return;
			}
		}
		setBusy(false);
		setMsg("Guardado");
	};

	const changeMemberRole = async (userId, newRole) => {
		const { error } = await supabase.rpc("platform_set_membership_role", {
			p_clinic_id: clinicId,
			p_user_id: userId,
			p_role: newRole,
		});
		if (error) setMsg(error.message);
		else {
			setMsg("Rol actualizado");
			await loadMembers();
		}
	};

	const removeMember = async (userId) => {
		if (!window.confirm("¿Quitar a este usuario de la clínica?")) return;
		const { error } = await supabase.rpc("platform_remove_membership", {
			p_clinic_id: clinicId,
			p_user_id: userId,
		});
		if (error) setMsg(error.message);
		else {
			setMsg("Usuario quitado");
			await loadMembers();
		}
	};

	const assignByEmail = async () => {
		const email = inviteEmail.trim();
		if (!email) return;
		setBusy(true);
		const { error } = await supabase.rpc("platform_assign_user_by_email", {
			p_email: email,
			p_clinic_id: clinicId,
			p_role: inviteRole,
		});
		setBusy(false);
		if (error) setMsg(error.message);
		else {
			setInviteEmail("");
			setMsg("Usuario asignado");
			await loadMembers();
		}
	};

	if (!clinic && !msg) {
		return (
			<div className="p-10 flex justify-center">
				<Loader2 className="animate-spin text-violet-400" size={28} />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<button
				type="button"
				onClick={() => navigate("/superadmin")}
				className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
				<ArrowLeft size={16} /> Volver
			</button>

			<div>
				<h2 className="text-xl sm:text-2xl font-black text-white">Gestionar clínica</h2>
				<p className="text-sm text-slate-500 font-mono mt-1">{clinicId}</p>
			</div>

			{msg && (
				<p
					className={`text-sm rounded-xl px-4 py-3 border ${
						msg === "Guardado" || msg.includes("actualizado") || msg.includes("asignado") || msg.includes("quitado")
							? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
							: "bg-rose-500/10 border-rose-500/30 text-rose-200"
					}`}>
					{msg}
				</p>
			)}

			<div className="max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-300">Nombre</span>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-300">Plan (referencia)</span>
						<select
							value={tier}
							onChange={(e) => setTier(e.target.value)}
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">
							<option value="basic">
								{PLAN_LABELS.basic} · {PLAN_DEFAULT_FEE_EUR.basic} €/mes
							</option>
							<option value="integral">
								{PLAN_LABELS.integral} · {PLAN_DEFAULT_FEE_EUR.integral} €/mes
							</option>
						</select>
						<p className="text-[11px] text-slate-500">
							Usa los botones de preset en módulos para rellenar el paquete.
						</p>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-slate-300">
							Override cuota (€/mes) — vacío = precio del plan
						</span>
						<input
							value={customFee}
							onChange={(e) => setCustomFee(e.target.value)}
							placeholder={String(planFee)}
							inputMode="decimal"
							className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
						/>
						<p className="text-xs text-slate-400">
							Cuota final:{" "}
							<strong className="text-white">
								{previewFee.toLocaleString("es-ES", {
									style: "currency",
									currency: "EUR",
								})}
							</strong>
						</p>
					</label>
					<label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
						<span className="text-sm font-bold text-slate-200">Clínica activa</span>
						<input
							type="checkbox"
							checked={active}
							onChange={(e) => setActive(e.target.checked)}
							className="h-5 w-5 accent-violet-500"
						/>
					</label>
			</div>

			<ClinicModulesEditor
				modules={modules}
				onChange={setModules}
				tier={tier}
				onTierChange={setTier}
				roleMatrix={roleMatrix}
				onToggleRoleModule={toggleRoleModule}
			/>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
				<p className="text-sm font-black text-white">Equipo de la clínica</p>
				<div className="flex flex-col sm:flex-row gap-2">
					<input
						value={inviteEmail}
						onChange={(e) => setInviteEmail(e.target.value)}
						placeholder="email@usuario.com"
						className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
					/>
					<select
						value={inviteRole}
						onChange={(e) => setInviteRole(e.target.value)}
						className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">
						{CLINIC_ROLES.map((r) => (
							<option key={r} value={r}>
								{ROLE_LABELS[r]}
							</option>
						))}
					</select>
					<button
						type="button"
						disabled={busy || !inviteEmail.trim()}
						onClick={assignByEmail}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
						<UserPlus size={16} /> Asignar
					</button>
				</div>
				{members.length === 0 ? (
					<p className="text-sm text-slate-500">Sin membresías.</p>
				) : (
					<ul className="space-y-2">
						{members.map((m) => (
							<li
								key={m.id}
								className="flex flex-wrap items-center justify-between gap-2 text-sm border border-white/10 rounded-xl px-3 py-2">
								<span className="font-semibold text-slate-100">
									{m.profiles?.email || m.user_id}
									{m.profiles?.name ? (
										<span className="text-slate-400 font-medium">
											{" "}
											· {m.profiles.name} {m.profiles.surname || ""}
										</span>
									) : null}
								</span>
								<div className="flex items-center gap-2">
									<select
										value={m.role}
										onChange={(e) => changeMemberRole(m.user_id, e.target.value)}
										className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs font-bold text-violet-200">
										{CLINIC_ROLES.map((r) => (
											<option key={r} value={r}>
												{ROLE_LABELS[r]}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={() => removeMember(m.user_id)}
										className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10"
										title="Quitar">
										<Trash2 size={14} />
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<button
				type="button"
				disabled={busy}
				onClick={save}
				className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-3 text-sm font-bold hover:bg-violet-500 disabled:opacity-50">
				{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
				Guardar cambios
			</button>
		</div>
	);
};

const UsersDirectoryView = () => {
	const [q, setQ] = useState("");
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const load = async (search) => {
		setLoading(true);
		setError(null);
		const { data, error: err } = await supabase.rpc("platform_list_users", {
			p_search: search?.trim() || null,
		});
		if (err) setError(err.message);
		else setRows(data || []);
		setLoading(false);
	};

	useEffect(() => {
		load("");
	}, []);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl sm:text-2xl font-black text-white">Usuarios</h2>
				<p className="text-sm text-slate-400">Directorio de la plataforma (sin entrar en SQL)</p>
			</div>
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					load(q);
				}}>
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Buscar por email o nombre"
					className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
				/>
				<button
					type="submit"
					className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">
					Buscar
				</button>
			</form>
			{error && (
				<p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
					{error}
				</p>
			)}
			<div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
				{loading ? (
					<div className="p-10 flex justify-center">
						<Loader2 className="animate-spin text-violet-400" size={28} />
					</div>
				) : (
					<table className="w-full text-sm min-w-[640px]">
						<thead>
							<tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 text-left">
								<th className="px-4 py-3">Email</th>
								<th className="px-4 py-3">Nombre</th>
								<th className="px-4 py-3">Clínica</th>
								<th className="px-4 py-3">Rol</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((u) => (
								<tr key={u.id} className="border-t border-white/5">
									<td className="px-4 py-3 font-semibold text-white">
										{u.email}
										{u.is_platform_superadmin && (
											<span className="ml-2 text-[10px] font-black uppercase text-violet-300">
												platform
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-slate-300">
										{[u.name, u.surname].filter(Boolean).join(" ") || "—"}
									</td>
									<td className="px-4 py-3 text-slate-300">{u.clinic_name || "—"}</td>
									<td className="px-4 py-3 text-slate-300">
										{u.role ? ROLE_LABELS[u.role] || u.role : "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
};

const PlatformToolsView = () => {
	const [clinics, setClinics] = useState([]);
	const [clinicId, setClinicId] = useState("");
	const [msg, setMsg] = useState(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		(async () => {
			const { data } = await supabase.from("clinics").select("id, name").order("name");
			setClinics(data || []);
			if (data?.[0]) setClinicId(data[0].id);
		})();
	}, []);

	const seedRoles = async () => {
		if (!clinicId) return;
		setBusy(true);
		setMsg(null);
		const { error } = await supabase.rpc("seed_clinic_role_modules", {
			p_clinic_id: clinicId,
		});
		setBusy(false);
		setMsg(error ? error.message : "Visibilidad por rol regenerada (defaults)");
	};

	const resetModulesAll = async () => {
		if (!clinicId) return;
		if (!window.confirm("¿Restaurar todos los módulos SaaS en esta clínica?")) return;
		setBusy(true);
		const { error } = await supabase
			.from("clinics")
			.update({ active_modules: ALL_MODULES })
			.eq("id", clinicId);
		setBusy(false);
		setMsg(error ? error.message : "Módulos restaurados");
	};

	const toggleActive = async (active) => {
		if (!clinicId) return;
		setBusy(true);
		const { error } = await supabase.from("clinics").update({ active }).eq("id", clinicId);
		setBusy(false);
		setMsg(error ? error.message : active ? "Clínica activada" : "Clínica desactivada");
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl sm:text-2xl font-black text-white">Utilidades</h2>
				<p className="text-sm text-slate-400">
					Acciones rápidas sin abrir Studio / SQL
				</p>
			</div>
			<label className="block space-y-1 max-w-md">
				<span className="text-xs font-bold text-slate-300">Clínica objetivo</span>
				<select
					value={clinicId}
					onChange={(e) => setClinicId(e.target.value)}
					className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">
					{clinics.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</label>
			{msg && (
				<p className="text-sm rounded-xl px-4 py-3 border border-white/10 bg-white/5 text-slate-200">
					{msg}
				</p>
			)}
			<div className="grid sm:grid-cols-2 gap-3">
				<button
					type="button"
					disabled={busy || !clinicId}
					onClick={seedRoles}
					className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
					Regenerar visibilidad por rol (defaults)
				</button>
				<button
					type="button"
					disabled={busy || !clinicId}
					onClick={resetModulesAll}
					className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
					Restaurar todos los módulos SaaS
				</button>
				<button
					type="button"
					disabled={busy || !clinicId}
					onClick={() => toggleActive(true)}
					className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
					Activar clínica
				</button>
				<button
					type="button"
					disabled={busy || !clinicId}
					onClick={() => toggleActive(false)}
					className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left text-sm font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50">
					Desactivar clínica
				</button>
			</div>
		</div>
	);
};
