import React from "react";
import { Sparkles, Zap } from "lucide-react";
import {
	MODULE_META,
	PLAN_DEFAULT_FEE_EUR,
	PLAN_LABELS,
	applyPlanPreset,
	groupModulesForUi,
	withModuleDependencies,
	CLINIC_ROLES,
	ROLE_LABELS,
} from "../../constants/saasModules";

const Switch = ({ checked, onChange, disabled }) => (
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		disabled={disabled}
		onClick={() => onChange(!checked)}
		className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40 ${
			checked ? "bg-violet-500" : "bg-slate-600"
		}`}>
		<span
			className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
				checked ? "translate-x-6" : "translate-x-1"
			}`}
		/>
	</button>
);

/**
 * Editor de módulos SaaS: presets Gestión/360, switches por área y extras aparte.
 */
export const ClinicModulesEditor = ({
	modules = [],
	onChange,
	tier,
	onTierChange,
	roleMatrix,
	onToggleRoleModule,
}) => {
	const groups = groupModulesForUi();

	const setModulesSafe = (next) => {
		onChange(withModuleDependencies(next));
	};

	const toggle = (id) => {
		const on = modules.includes(id);
		if (on) {
			setModulesSafe(modules.filter((m) => m !== id));
		} else {
			setModulesSafe([...modules, id]);
		}
	};

	const applyPreset = (planTier) => {
		onTierChange?.(planTier);
		setModulesSafe(applyPlanPreset(planTier, modules));
	};

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
				<div>
					<p className="text-sm font-black text-white">Presets de plan</p>
					<p className="text-xs text-slate-400 mt-1">
						Un clic aplica el paquete. Los extras ya marcados se conservan.
					</p>
				</div>
				<div className="grid sm:grid-cols-2 gap-3">
					<button
						type="button"
						onClick={() => applyPreset("basic")}
						className={`text-left rounded-2xl border p-4 transition ${
							tier === "basic"
								? "border-violet-400/60 bg-violet-500/15"
								: "border-white/10 bg-slate-900/40 hover:border-white/20"
						}`}>
						<div className="flex items-center gap-2 text-white font-black">
							<Zap size={16} className="text-violet-300" />
							{PLAN_LABELS.basic}
						</div>
						<p className="text-xs text-slate-400 mt-1">
							{PLAN_DEFAULT_FEE_EUR.basic} €/mes · operativa esencial
						</p>
					</button>
					<button
						type="button"
						onClick={() => applyPreset("integral")}
						className={`text-left rounded-2xl border p-4 transition ${
							tier === "integral"
								? "border-violet-400/60 bg-violet-500/15"
								: "border-white/10 bg-slate-900/40 hover:border-white/20"
						}`}>
						<div className="flex items-center gap-2 text-white font-black">
							<Sparkles size={16} className="text-amber-300" />
							{PLAN_LABELS.integral}
						</div>
						<p className="text-xs text-slate-400 mt-1">
							{PLAN_DEFAULT_FEE_EUR.integral} €/mes · clínica completa
						</p>
					</button>
				</div>
				<p className="text-[11px] text-slate-500">
					Activos:{" "}
					<span className="font-bold text-slate-300">{modules.length}</span> módulos
				</p>
			</div>

			{groups.map(({ group, ids, isExtra }) => (
				<div
					key={group}
					className={`rounded-2xl border p-5 space-y-3 ${
						isExtra
							? "border-amber-500/30 bg-amber-500/5"
							: "border-white/10 bg-white/5"
					}`}>
					<div className="flex items-center justify-between gap-2">
						<div>
							<p className="text-sm font-black text-white">{group}</p>
							{isExtra && (
								<p className="text-[11px] text-amber-200/80 mt-0.5">
									Add-ons de pago o especiales — no se incluyen al aplicar un preset
								</p>
							)}
						</div>
						{isExtra && (
							<span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 px-2 py-1 rounded-lg">
								Extra
							</span>
						)}
					</div>
					<ul className="space-y-2">
						{ids.map((id) => {
							const meta = MODULE_META[id] || {};
							const on = modules.includes(id);
							return (
								<li
									key={id}
									className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 border transition ${
										on
											? "border-violet-400/30 bg-violet-500/10"
											: "border-white/5 bg-slate-900/30"
									}`}>
									<div className="min-w-0">
										<p className="text-sm font-bold text-slate-100 truncate">
											{meta.label || id}
										</p>
										{meta.hint && (
											<p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
												{meta.hint}
											</p>
										)}
									</div>
									<Switch checked={on} onChange={() => toggle(id)} />
								</li>
							);
						})}
					</ul>
				</div>
			))}

			{roleMatrix && onToggleRoleModule && (
				<div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
					<div>
						<p className="text-sm font-black text-white">Visibilidad por rol</p>
						<p className="text-xs text-slate-400 mt-1">
							Intersección con módulos activos de la clínica. Si la clínica no tiene el
							módulo, el rol no lo verá aunque esté marcado.
						</p>
					</div>
					{groups.map(({ group, ids }) => (
						<div key={`role-${group}`} className="space-y-2">
							<p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
								{group}
							</p>
							<div className="overflow-x-auto rounded-xl border border-white/5">
								<table className="w-full text-sm min-w-[480px]">
									<thead>
										<tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left bg-slate-900/40">
											<th className="py-2 px-3">Módulo</th>
											{CLINIC_ROLES.map((r) => (
												<th key={r} className="py-2 px-2 text-center">
													{ROLE_LABELS[r]}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{ids.map((id) => {
											const clinicOn = modules.includes(id);
											return (
												<tr
													key={id}
													className={`border-t border-white/5 ${
														clinicOn ? "" : "opacity-40"
													}`}>
													<td className="py-2 px-3 font-semibold text-slate-200">
														{MODULE_META[id]?.label || id}
													</td>
													{CLINIC_ROLES.map((r) => (
														<td key={r} className="py-2 px-2 text-center">
															<input
																type="checkbox"
																disabled={!clinicOn && r !== "admin"}
																checked={(roleMatrix[r] || []).includes(id)}
																onChange={() => onToggleRoleModule(r, id)}
																className="h-4 w-4 accent-violet-500"
															/>
														</td>
													))}
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
