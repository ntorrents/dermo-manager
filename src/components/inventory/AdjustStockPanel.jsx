import React, { useEffect, useState } from "react";
import { SidePanel } from "../ui/SidePanel";
import { LoadingButton } from "../ui/LoadingButton";
import { ConfirmModal } from "../ui/ConfirmModal";

const REASONS = [
	{ value: "error_calculo", label: "Error de cálculo / rendimiento" },
	{ value: "merma", label: "Merma / evaporación" },
	{ value: "rotura", label: "Rotura / caducado" },
	{ value: "inventario", label: "Inventario físico / conteo" },
	{ value: "correction", label: "Otra corrección" },
];

export const AdjustStockPanel = ({
	isOpen,
	onClose,
	item,
	batches = [],
	onSubmit,
	loading = false,
}) => {
	const [delta, setDelta] = useState("");
	const [reasonCode, setReasonCode] = useState("error_calculo");
	const [reason, setReason] = useState("");
	const [batchId, setBatchId] = useState("");
	const [confirmOpen, setConfirmOpen] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setDelta("");
			setReasonCode("error_calculo");
			setReason("");
			setBatchId("");
			setConfirmOpen(false);
		}
	}, [isOpen, item?.id]);

	const itemBatches = (batches || []).filter((b) => b.inventory_id === item?.id);
	const qty = Number(delta);
	const previewStock =
		item && Number.isFinite(qty) ? Number(item.stock) + qty : null;

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!qty || Number.isNaN(qty)) return;
		setConfirmOpen(true);
	};

	const confirm = async () => {
		await onSubmit({
			inventoryId: item.id,
			delta: qty,
			reasonCode,
			reason:
				reason.trim() ||
				REASONS.find((r) => r.value === reasonCode)?.label ||
				"Ajuste de inventario",
			batchId: batchId || null,
		});
		setConfirmOpen(false);
		onClose();
	};

	return (
		<>
			<SidePanel
				isOpen={isOpen}
				onClose={onClose}
				title={item ? `Ajustar stock: ${item.name}` : "Ajustar stock"}
				subtitle="Sin impacto en finanzas. Queda registrado en trazabilidad."
				size="md"
				footer={
					<LoadingButton
						loading={loading}
						type="submit"
						form="adjust-stock-form"
						className="w-full btn-primary py-3">
						Registrar ajuste
					</LoadingButton>
				}>
				<form id="adjust-stock-form" onSubmit={handleSubmit} className="space-y-4">
					<p className="text-sm text-slate-600">
						Stock actual:{" "}
						<strong className="tabular-nums text-slate-900">
							{item ? Number(item.stock) : "—"} {item?.unit || "uds"}
						</strong>
					</p>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">
							Cantidad (+ entrada / − salida) *
						</span>
						<input
							type="number"
							step="0.1"
							required
							className="input-field font-bold text-lg"
							placeholder="Ej: -2 o 1.5"
							value={delta}
							onChange={(e) => setDelta(e.target.value)}
						/>
					</label>
					{previewStock != null && (
						<p className="text-xs text-slate-500 tabular-nums">
							Stock resultante:{" "}
							<span
								className={
									previewStock < 0
										? "font-bold text-rose-700"
										: "font-bold text-slate-900"
								}>
								{previewStock} {item?.unit || "uds"}
							</span>
						</p>
					)}
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Motivo *</span>
						<select
							className="input-field"
							value={reasonCode}
							onChange={(e) => setReasonCode(e.target.value)}>
							{REASONS.map((r) => (
								<option key={r.value} value={r.value}>
									{r.label}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-xs font-bold text-muted">Detalle (opcional)</span>
						<textarea
							rows={2}
							className="input-field resize-none"
							placeholder="Notas internas del ajuste"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
						/>
					</label>
					{itemBatches.length > 0 && (
						<label className="block space-y-1">
							<span className="text-xs font-bold text-muted">
								Lote concreto (recomendado si restas)
							</span>
							<select
								className="input-field"
								value={batchId}
								onChange={(e) => setBatchId(e.target.value)}>
								<option value="">— Ajuste solo en stock cabecera —</option>
								{itemBatches.map((b) => (
									<option key={b.id} value={b.id}>
										{b.lot_number} · {b.quantity_remaining} ud · cad.{" "}
										{b.expiry_date}
									</option>
								))}
							</select>
						</label>
					)}
				</form>
			</SidePanel>
			<ConfirmModal
				isOpen={confirmOpen}
				title="Confirmar ajuste de stock"
				message={`Estás a punto de ajustar el stock de «${item?.name || ""}» en ${qty > 0 ? "+" : ""}${qty} ${item?.unit || "uds"}.\n\nNo se creará ningún gasto ni ingreso. Quedará un registro de «Ajuste de inventario» en trazabilidad.\n\n¿Confirmas?`}
				onConfirm={confirm}
				onCancel={() => setConfirmOpen(false)}
				isDestructive={qty < 0}
				confirmLabel="Confirmar ajuste"
			/>
		</>
	);
};
