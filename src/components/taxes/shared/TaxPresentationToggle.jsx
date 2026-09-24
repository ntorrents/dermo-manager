import React, { useRef, useState } from "react";
import { CheckCircle2, Circle, Upload, FileText, Loader2, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useTenant } from "../../../context/TenantContext";
import {
	uploadTaxDeclarationPdf,
	removeTaxDeclarationPdf,
	getTaxDeclarationDownloadUrl,
} from "../../../services/taxDeclarationStorage";
import { creditCarryFrom303 } from "../../../utils/tax/modelo303";

const RESULT_LABELS = {
	130: "Importe final presentado (Casilla 19)",
	303: "Importe final presentado (Casilla 71)",
	115: "Importe final presentado (Casilla 03)",
	390: "Resultado neto anual presentado",
	180: "Importe final presentado (Casilla 03)",
};

const formatInputAmount = (value) => {
	if (value == null || Number.isNaN(Number(value))) return "";
	return Number(value).toFixed(2);
};

/** Acepta "74,43" o "74.43". */
const parseAmountInput = (raw) => {
	if (raw == null || String(raw).trim() === "") return null;
	const normalized = String(raw).trim().replace(/\s/g, "").replace(",", ".");
	const n = Number(normalized);
	return Number.isFinite(n) ? n : null;
};

/**
 * Confirmación + override manual al marcar presentado en AEAT.
 * Guarda la verdad jurídica del PDF, no solo el cálculo del ERP.
 */
