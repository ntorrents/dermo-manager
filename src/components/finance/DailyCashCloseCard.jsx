import React, { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import {
	computeDailyCashClose,
	loadCashCountForDate,
	saveCashCountForDate,
} from "../../utils/dailyCashClose";

export const DailyCashCloseCard = ({ entries = [], dateYmd }) => {
	const close = computeDailyCashClose(entries, dateYmd);
	const [countedInput, setCountedInput] = useState("");
	const [counted, setCounted] = useState(null);

	useEffect(() => {
		const saved = loadCashCountForDate(dateYmd);
		setCounted(saved);
		setCountedInput(saved != null ? String(saved) : "");
	}, [dateYmd]);

	const handleSaveCount = () => {
		const n = Number(String(countedInput).replace(",", "."));
		if (!Number.isFinite(n)) {
			saveCashCountForDate(dateYmd, null);
			setCounted(null);
			return;
		}
		saveCashCountForDate(dateYmd, n);
		setCounted(n);
	};

	const difference =
		counted != null ? counted - close.incomeTotal : null;

	const dateLabel = dateYmd
		? new Date(dateYmd + "T12:00:00").toLocaleDateString("es-ES", {
				weekday: "long",
				day: "numeric",
				month: "long",
			})
		: "";

	return (
		<div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-4">
			<div className="flex items-center gap-2">
				<Wallet className="text-emerald-600" size={22} />
				<div>
					<h3 className="font-black text-emerald-900 text-sm uppercase tracking-wider">
						Cierre de caja del día
					</h3>
					<p className="text-xs text-emerald-700 font-medium capitalize">{dateLabel}</p>
				</div>
			</div>
			<p className="text-xs text-emerald-800/90 leading-relaxed">
				Al cerrar la jornada, comprueba que lo registrado como cobrado coincide con el
				efectivo real. Si quieres, anota el dinero que tienes en caja y te mostramos la
				diferencia con los ingresos del ERP.
			</p>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
				<div className="bg-white rounded-xl p-3 border border-emerald-100">
					<p className="text-[10px] font-black text-gray-400 uppercase">Cobrado</p>
					<p className="text-lg font-black text-emerald-700">
						{formatCurrency(close.incomeTotal)}
					</p>
					<p className="text-[10px] text-gray-500">{close.incomeCount} ingreso(s)</p>
				</div>
				<div className="bg-white rounded-xl p-3 border border-emerald-100">
					<p className="text-[10px] font-black text-gray-400 uppercase">Gastos</p>
					<p className="text-lg font-black text-rose-700">
						{formatCurrency(close.expenseTotal)}
					</p>
					<p className="text-[10px] text-gray-500">{close.expenseCount} gasto(s)</p>
				</div>
				<div className="bg-white rounded-xl p-3 border border-emerald-100 col-span-2 sm:col-span-2">
					<p className="text-[10px] font-black text-gray-400 uppercase">Neto día</p>
					<p className="text-lg font-black text-gray-800">
						{formatCurrency(close.netCash)}
					</p>
				</div>
			</div>
			<div className="flex flex-col sm:flex-row gap-2 sm:items-end">
				<div className="flex-1">
					<label className="text-[10px] font-black text-gray-500 uppercase block mb-1">
						Efectivo contado en caja (opcional)
					</label>
					<input
						type="number"
						step="0.01"
						min="0"
						value={countedInput}
						onChange={(e) => setCountedInput(e.target.value)}
						onBlur={handleSaveCount}
						placeholder="Ej: 450.00"
						className="w-full p-3 bg-white border border-emerald-200 rounded-xl font-bold text-sm"
					/>
				</div>
				{counted != null && difference != null && (
					<div
						className={`sm:pb-3 px-3 py-2 rounded-xl text-sm font-bold ${
							Math.abs(difference) < 0.01
								? "bg-emerald-100 text-emerald-800"
								: "bg-amber-100 text-amber-900"
						}`}>
						{Math.abs(difference) < 0.01
							? "Cuadra con movimientos"
							: `Diferencia: ${difference >= 0 ? "+" : ""}${formatCurrency(difference)}`}
					</div>
				)}
			</div>
		</div>
	);
};
