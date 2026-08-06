import React, { useState, useMemo } from "react";
import { Plus, FileDown, Archive, Search, X, Percent, CalendarCheck, ArrowLeft } from "lucide-react";
import { generateBudgetPDF, sumBudgetLinesTTC, sumBudgetLinesOriginalTTC } from "../../utils/budgetGenerator";
import { formatCurrency } from "../../utils/format";
import { useBudgets } from "../../hooks/useBudgets";
import { LoadingButton } from "../ui/LoadingButton";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useTenant } from "../../context/TenantContext";

const emptyLine = () => ({
	line_kind: "treatment",
	treatment_id: "",
	description: "",
	quantity: 1,
	original_unit_price_ttc: null,
	unit_price_ttc: 0,
	tax_rate: 21,
});

export const BudgetsSection = ({
	user,
	clients = [],
	treatments = [],
	profile,
	showToast,
	onStartSessionFromBudget,
}) => {
	const { clinic } = useTenant();
	const { budgets, loading, createBudget, creating, archiveBudget, archiving } = useBudgets(user?.id);
	const [searchTerm, setSearchTerm] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [clientId, setClientId] = useState("");
	const [nombre, setNombre] = useState("");
	const [notas, setNotas] = useState("");
	const [validUntil, setValidUntil] = useState("");
	const [pricingMode, setPricingMode] = useState("manual"); // manual | global_percent
	const [globalDiscountPercent, setGlobalDiscountPercent] = useState("");
	const [lines, setLines] = useState([emptyLine()]);
	const [archiveId, setArchiveId] = useState(null);

	const filtered = useMemo(() => {
		const q = searchTerm.trim().toLowerCase();
		if (!q) return budgets;
		return budgets.filter((b) => {
			const c = clients.find((x) => x.id === b.client_id);
			const name = c ? `${c.name} ${c.surname || ""}`.toLowerCase() : "";
			const t = b.nombre ? String(b.nombre).toLowerCase() : "";
			return name.includes(q) || t.includes(q);
		});
	}, [budgets, clients, searchTerm]);

	const openNew = () => {
		setClientId("");
		setNombre("");
		setNotas("");
		setValidUntil("");
		setPricingMode("manual");
		setGlobalDiscountPercent("");
		setLines([emptyLine()]);
		setIsCreating(true);
	};

	const updateLine = (idx, patch) => {
		setLines((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	};

	const reapplyGlobalDiscountToTreatmentLines = () => {
		const pct = Number(globalDiscountPercent) || 0;
		if (pricingMode !== "global_percent") return;
		setLines((prev) =>
			prev.map((ln) => {
				if (!ln.treatment_id) return ln;
				const original = ln.original_unit_price_ttc != null ? Number(ln.original_unit_price_ttc) : null;
				if (original == null) return ln;
				return {
					...ln,
					unit_price_ttc: Math.max(0, original * (1 - pct / 100)),
				};
			}),
		);
	};

	const onTreatmentPick = (idx, treatmentId) => {
		const t = treatments.find((x) => x.id === treatmentId);
		const original = t ? Number(t.price) || 0 : null;
		const pct = pricingMode === "global_percent" ? Number(globalDiscountPercent) || 0 : 0;
		const applied =
			original != null
				? Math.max(0, original * (1 - pct / 100))
				: lines[idx]?.unit_price_ttc ?? 0;
		updateLine(idx, {
			treatment_id: treatmentId || null,
			line_kind: treatmentId ? "treatment" : "extra",
			description: t ? t.name : "",
			original_unit_price_ttc: original,
			unit_price_ttc: applied,
		});
	};

	const addLine = () => setLines((prev) => [...prev, emptyLine()]);
	const removeLine = (idx) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!clientId) {
			showToast("Selecciona un cliente", "error");
			return;
		}
		const validLines = lines.filter((l) => l.description?.trim());
		if (!validLines.length) {
			showToast("Añade al menos una línea con concepto", "error");
			return;
		}
		const pct = Number(globalDiscountPercent);
		if (
			pricingMode === "global_percent" &&
			globalDiscountPercent !== "" &&
			(pct < 0 || pct > 100 || Number.isNaN(pct))
		) {
			showToast("El descuento global debe ser un % entre 0 y 100", "error");
			return;
		}
		try {
			await createBudget({
				client_id: clientId,
				nombre,
				notas,
				valid_until: validUntil || null,
				discount_mode: pricingMode === "global_percent" ? "global_percent" : "manual",
				discount_percent: pricingMode === "global_percent" ? (globalDiscountPercent === "" ? null : pct) : null,
				lineas: validLines.map((l) => ({
					line_kind: l.line_kind || "extra",
					treatment_id: l.treatment_id || null,
					description: l.description.trim(),
					quantity: l.quantity,
					original_unit_price_ttc: l.original_unit_price_ttc,
					unit_price_ttc: l.unit_price_ttc,
					tax_rate: l.tax_rate,
				})),
			});
			showToast("Presupuesto guardado");
			setIsCreating(false);
		} catch (err) {
			showToast(err?.message || "Error al guardar", "error");
		}
	};

	// Si cambias a modo descuento global, recalcular líneas de tratamientos ya seleccionadas
	React.useEffect(() => {
		if (pricingMode !== "global_percent") return;
		reapplyGlobalDiscountToTreatmentLines();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pricingMode]);

	const startSessionFromBudget = (b) => {
		if (!onStartSessionFromBudget) return;
		const client = clients.find((c) => c.id === b.client_id);
		if (!client) {
			showToast("Cliente no encontrado", "error");
			return;
		}
		const lines = b.presupuesto_lineas || [];
		const treatmentLine = lines.find(
			(l) => l.line_kind === "treatment" && l.treatment_id,
		);
		if (!treatmentLine) {
			showToast("Añade una línea de tratamiento al presupuesto", "error");
			return;
		}
		const treatment = treatments.find((t) => t.id === treatmentLine.treatment_id);
		if (!treatment) {
			showToast("Tratamiento no encontrado en el catálogo", "error");
			return;
		}
		const treatmentLines = lines.filter(
			(l) => l.line_kind === "treatment" && l.treatment_id,
		);
		if (treatmentLines.length > 1) {
			showToast("Se usará la primera línea de tratamiento del presupuesto", "success");
		}
		const qty = Number(treatmentLine.quantity) || 1;
		const price = Number(treatmentLine.unit_price_ttc) * qty;
		onStartSessionFromBudget({ client, treatment, price });
	};

	const downloadPdf = async (b) => {
		const client = clients.find((c) => c.id === b.client_id);
		if (!client) {
			showToast("Cliente no encontrado", "error");
			return;
		}
		try {
			await generateBudgetPDF(client, clinic, profile, b, b.presupuesto_lineas || []);
			showToast("PDF generado");
		} catch (err) {
			showToast(err?.message || "Error al generar PDF", "error");
		}
	};

	if (isCreating) {
		return (
			<div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
				<div className="flex items-center gap-4">
					<button
						onClick={() => setIsCreating(false)}
						className="p-2 -ml-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
						aria-label="Volver">
						<ArrowLeft size={24} />
					</button>
					<div>
						<h2 className="text-2xl font-bold text-gray-900">Nuevo Presupuesto</h2>
						<p className="text-sm text-gray-500">Configura la información y añade tratamientos</p>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-8">
					<div className="space-y-4">
						<h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Datos Principales</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Cliente</label>
								<select
									required
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100 transition-colors"
									value={clientId}
									onChange={(e) => setClientId(e.target.value)}>
									<option value="">Seleccionar…</option>
									{clients.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name} {c.surname || ""}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">
									Identificador (opcional)
								</label>
								<input
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100 transition-colors"
									value={nombre}
									onChange={(e) => setNombre(e.target.value)}
									placeholder="Ej: María - peeling promo"
								/>
							</div>
							<div>
								<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">
									Válido hasta (opcional)
								</label>
								<input
									type="date"
									className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100 transition-colors"
									value={validUntil}
									onChange={(e) => setValidUntil(e.target.value)}
								/>
							</div>
						</div>
					</div>

					<div className="space-y-4">
						<h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Líneas del Presupuesto</h3>
						
						<div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-4">
							<div className="flex flex-col sm:flex-row gap-3">
								<label className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border border-gray-200 cursor-pointer hover:border-rose-300 transition-colors">
									<input
										type="radio"
										name="pricingMode"
										checked={pricingMode === "manual"}
										onChange={() => setPricingMode("manual")}
										className="text-rose-700 focus:ring-rose-500"
									/>
									Precio manual
								</label>
								<label className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border border-gray-200 cursor-pointer hover:border-rose-300 transition-colors">
									<input
										type="radio"
										name="pricingMode"
										checked={pricingMode === "global_percent"}
										onChange={() => setPricingMode("global_percent")}
										className="text-rose-700 focus:ring-rose-500"
									/>
									Descuento global (%)
								</label>
							</div>
							{pricingMode === "global_percent" && (
								<div className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
									<Percent size={18} className="text-amber-700" />
									<input
										type="number"
										min="0"
										max="100"
										step="0.1"
										className="w-24 p-2.5 bg-white border border-amber-200 rounded-lg text-sm font-black text-amber-900 outline-none focus:border-amber-400"
										value={globalDiscountPercent}
										onChange={(e) => setGlobalDiscountPercent(e.target.value)}
										placeholder="10"
									/>
									<button
										type="button"
										onClick={reapplyGlobalDiscountToTreatmentLines}
										className="px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors">
										Aplicar a todas
									</button>
									<span className="text-[11px] font-bold text-amber-700/70 hidden md:block">
										Aplica descuento base a los tratamientos (se puede ajustar luego)
									</span>
								</div>
							)}
						</div>

						<div className="space-y-4">
							{lines.map((ln, idx) => (
								<div
									key={idx}
									className="p-5 bg-white rounded-2xl border-2 border-gray-100 space-y-4 relative group hover:border-rose-100 transition-colors shadow-sm">
									{lines.length > 1 && (
										<button
											type="button"
											onClick={() => removeLine(idx)}
											className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-rose-700 hover:bg-rose-50 rounded-full border border-gray-100 shadow-sm transition-all"
											aria-label="Quitar línea">
											<X size={16} />
										</button>
									)}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Tratamiento</label>
											<select
												className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100"
												value={ln.treatment_id || ""}
												onChange={(e) => onTreatmentPick(idx, e.target.value)}>
												<option value="">— Concepto Libre —</option>
												{treatments.map((t) => (
													<option key={t.id} value={t.id}>
														{t.name} ({formatCurrency(Number(t.price) || 0)})
													</option>
												))}
											</select>
										</div>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Descripción</label>
											<input
												className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border border-transparent focus:border-rose-100"
												value={ln.description}
												onChange={(e) => updateLine(idx, { description: e.target.value })}
												placeholder="Ej: Higiene facial profunda"
											/>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-4">
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">Cant.</label>
											<input
												type="number"
												min="0.01"
												step="0.01"
												className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border border-transparent focus:border-rose-100"
												value={ln.quantity}
												onChange={(e) => updateLine(idx, { quantity: e.target.value })}
											/>
										</div>
										<div>
											<label className="text-[10px] font-black text-rose-700 uppercase tracking-widest ml-2 block mb-1">Precio Total (IVA inc.)</label>
											<input
												type="number"
												min="0"
												step="0.01"
												className="w-full p-4 bg-rose-50/30 border-2 border-rose-100 rounded-2xl font-black text-rose-700 text-lg outline-none focus:border-rose-300 transition-colors"
												value={ln.unit_price_ttc}
												onChange={(e) =>
													updateLine(idx, {
														unit_price_ttc: e.target.value,
														line_kind: ln.treatment_id ? "treatment" : "extra",
													})
												}
											/>
											{ln.original_unit_price_ttc != null && Number(ln.original_unit_price_ttc) > Number(ln.unit_price_ttc || 0) && (
												<p className="text-[10px] font-bold text-gray-500 mt-2 px-2">
													Original: {formatCurrency(Number(ln.original_unit_price_ttc) || 0)}
													<span className="text-emerald-500 ml-2">
														DTO: {formatCurrency(Math.max(0, (Number(ln.original_unit_price_ttc) - Number(ln.unit_price_ttc || 0)) * (Number(ln.quantity) || 0)))}
													</span>
												</p>
											)}
										</div>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-1">IVA (%)</label>
											<input
												type="number"
												min="0"
												className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-600 outline-none border border-transparent focus:border-rose-100"
												value={ln.tax_rate}
												onChange={(e) => updateLine(idx, { tax_rate: e.target.value })}
											/>
										</div>
									</div>
								</div>
							))}
							<button
								type="button"
								onClick={addLine}
								className="w-full py-4 border-2 border-dashed border-gray-200 text-gray-400 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
								+ Añadir otra línea
							</button>
						</div>
					</div>

					<div className="space-y-4">
						<h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Observaciones</h3>
						<textarea
							rows={3}
							className="w-full p-4 bg-gray-50 rounded-2xl font-medium outline-none border border-transparent focus:border-rose-100 transition-colors resize-none"
							value={notas}
							onChange={(e) => setNotas(e.target.value)}
							placeholder="Condiciones particulares, notas adicionales para el cliente…"
						/>
					</div>

					<div className="pt-6 border-t border-gray-100">
						<LoadingButton
							type="submit"
							loading={creating}
							className="w-full md:w-auto px-10 py-4 bg-surface-dark hover:bg-gray-800 text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
							Guardar Presupuesto
						</LoadingButton>
					</div>
				</form>
			</div>
		);
	}

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
				<div className="relative w-full sm:w-auto flex-1 max-w-md">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
					<input
						className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-rose-200 focus:ring-4 focus:ring-rose-50 outline-none transition-all"
						placeholder="Buscar por cliente o título..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<button
					type="button"
					onClick={openNew}
					className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black bg-rose-700 text-white shadow-lg hover:shadow-xl hover:bg-rose-800 hover:-translate-y-0.5 transition-all">
					<Plus size={20} /> Crear Presupuesto
				</button>
			</div>

			{loading ? (
				<div className="grid gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-28 bg-gray-100 rounded-3xl animate-pulse" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400">
					<div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
						<FileDown size={24} className="text-gray-300" />
					</div>
					<h3 className="text-lg font-black text-gray-600 mb-1">Aún no hay presupuestos</h3>
					<p className="text-sm font-medium">Crea uno nuevo para empezar a guardarlos y exportarlos a PDF.</p>
				</div>
			) : (
				<div className="grid gap-4">
					{filtered.map((b) => {
						const client = clients.find((c) => c.id === b.client_id);
						const name = client ? `${client.name} ${client.surname || ""}`.trim() : "Cliente no encontrado";
						const title = b.nombre ? String(b.nombre) : null;
						const total = sumBudgetLinesTTC(b.presupuesto_lineas || []);
						const totalOriginal = sumBudgetLinesOriginalTTC(b.presupuesto_lineas || []);
						const totalDiscount = Math.max(0, totalOriginal - total);
						const dateStr = b.created_at
							? new Date(b.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'short', year: 'numeric' })
							: "";
						return (
							<div
								key={b.id}
								className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<p className="font-bold text-gray-800">{title || "Presupuesto sin título"}</p>
										<span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold uppercase">{dateStr}</span>
									</div>
									<p className="text-xs text-rose-700 font-semibold mt-0.5">{name}</p>
								</div>

								<div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0">
									<div className="text-left sm:text-right">
										<div className="text-lg font-black text-gray-900 leading-none">
											{formatCurrency(total)}
										</div>
										{totalDiscount > 0 && (
											<div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">
												-{formatCurrency(totalDiscount)}
											</div>
										)}
									</div>
									<div className="flex gap-2 shrink-0">
										{onStartSessionFromBudget && (
											<button
												type="button"
												onClick={() => startSessionFromBudget(b)}
												className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold transition-colors">
												<CalendarCheck size={16} /> Aplicar
											</button>
										)}
										<button
											type="button"
											onClick={() => downloadPdf(b)}
											className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold transition-colors">
											<FileDown size={16} /> PDF
										</button>
										<button
											type="button"
											onClick={() => setArchiveId(b.id)}
											disabled={archiving}
											className="flex items-center justify-center w-9 h-9 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors">
											<Archive size={16} />
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			<ConfirmModal
				isOpen={!!archiveId}
				title="Archivar presupuesto"
				message="Este presupuesto dejará de mostrarse en la lista principal, pero se conservará en el sistema de forma segura."
				onCancel={() => setArchiveId(null)}
				onConfirm={async () => {
					try {
						await archiveBudget(archiveId);
						showToast("Presupuesto archivado con éxito", "success");
					} catch {
						showToast("Error al archivar el presupuesto", "error");
					} finally {
						setArchiveId(null);
					}
				}}
				isDestructive
			/>
		</div>
	);
};