export const TaxPresentationToggle = ({
	model,
	year,
	period,
	resultAmount,
	/** Modelo 303: Casilla 87 calculada (pendiente a periodos posteriores). */
	casilla87,
	resultLabel,
	declaration,
	upsertDeclaration,
	showToast = () => {},
}) => {
	const { user } = useAuth();
	const { clinicId } = useTenant();
	const fileInputRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingFile, setPendingFile] = useState(null);
	const [resultInput, setResultInput] = useState("");
	const [casilla87Input, setCasilla87Input] = useState("");

	const completed = declaration?.status === "completed";
	const is303 = String(model) === "303";
	const label =
		resultLabel || RESULT_LABELS[String(model)] || "Importe final presentado";

	const erpResult = resultAmount != null ? Number(resultAmount) : null;
	const erp87 = casilla87 != null ? Number(casilla87) : null;

	const openConfirm = (file = null) => {
		setPendingFile(file);
		setResultInput(formatInputAmount(erpResult));
		setCasilla87Input(formatInputAmount(erp87 ?? 0));
		setConfirmOpen(true);
	};

	const closeConfirm = () => {
		setConfirmOpen(false);
		setPendingFile(null);
		setResultInput("");
		setCasilla87Input("");
	};

	const markCompleted = async () => {
		if (!user?.id || !clinicId) return;

		const finalResult = parseAmountInput(resultInput);
		if (finalResult == null) {
			showToast("Introduce un importe numérico válido");
			return;
		}

		let finalCreditCarry = null;
		if (is303) {
			const final87 = parseAmountInput(casilla87Input);
			if (final87 == null) {
				showToast("Introduce un importe válido para la Casilla 87");
				return;
			}
			finalCreditCarry = creditCarryFrom303({
				casilla71: finalResult,
				casilla87: final87,
			});
		}

		setBusy(true);
		try {
			let storagePath = declaration?.storage_path || null;
			if (pendingFile) {
				storagePath = await uploadTaxDeclarationPdf(
					user.id,
					clinicId,
					model,
					year,
					period,
					pendingFile,
				);
			}
			await upsertDeclaration({
				clinic_id: clinicId,
				model: String(model),
				year: Number(year),
				period: String(period),
				status: "completed",
				result_amount: finalResult,
				credit_carry_amount: is303 ? finalCreditCarry : null,
				presented_at: new Date().toISOString(),
				presented_by: user.id,
				storage_path: storagePath,
			});
			showToast("Marcado como presentado en la AEAT");
			closeConfirm();
		} catch (err) {
			console.error(err);
			showToast(err.message || "Error al guardar presentación");
		} finally {
			setBusy(false);
		}
	};

	const markPending = async () => {
		if (!clinicId) return;
		setBusy(true);
		try {
			if (declaration?.storage_path) {
				try {
					await removeTaxDeclarationPdf(declaration.storage_path);
				} catch {
					/* ignore */
				}
			}
			await upsertDeclaration({
				clinic_id: clinicId,
				model: String(model),
				year: Number(year),
				period: String(period),
				status: "pending",
				result_amount: null,
				credit_carry_amount: null,
				presented_at: null,
				presented_by: null,
				storage_path: null,
			});
			showToast("Marcado como pendiente");
			closeConfirm();
		} catch (err) {
			console.error(err);
			showToast(err.message || "Error al actualizar");
		} finally {
			setBusy(false);
		}
	};

	const download = async () => {
		if (!declaration?.storage_path) return;
		try {
			const url = await getTaxDeclarationDownloadUrl(declaration.storage_path);
			if (url) window.open(url, "_blank", "noopener,noreferrer");
		} catch (err) {
			showToast(err.message || "No se pudo descargar el PDF");
		}
	};

	const storedResult =
		declaration?.result_amount != null ? Number(declaration.result_amount) : null;
	const storedCarry =
		declaration?.credit_carry_amount != null
			? Number(declaration.credit_carry_amount)
			: null;
	// Reconstruir Casilla 87 presentada a partir del carry congelado.
	const stored87 =
		is303 && storedCarry != null && storedResult != null
			? Number(
					(
						storedCarry - (storedResult < 0 ? Math.abs(storedResult) : 0)
					).toFixed(2),
				)
			: null;

	const resultDiffers =
		confirmOpen &&
		erpResult != null &&
		parseAmountInput(resultInput) != null &&
		Math.abs(parseAmountInput(resultInput) - erpResult) > 0.001;
	const casilla87Differs =
		is303 &&
		confirmOpen &&
		erp87 != null &&
		parseAmountInput(casilla87Input) != null &&
		Math.abs(parseAmountInput(casilla87Input) - erp87) > 0.001;

	return (
		<div
			className={`rounded-2xl border-2 p-5 ${
				completed ? "border-emerald-200 bg-emerald-50/60" : "border-dashed border-gray-200 bg-white"
			}`}>
			<div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
				<button
					type="button"
					disabled={busy}
					onClick={() => (completed ? markPending() : openConfirm(null))}
					className="flex items-center gap-3 text-left group">
					{busy ? (
						<Loader2 className="animate-spin text-gray-400" size={36} />
					) : completed ? (
						<CheckCircle2 className="text-emerald-600" size={36} />
					) : (
						<Circle className="text-gray-300 group-hover:text-rose-400" size={36} />
					)}
					<div>
						<p className="text-base font-black text-gray-900">
							{completed
								? "Presentado en la AEAT"
								: "Marcar trimestre como Presentado en la AEAT"}
						</p>
						<p className="text-xs text-gray-500 mt-0.5">
							{completed
								? "Pulsa para revertir a pendiente"
								: "Confirma el importe oficial del PDF (puedes ajustarlo)"}
						</p>
						{completed && storedResult != null && (
							<p className="text-xs font-semibold text-emerald-800 mt-1">
								Histórico fijado:{" "}
								{storedResult.toLocaleString("es-ES", {
									style: "currency",
									currency: "EUR",
								})}
								{is303 && stored87 != null && (
									<>
										{" "}
										· Casilla 87:{" "}
										{stored87.toLocaleString("es-ES", {
											style: "currency",
											currency: "EUR",
										})}
									</>
								)}
							</p>
						)}
					</div>
				</button>

				<div className="flex flex-wrap gap-2">
					{!completed && !confirmOpen && (
						<>
							<button
								type="button"
								disabled={busy}
								onClick={() => fileInputRef.current?.click()}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-700 text-white text-sm font-bold hover:bg-rose-800 disabled:opacity-50">
								<Upload size={16} /> Subir PDF y marcar
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => openConfirm(null)}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
								Marcar sin PDF
							</button>
						</>
					)}
					{completed && declaration?.storage_path && (
						<button
							type="button"
							onClick={download}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-sm font-bold text-emerald-800 hover:bg-emerald-100">
							<FileText size={16} /> Descargar PDF
						</button>
					)}
				</div>
			</div>

			{confirmOpen && !completed && (
				<div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-black text-gray-900">
								Confirmar importe oficial AEAT
							</p>
							<p className="text-xs text-gray-600 mt-1 leading-relaxed">
								El ERP ha calculado este valor, pero puedes modificarlo si el
								importe del PDF oficial de Hacienda difiere por redondeos o
								errores pasados. Este número fijará el histórico para los
								próximos trimestres.
							</p>
						</div>
						<button
							type="button"
							disabled={busy}
							onClick={closeConfirm}
							className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white"
							aria-label="Cancelar">
							<X size={18} />
						</button>
					</div>

					<div className="grid sm:grid-cols-2 gap-3">
						<label className="block space-y-1.5">
							<span className="text-xs font-bold text-gray-700">{label}</span>
							<input
								type="text"
								inputMode="decimal"
								value={resultInput}
								onChange={(e) => setResultInput(e.target.value)}
								className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
								placeholder="0.00"
							/>
							{resultDiffers && (
								<span className="text-[11px] font-medium text-amber-700">
									Ajuste manual respecto al cálculo del ERP (
									{erpResult.toLocaleString("es-ES", {
										style: "currency",
										currency: "EUR",
									})}
									)
								</span>
							)}
						</label>

						{is303 && (
							<label className="block space-y-1.5">
								<span className="text-xs font-bold text-gray-700">
									Cuota a compensar arrastrada (Casilla 87)
								</span>
								<input
									type="text"
									inputMode="decimal"
									value={casilla87Input}
									onChange={(e) => setCasilla87Input(e.target.value)}
									className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
									placeholder="0.00"
								/>
								{casilla87Differs && (
									<span className="text-[11px] font-medium text-amber-700">
										Ajuste manual respecto al cálculo del ERP (
										{erp87.toLocaleString("es-ES", {
											style: "currency",
											currency: "EUR",
										})}
										)
									</span>
								)}
							</label>
						)}
					</div>

					{pendingFile && (
						<p className="text-xs text-gray-600">
							PDF adjunto: <strong>{pendingFile.name}</strong>
						</p>
					)}

					<div className="flex flex-wrap gap-2 justify-end">
						<button
							type="button"
							disabled={busy}
							onClick={closeConfirm}
							className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-white disabled:opacity-50">
							Cancelar
						</button>
						{!pendingFile && (
							<button
								type="button"
								disabled={busy}
								onClick={() => fileInputRef.current?.click()}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-white disabled:opacity-50">
								<Upload size={16} /> Adjuntar PDF
							</button>
						)}
						<button
							type="button"
							disabled={busy}
							onClick={markCompleted}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-700 text-white text-sm font-bold hover:bg-rose-800 disabled:opacity-50">
							{busy ? <Loader2 size={16} className="animate-spin" /> : null}
							Confirmar y marcar presentado
						</button>
					</div>
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) openConfirm(file);
				}}
			/>
		</div>
	);
};
