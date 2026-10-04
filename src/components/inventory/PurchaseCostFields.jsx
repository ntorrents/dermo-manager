import React, { useMemo } from "react";
import { IVA_OPTIONS, formatCurrency } from "../../utils/format";
import { resolvePurchaseAmounts } from "../../utils/purchaseTax";

/**
 * Coste de compra + modo IVA (incluido/excluido) + desglose en vivo.
 */
export const PurchaseCostFields = ({
	totalCost,
	onTotalCostChange,
	taxRate = 21,
	onTaxRateChange,
	priceMode = "included",
	onPriceModeChange,
	isDeductible = false,
	label = "Coste total (€)",
	required = false,
	showAmount = true,
	showBreakdown = true,
}) => {
	const breakdown = useMemo(
		() =>
			resolvePurchaseAmounts({
				amountInput: totalCost,
				taxRate,
				priceMode,
				isDeductible,
			}),
		[totalCost, taxRate, priceMode, isDeductible],
	);

	return (
		<div className="space-y-3">
			{showAmount && (
				<div>
					<label className="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-2 block ml-1">
						{label}
						{required ? <span className="text-rose-700"> *</span> : null}
					</label>
					<input
						type="number"
						step="0.01"
						min="0"
						required={required}
						placeholder="Ej: 25.50"
						className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-rose-700 placeholder-rose-300"
						value={totalCost}
						onChange={(e) => onTotalCostChange(e.target.value)}
					/>
				</div>
			)}

			{isDeductible && (
				<>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								El importe…
							</label>
							<select
								className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm appearance-none cursor-pointer"
								value={priceMode}
								onChange={(e) => onPriceModeChange(e.target.value)}>
								<option value="included">Ya incluye IVA</option>
								<option value="excluded">Es base (IVA aparte)</option>
							</select>
						</div>
						<div>
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
								IVA (%)
							</label>
							<select
								className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm appearance-none cursor-pointer"
								value={taxRate}
								onChange={(e) => onTaxRateChange(Number(e.target.value))}>
								{IVA_OPTIONS.map((v) => (
									<option key={v} value={v}>
										{v}%
									</option>
								))}
							</select>
						</div>
					</div>
					{showBreakdown && Number(totalCost) > 0 && (
						<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600 tabular-nums">
							Base imponible: {formatCurrency(breakdown.baseAmount)}
							<span className="text-slate-300 mx-1.5">|</span>
							IVA: {formatCurrency(breakdown.taxAmount)}
							<span className="text-slate-300 mx-1.5">|</span>
							Total:{" "}
							<span className="font-bold text-slate-900">
								{formatCurrency(breakdown.totalAmount)}
							</span>
						</div>
					)}
				</>
			)}
		</div>
	);
};
