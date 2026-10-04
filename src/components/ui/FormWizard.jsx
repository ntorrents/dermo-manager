import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { LoadingButton } from "./LoadingButton";

/**
 * Paso de asistente: { id, label, when?: boolean }
 * `when: false` oculta el paso (p. ej. fiscal solo si es deducible).
 */
export function useFormWizard(stepDefs, { open = true, resetKey } = {}) {
	const steps = useMemo(
		() => (stepDefs || []).filter((s) => s && s.when !== false),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- identity via ids/labels/when
		[JSON.stringify((stepDefs || []).map((s) => [s?.id, s?.label, s?.when !== false]))],
	);

	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open, resetKey]);

	useEffect(() => {
		if (stepIndex > steps.length - 1) {
			setStepIndex(Math.max(0, steps.length - 1));
		}
	}, [steps.length, stepIndex]);

	const stepId = steps[stepIndex]?.id;
	const isFirst = stepIndex <= 0;
	const isLast = stepIndex >= steps.length - 1;

	return {
		steps,
		stepIndex,
		stepId,
		setStepIndex,
		isFirst,
		isLast,
		next: () => setStepIndex((i) => Math.min(i + 1, steps.length - 1)),
		back: () => setStepIndex((i) => Math.max(i - 1, 0)),
		goTo: (idOrIndex) => {
			if (typeof idOrIndex === "number") {
				setStepIndex(Math.max(0, Math.min(idOrIndex, steps.length - 1)));
				return;
			}
			const idx = steps.findIndex((s) => s.id === idOrIndex);
			if (idx >= 0) setStepIndex(idx);
		},
	};
}

export function FormWizardProgress({ steps = [], current = 0 }) {
	if (!steps.length || steps.length < 2) return null;

	return (
		<nav aria-label="Progreso del formulario" className="mb-5">
			<ol className="flex items-center gap-0">
				{steps.map((s, i) => {
					const done = i < current;
					const active = i === current;
					return (
						<li key={s.id} className="flex flex-1 items-center min-w-0 last:flex-none">
							<div className="flex flex-col items-center gap-1.5 min-w-0">
								<span
									className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border transition-colors ${
										done
											? "bg-rose-700 border-rose-700 text-white"
											: active
												? "bg-white border-rose-700 text-rose-700 ring-4 ring-rose-100"
												: "bg-slate-50 border-slate-200 text-slate-400"
									}`}>
									{done ? <Check size={14} strokeWidth={3} /> : i + 1}
								</span>
								<span
									className={`text-[10px] sm:text-[11px] font-bold text-center leading-tight max-w-[4.5rem] sm:max-w-[5.5rem] truncate ${
										active ? "text-rose-800" : done ? "text-slate-600" : "text-slate-400"
									}`}>
									{s.label}
								</span>
							</div>
							{i < steps.length - 1 ? (
								<div
									className={`mx-1 sm:mx-2 mb-5 h-0.5 flex-1 rounded-full ${
										i < current ? "bg-rose-600" : "bg-slate-200"
									}`}
									aria-hidden
								/>
							) : null}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

export function FormWizardNav({
	isFirst,
	isLast,
	onBack,
	onNext,
	onSubmit,
	loading = false,
	submitLabel = "Guardar",
	nextLabel = "Siguiente",
	backLabel = "Atrás",
	submitClassName = "btn-primary",
	formId,
}) {
	return (
		<div className="flex items-center gap-2">
			{!isFirst ? (
				<button
					type="button"
					onClick={onBack}
					disabled={loading}
					className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0">
					<ChevronLeft size={16} />
					{backLabel}
				</button>
			) : (
				<div className="w-0 sm:w-auto" />
			)}
			{isLast ? (
				<LoadingButton
					loading={loading}
					type={formId ? "submit" : "button"}
					form={formId}
					onClick={formId ? undefined : onSubmit}
					className={`flex-1 py-3 rounded-xl font-bold text-white ${submitClassName}`}>
					{submitLabel}
				</LoadingButton>
			) : (
				<button
					type="button"
					onClick={onNext}
					disabled={loading}
					className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 text-white px-4 py-3 text-sm font-bold hover:bg-rose-800 disabled:opacity-50">
					{nextLabel}
					<ChevronRight size={16} />
				</button>
			)}
		</div>
	);
}

/** Aviso para abrir factura múltiple desde el alta individual */
export function FormWizardBatchHint({ onOpen, label = "Factura múltiple" }) {
	if (!onOpen) return null;
	return (
		<button
			type="button"
			onClick={onOpen}
			className="w-full mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left hover:bg-amber-100/80 transition-colors">
			<span className="mt-0.5 inline-flex shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
				{label}
			</span>
			<span className="min-w-0">
				<span className="block text-sm font-bold text-amber-950">
					¿Varias líneas en una sola factura?
				</span>
				<span className="block text-xs text-amber-900/80 mt-0.5">
					Abre el asistente de factura múltiple y registra todo de una vez.
				</span>
			</span>
		</button>
	);
}
