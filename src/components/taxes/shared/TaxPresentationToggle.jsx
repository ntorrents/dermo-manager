import React, { useRef, useState } from "react";
import { CheckCircle2, Circle, Upload, FileText, Loader2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useTenant } from "../../../context/TenantContext";
import {
	uploadTaxDeclarationPdf,
	removeTaxDeclarationPdf,
	getTaxDeclarationDownloadUrl,
} from "../../../services/taxDeclarationStorage";

/**
 * Toggle "Presentado en AEAT" + upload PDF.
 */
export const TaxPresentationToggle = ({
	model,
	year,
	period,
	resultAmount,
	/** Modelo 303: crédito que alimentará la Casilla 110 del trimestre siguiente. */
	creditCarryAmount,
	declaration,
	upsertDeclaration,
	showToast = () => {},
}) => {
	const { user } = useAuth();
	const { clinicId } = useTenant();
	const inputRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const completed = declaration?.status === "completed";

	const markCompleted = async (file) => {
		if (!user?.id || !clinicId) return;
		setBusy(true);
		try {
			let storagePath = declaration?.storage_path || null;
			if (file) {
				storagePath = await uploadTaxDeclarationPdf(
					user.id,
					clinicId,
					model,
					year,
					period,
					file,
				);
			}
			await upsertDeclaration({
				clinic_id: clinicId,
				model: String(model),
				year: Number(year),
				period: String(period),
				status: "completed",
				result_amount: resultAmount != null ? Number(resultAmount) : null,
				credit_carry_amount:
					creditCarryAmount != null ? Number(creditCarryAmount) : null,
				presented_at: new Date().toISOString(),
				presented_by: user.id,
				storage_path: storagePath,
			});
			showToast("Marcado como presentado en la AEAT");
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

	return (
		<div
			className={`rounded-2xl border-2 p-5 ${
				completed ? "border-emerald-200 bg-emerald-50/60" : "border-dashed border-gray-200 bg-white"
			}`}>
			<div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
				<button
					type="button"
					disabled={busy}
					onClick={() => (completed ? markPending() : inputRef.current?.click())}
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
								: "Puedes adjuntar el PDF de la declaración presentada"}
						</p>
					</div>
				</button>

				<div className="flex flex-wrap gap-2">
					{!completed && (
						<button
							type="button"
							disabled={busy}
							onClick={() => inputRef.current?.click()}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-700 text-white text-sm font-bold hover:bg-rose-800 disabled:opacity-50">
							<Upload size={16} /> Subir PDF y marcar
						</button>
					)}
					{!completed && (
						<button
							type="button"
							disabled={busy}
							onClick={() => markCompleted(null)}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
							Marcar sin PDF
						</button>
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
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) markCompleted(file);
				}}
			/>
		</div>
	);
};
