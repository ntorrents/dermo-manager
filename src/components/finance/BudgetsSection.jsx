import React, { useState, useMemo } from "react";
import { Plus, FileDown, Archive, Search, X, Percent } from "lucide-react";
import { AdaptiveModal } from "../ui/AdaptiveModal";
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

export const BudgetsSection = ({ user, clients = [], treatments = [], profile, showToast }) => {
	const { clinic } = useTenant();
	const { budgets, loading, createBudget, creating, archiveBudget, archiving } = useBudgets(user?.id);
	const [searchTerm, setSearchTerm] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
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
		setModalOpen(true);
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
			setModalOpen(false);
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

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
				<div>
					<h2 className="text-xl font-black text-gray-800">Presupuestos</h2>
					<p className="text-sm text-gray-500 mt-1">
						Cotizaciones con PDF informativo (sin numeración fiscal).
					</p>
				</div>
				<button
					type="button"
					onClick={openNew}
					className="flex items-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold shadow-lg transition-colors">
					<Plus size={20} /> Nuevo presupuesto
				</button>
			</div>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
				<input
					className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium"
					placeholder="Buscar por cliente..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
			</div>

			{loading ? (
				<div className="grid gap-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
					No hay presupuestos. Crea uno para guardarlo y exportar PDF.
				</div>
			) : (
				<div className="space-y-3">
					{filtered.map((b) => {
						const client = clients.find((c) => c.id === b.client_id);
						const name = client ? `${client.name} ${client.surname || ""}`.trim() : "Cliente";
						const title = b.nombre ? String(b.nombre) : null;
						const total = sumBudgetLinesTTC(b.presupuesto_lineas || []);
						const totalOriginal = sumBudgetLinesOriginalTTC(b.presupuesto_lineas || []);
						const totalDiscount = Math.max(0, totalOriginal - total);
						const dateStr = b.created_at
							? new Date(b.created_at).toLocaleDateString("es-ES")
							: "";
						return (
							<div
								key={b.id}
								className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="font-bold text-gray-800">{title ? `${title} · ${name}` : name}</p>
									<p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
									<p className="text-sm font-black text-amber-700 mt-1">{formatCurrency(total)}</p>
									{totalDiscount > 0 && (
										<p className="text-[11px] text-gray-500 mt-0.5">
											DTO total: <span className="font-bold text-gray-700">{formatCurrency(totalDiscount)}</span>
										</p>
									)}
								</div>
								<div className="flex gap-2 shrink-0">
									<button
										type="button"
										onClick={() => downloadPdf(b)}
										className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold">
										<FileDown size={16} /> PDF
									</button>
									<button
										type="button"
										onClick={() => setArchiveId(b.id)}
										disabled={archiving}
										className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-bold">
										<Archive size={16} /> Archivar
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}

			<AdaptiveModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				title="Nuevo presupuesto"
				maxWidth="max-w-lg">
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
						<select
							required
							className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
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
						<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
							Nombre / identificador (opcional)
						</label>
						<input
							className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium"
							value={nombre}
							onChange={(e) => setNombre(e.target.value)}
							placeholder="Ej: María - peeling (promo)"
						/>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
								Válido hasta (opcional)
							</label>
							<input
								type="date"
								className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
								value={validUntil}
								onChange={(e) => setValidUntil(e.target.value)}
							/>
						</div>
					</div>
					<div className="bg-white border border-gray-100 rounded-2xl p-3">
						<p className="text-[10px] font-black text-gray-400 uppercase mb-2">Precios</p>
						<div className="flex flex-col sm:flex-row gap-2">
							<label className="flex items-center gap-2 text-sm font-bold text-gray-700">
								<input
									type="radio"
									name="pricingMode"
									checked={pricingMode === "manual"}
									onChange={() => setPricingMode("manual")}
								/>
								Precio manual por línea
							</label>
							<label className="flex items-center gap-2 text-sm font-bold text-gray-700">
								<input
									type="radio"
									name="pricingMode"
									checked={pricingMode === "global_percent"}
									onChange={() => setPricingMode("global_percent")}
								/>
								Descuento global %
							</label>
						</div>
						{pricingMode === "global_percent" && (
							<div className="mt-2 flex items-center gap-2">
								<Percent size={16} className="text-amber-700" />
								<input
									type="number"
									min="0"
									max="100"
									step="0.1"
									className="w-28 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
									value={globalDiscountPercent}
									onChange={(e) => setGlobalDiscountPercent(e.target.value)}
									placeholder="10"
								/>
								<button
									type="button"
									onClick={reapplyGlobalDiscountToTreatmentLines}
									className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 text-sm font-black hover:bg-amber-100 transition-colors">
									Aplicar
								</button>
								<span className="text-xs text-gray-500">
									Se aplica a tratamientos al seleccionarlos (puedes ajustar el precio aplicado).
								</span>
							</div>
						)}
					</div>
					<div>
						<label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Notas</label>
						<textarea
							rows={2}
							className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none"
							value={notas}
							onChange={(e) => setNotas(e.target.value)}
							placeholder="Condiciones, observaciones…"
						/>
					</div>

					<div className="border-t border-gray-100 pt-3 space-y-3">
						<p className="text-xs font-black text-gray-500 uppercase">Líneas</p>
						{lines.map((ln, idx) => (
							<div
								key={idx}
								className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2 relative">
								{lines.length > 1 && (
									<button
										type="button"
										onClick={() => removeLine(idx)}
										className="absolute top-2 right-2 p-1 text-gray-400 hover:text-rose-600"
										aria-label="Quitar línea">
										<X size={16} />
									</button>
								)}
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase">Tratamiento</label>
									<select
										className="w-full p-2 rounded-lg border border-gray-200 text-sm font-medium mt-0.5"
										value={ln.treatment_id || ""}
										onChange={(e) => onTreatmentPick(idx, e.target.value)}>
										<option value="">— Manual / extra —</option>
										{treatments.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name} ({formatCurrency(Number(t.price) || 0)})
											</option>
										))}
									</select>
								</div>
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase">Concepto</label>
									<input
										className="w-full p-2 rounded-lg border border-gray-200 text-sm font-medium"
										value={ln.description}
										onChange={(e) => updateLine(idx, { description: e.target.value })}
										placeholder="Descripción en el presupuesto"
									/>
								</div>
								<div className="grid grid-cols-3 gap-2">
									<div>
										<label className="text-[10px] font-black text-gray-400 uppercase">Cant.</label>
										<input
											type="number"
											min="0.01"
											step="0.01"
											className="w-full p-2 rounded-lg border border-gray-200 text-sm"
											value={ln.quantity}
											onChange={(e) => updateLine(idx, { quantity: e.target.value })}
										/>
									</div>
									<div>
										<label className="text-[10px] font-black text-gray-400 uppercase">P. u. IVA inc.</label>
										<input
											type="number"
											min="0"
											step="0.01"
											className="w-full p-2 rounded-lg border border-gray-200 text-sm"
											value={ln.unit_price_ttc}
											onChange={(e) =>
												updateLine(idx, {
													unit_price_ttc: e.target.value,
													line_kind: ln.treatment_id ? "treatment" : "extra",
												})
											}
										/>
										{ln.original_unit_price_ttc != null && Number(ln.original_unit_price_ttc) > Number(ln.unit_price_ttc || 0) && (
											<p className="text-[10px] text-gray-500 mt-1">
												Original: <span className="font-bold">{formatCurrency(Number(ln.original_unit_price_ttc) || 0)}</span>{" "}
												· DTO:{" "}
												<span className="font-bold">
													{formatCurrency(Math.max(0, (Number(ln.original_unit_price_ttc) - Number(ln.unit_price_ttc || 0)) * (Number(ln.quantity) || 0)))}
												</span>
											</p>
										)}
									</div>
									<div>
										<label className="text-[10px] font-black text-gray-400 uppercase">IVA %</label>
										<input
											type="number"
											min="0"
											className="w-full p-2 rounded-lg border border-gray-200 text-sm"
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
							className="text-sm font-bold text-amber-700 hover:text-amber-900">
							+ Añadir línea
						</button>
					</div>

					<LoadingButton
						type="submit"
						loading={creating}
						className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl">
						Guardar presupuesto
					</LoadingButton>
				</form>
			</AdaptiveModal>

			<ConfirmModal
				isOpen={!!archiveId}
				title="Archivar presupuesto"
				message="Dejará de mostrarse en la lista. Los datos se conservan en la base de datos."
				onCancel={() => setArchiveId(null)}
				onConfirm={async () => {
					try {
						await archiveBudget(archiveId);
						showToast("Presupuesto archivado");
					} catch {
						showToast("Error al archivar", "error");
					} finally {
						setArchiveId(null);
					}
				}}
				isDestructive
			/>
		</div>
	);
};
